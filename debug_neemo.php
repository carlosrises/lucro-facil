<?php

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Order;
use App\Models\CostCommission;

echo "=== PEDIDOS NEEMO ===\n";
$neemoOrders = Order::where('tenant_id', 1)
    ->where('provider', 'takeat')
    ->where('origin', 'neemo')
    ->orderByDesc('id')
    ->limit(3)
    ->get(['id', 'code', 'provider', 'origin', 'raw']);

echo "Total de pedidos Neemo: " . Order::where('tenant_id', 1)->where('provider', 'takeat')->where('origin', 'neemo')->count() . "\n\n";

foreach ($neemoOrders as $order) {
    echo "--- Pedido #{$order->id} ({$order->code}) ---\n";
    echo "Provider: {$order->provider}\n";
    echo "Origin: {$order->origin}\n";

    // Verificar métodos de pagamento
    $payments = $order->raw['session']['payments'] ?? [];
    echo "Métodos de pagamento:\n";
    foreach ($payments as $payment) {
        $method = $payment['payment_method']['method'] ?? 'N/A';
        $keyword = $payment['payment_method']['keyword'] ?? 'N/A';
        $name = $payment['payment_method']['name'] ?? 'N/A';
        echo "  - Method: $method | Keyword: $keyword | Name: $name\n";
    }
    echo "\n";
}

echo "\n=== TAXAS CONFIGURADAS PARA NEEMO ===\n";
$neemoTaxes = CostCommission::where('tenant_id', 1)
    ->where('active', true)
    ->where('provider', 'takeat-neemo')
    ->get();

echo "Total de taxas takeat-neemo: " . $neemoTaxes->count() . "\n\n";

foreach ($neemoTaxes as $tax) {
    echo "ID: {$tax->id}\n";
    echo "Nome: {$tax->name}\n";
    echo "Provider: {$tax->provider}\n";
    echo "Category: {$tax->category}\n";
    echo "Applies to: {$tax->applies_to}\n";
    echo "Payment type: {$tax->payment_type}\n";
    echo "Condition values: " . json_encode($tax->condition_values) . "\n";
    echo "Type: {$tax->type} | Value: {$tax->value}\n";
    echo "---\n";
}

// Testar cálculo em um pedido
if ($neemoOrders->count() > 0) {
    $testOrder = $neemoOrders->first();
    echo "\n=== TESTE DE CÁLCULO NO PEDIDO {$testOrder->id} ===\n";
    echo "Provider: {$testOrder->provider}\n";
    echo "Origin: {$testOrder->origin}\n\n";

    // Verificar quais taxas serão buscadas
    echo "Buscando taxas para:\n";
    echo "- Provider base: takeat, Origin: neemo\n";

    $baseTaxes = CostCommission::where('tenant_id', 1)
        ->where('active', true)
        ->where(function ($q) {
            $q->where('provider', 'takeat')
              ->where(function ($q2) {
                  $q2->whereNull('origin')
                     ->orWhere('origin', 'neemo');
              });
        })
        ->get();

    echo "Taxas encontradas com provider=takeat: {$baseTaxes->count()}\n";

    // Verificar se a lógica de detecção de provider pelo pagamento está funcionando
    echo "\nVerificando detecção de provider adicional...\n";

    // Testar getOrderPaymentMethods diretamente
    $service = new \App\Services\OrderCostService();
    $reflection = new \ReflectionClass($service);
    $method = $reflection->getMethod('getOrderPaymentMethods');
    $method->setAccessible(true);
    $detectedMethods = $method->invoke($service, $testOrder);

    echo "Métodos detectados: " . json_encode($detectedMethods) . "\n\n";

    $result = $service->calculateCosts($testOrder);

    echo "Total Payment Methods: R$ {$result['total_payment_methods']}\n";
    echo "Payment Methods aplicados: " . count($result['payment_methods']) . "\n";
    foreach ($result['payment_methods'] as $pm) {
        echo "- {$pm['name']}: R$ {$pm['calculated_value']}\n";
    }

    echo "\nDados do pedido:\n";
    echo "Net Total: {$testOrder->net_total}\n";
    echo "Gross Total: {$testOrder->gross_total}\n";
}
