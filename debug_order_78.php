<?php

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\CostCommission;
use App\Models\Order;

$order = Order::find(78);

if (! $order) {
    echo "Pedido não encontrado\n";
    exit;
}

echo "=== PEDIDO 78 ===\n";
echo "Provider: {$order->provider}\n";
echo "Origin: {$order->origin}\n";
echo "Tenant ID: {$order->tenant_id}\n\n";

echo "=== MÉTODOS DE PAGAMENTO ===\n";
$payments = $order->raw['session']['payments'] ?? [];
foreach ($payments as $payment) {
    $method = $payment['payment_method']['method'] ?? 'N/A';
    $keyword = $payment['payment_method']['keyword'] ?? 'N/A';
    $name = $payment['payment_method']['name'] ?? 'N/A';
    echo "Method: $method\n";
    echo "Keyword: $keyword\n";
    echo "Name: $name\n\n";
}

echo "=== TAXAS DISPONÍVEIS PARA TAKEAT ===\n";
$takeatTaxes = CostCommission::where('tenant_id', $order->tenant_id)
    ->where('active', true)
    ->where('provider', 'takeat')
    ->where('category', 'payment_method')
    ->get();
echo 'Total: '.$takeatTaxes->count()."\n";
foreach ($takeatTaxes as $tax) {
    echo "- {$tax->name} (ID: {$tax->id})\n";
    echo "  Applies to: {$tax->applies_to}\n";
    echo "  Payment type: {$tax->payment_type}\n";
    echo '  Condition values: '.json_encode($tax->condition_values)."\n\n";
}

echo "=== TAXAS DISPONÍVEIS PARA 99FOOD ===\n";
$ninefoodTaxes = CostCommission::where('tenant_id', $order->tenant_id)
    ->where('active', true)
    ->where('provider', '99food')
    ->where('category', 'payment_method')
    ->get();
echo 'Total: '.$ninefoodTaxes->count()."\n";
foreach ($ninefoodTaxes as $tax) {
    echo "- {$tax->name} (ID: {$tax->id})\n";
    echo "  Applies to: {$tax->applies_to}\n";
    echo "  Payment type: {$tax->payment_type}\n";
    echo '  Condition values: '.json_encode($tax->condition_values)."\n\n";
}

echo "=== TESTE DE DETECÇÃO ===\n";
$service = new \App\Services\OrderCostService;
$result = $service->calculateCosts($order);
echo 'Total Payment Methods: R$ '.$result['total_payment_methods']."\n";
echo 'Payment Methods aplicados: '.count($result['payment_methods'])."\n";
foreach ($result['payment_methods'] as $pm) {
    echo "- {$pm['name']}: R$ {$pm['calculated_value']}\n";
}
