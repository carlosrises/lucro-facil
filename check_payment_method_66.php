<?php

require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

echo "Verificando método de pagamento do pedido #66:\n";
echo "==============================================\n\n";

$order = \App\Models\Order::find(66);

echo "Raw payments:\n";
echo json_encode($order->raw['session']['payments'] ?? [], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n\n";

// Testar detecção de método de pagamento
$service = new \App\Services\OrderCostService();

// Usar reflection para acessar método privado
$reflection = new ReflectionClass($service);
$method = $reflection->getMethod('getOrderPaymentMethods');
$method->setAccessible(true);

$detectedMethods = $method->invoke($service, $order);

echo "Métodos detectados pelo sistema:\n";
echo "--------------------------------\n";
foreach ($detectedMethods as $detectedMethod) {
    echo "- {$detectedMethod}\n";
}

if (empty($detectedMethods)) {
    echo "⚠️ NENHUM método detectado!\n";
}

echo "\n\nVerificando taxas de pagamento cadastradas:\n";
echo "============================================\n";

// Buscar taxas de crédito
$taxes = \App\Models\CostCommission::where('tenant_id', 1)
    ->where('applies_to', 'payment_method')
    ->get(['id', 'name', 'provider', 'applies_to', 'condition_values', 'payment_type', 'active']);

echo "\nTaxas de meio de pagamento:\n";
foreach ($taxes as $tax) {
    echo "\nID: {$tax->id}\n";
    echo "Nome: {$tax->name}\n";
    echo "Provider: " . ($tax->provider ?? 'todos') . "\n";
    echo "Payment Type: " . ($tax->payment_type ?? 'N/A') . "\n";
    echo "Condition Values: " . json_encode($tax->condition_values) . "\n";
    echo "Ativo: " . ($tax->active ? 'Sim' : 'Não') . "\n";

    // Verificar se deveria aplicar
    $shouldApply = false;

    if ($tax->provider && $tax->provider !== 'takeat') {
        echo "✗ Provider não corresponde (taxa: {$tax->provider}, pedido: takeat)\n";
        continue;
    }

    if (empty($tax->condition_values) || in_array('CREDIT_CARD', $tax->condition_values)) {
        $shouldApply = true;
        echo "✓ Deveria aplicar!\n";
    } else {
        echo "✗ Não aplica (condition_values: " . json_encode($tax->condition_values) . ")\n";
    }
}

// Verificar se o pedido aparece no filtro de "sem método de pagamento"
echo "\n\nVerificando filtro 'sem método de pagamento':\n";
echo "==============================================\n";

$noPaymentOrders = \App\Models\Order::where('tenant_id', 1)
    ->where('provider', 'takeat')
    ->whereRaw("JSON_LENGTH(JSON_EXTRACT(raw, '$.session.payments')) = 0 OR JSON_EXTRACT(raw, '$.session.payments') IS NULL")
    ->pluck('id')
    ->toArray();

echo "Pedidos sem método de pagamento: " . implode(', ', $noPaymentOrders) . "\n";
echo "Pedido 66 aparece? " . (in_array(66, $noPaymentOrders) ? 'SIM' : 'NÃO') . "\n";

echo "\n\nVerificando length do payments do pedido 66:\n";
$length = \DB::selectOne("SELECT JSON_LENGTH(JSON_EXTRACT(raw, '$.session.payments')) as length FROM orders WHERE id = 66")->length;
echo "Length: " . ($length ?? 'NULL') . "\n";
