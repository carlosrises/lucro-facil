<?php

require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

echo "Análise do pedido #66:\n";
echo "======================\n\n";

$order = \App\Models\Order::with('items')->find(66);

if (!$order) {
    echo "Pedido não encontrado!\n";
    exit;
}

echo "Informações básicas:\n";
echo "--------------------\n";
echo "ID: {$order->id}\n";
echo "Código: {$order->code}\n";
echo "Provider: {$order->provider}\n";
echo "Origin: {$order->origin}\n";
echo "Status: {$order->status}\n";
echo "Delivery Fee: R$ " . number_format($order->delivery_fee, 2, ',', '.') . "\n\n";

echo "Informações de delivery:\n";
echo "------------------------\n";
$tableType = $order->raw['session']['table']['table_type'] ?? null;
$deliveryBy = $order->raw['session']['delivery_by'] ?? null;

echo "Table Type: " . ($tableType ?? 'null') . "\n";
echo "Delivery By: " . ($deliveryBy ?? 'null/vazio') . "\n";
echo "É delivery? " . ($tableType === 'delivery' ? 'SIM' : 'NÃO') . "\n";
echo "Feito pela loja? ";

if ($deliveryBy === 'MERCHANT') {
    echo "SIM (MERCHANT)\n";
} elseif (empty($deliveryBy) && $order->delivery_fee > 0) {
    echo "SIM (delivery_by vazio mas tem delivery_fee > 0)\n";
} elseif ($deliveryBy === 'MARKETPLACE') {
    echo "NÃO (MARKETPLACE fez a entrega)\n";
} else {
    echo "NÃO (delivery_by: " . ($deliveryBy ?? 'vazio') . ", delivery_fee: " . $order->delivery_fee . ")\n";
}

echo "\nLógica de aplicação da taxa de entrega:\n";
echo "---------------------------------------\n";
echo "Condição 1: table_type = 'delivery'? " . ($tableType === 'delivery' ? 'SIM ✓' : 'NÃO ✗') . "\n";
echo "Condição 2a: delivery_by = 'MERCHANT'? " . ($deliveryBy === 'MERCHANT' ? 'SIM ✓' : 'NÃO ✗') . "\n";
echo "Condição 2b: delivery_by vazio E delivery_fee > 0? " . ((empty($deliveryBy) && $order->delivery_fee > 0) ? 'SIM ✓' : 'NÃO ✗') . "\n";
echo "RESULTADO: Taxa de entrega deve aplicar? " . (($tableType === 'delivery' && ($deliveryBy === 'MERCHANT' || (empty($deliveryBy) && $order->delivery_fee > 0))) ? 'SIM ✓' : 'NÃO ✗') . "\n";

echo "\nMétodo de pagamento:\n";
echo "--------------------\n";
$payments = $order->raw['session']['payments'] ?? [];

if (empty($payments)) {
    echo "⚠️ SEM MÉTODOS DE PAGAMENTO (payments vazio)\n";
} else {
    echo "Total de pagamentos: " . count($payments) . "\n";
    foreach ($payments as $idx => $payment) {
        echo "\nPagamento " . ($idx + 1) . ":\n";
        echo "  Name: " . ($payment['payment_method']['name'] ?? 'N/A') . "\n";
        echo "  Method: " . ($payment['payment_method']['method'] ?? 'N/A') . "\n";
        echo "  Keyword: " . ($payment['payment_method']['keyword'] ?? 'N/A') . "\n";
        echo "  Value: R$ " . number_format($payment['value'] ?? 0, 2, ',', '.') . "\n";
    }
}

echo "\nCustos calculados:\n";
echo "------------------\n";
if ($order->calculated_costs) {
    $costs = is_array($order->calculated_costs) ? $order->calculated_costs : json_decode($order->calculated_costs, true);

    echo "Custos operacionais:\n";
    foreach ($costs['costs'] ?? [] as $cost) {
        echo "  - {$cost['name']}: R$ " . number_format($cost['calculated_value'], 2, ',', '.') . "\n";
    }

    echo "\nComissões:\n";
    foreach ($costs['commissions'] ?? [] as $commission) {
        echo "  - {$commission['name']}: R$ " . number_format($commission['calculated_value'], 2, ',', '.') . "\n";
    }

    echo "\nTaxas de pagamento:\n";
    foreach ($costs['payment_methods'] ?? [] as $tax) {
        echo "  - {$tax['name']}: R$ " . number_format($tax['calculated_value'], 2, ',', '.') . "\n";
    }

    if (empty($costs['payment_methods'])) {
        echo "  ⚠️ NENHUMA taxa de pagamento aplicada\n";
    }
} else {
    echo "Nenhum custo calculado.\n";
}

// Testar cálculo manualmente
echo "\n\nTestando cálculo manual:\n";
echo "========================\n";
$service = new \App\Services\OrderCostService();
$calculatedCosts = $service->calculateCosts($order);

echo "Custos calculados agora:\n";
foreach ($calculatedCosts['costs'] ?? [] as $cost) {
    echo "  - {$cost['name']}: R$ " . number_format($cost['calculated_value'], 2, ',', '.') . "\n";
}

foreach ($calculatedCosts['payment_methods'] ?? [] as $tax) {
    echo "  - {$tax['name']}: R$ " . number_format($tax['calculated_value'], 2, ',', '.') . "\n";
}
