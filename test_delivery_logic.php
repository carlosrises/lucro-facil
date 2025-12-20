<?php

require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

$service = new \App\Services\OrderCostService();

echo "Testando nova lógica de aplicação de taxa de entrega:\n";
echo "========================================================\n\n";

// Buscar pedidos delivery problemáticos
$orders = \App\Models\Order::where('tenant_id', 1)
    ->whereIn('id', [29, 30, 31, 32, 34, 35, 39, 48, 61, 76, 78])
    ->get();

foreach ($orders as $order) {
    $deliveryBy = $order->raw['session']['delivery_by'] ?? null;
    $tableType = $order->raw['session']['table']['table_type'] ?? null;

    // Testar se a taxa seria aplicada
    $reflection = new ReflectionClass($service);
    $method = $reflection->getMethod('checkIsDelivery');
    $method->setAccessible(true);
    $shouldApply = $method->invoke($service, $order);

    echo "Pedido #{$order->id} - {$order->code} ({$order->origin})\n";
    echo "Table Type: {$tableType}\n";
    echo "Delivery By: " . ($deliveryBy ?: 'vazio') . "\n";
    echo "Delivery Fee: R$ " . number_format($order->delivery_fee, 2, ',', '.') . "\n";
    echo "Aplica taxa de entrega? " . ($shouldApply ? 'SIM ✓' : 'NÃO ✗') . "\n";

    // Calcular custos
    $costs = $service->calculateCosts($order);
    $deliveryTax = collect($costs['costs'])->firstWhere('id', 21);

    if ($deliveryTax) {
        echo "Taxa aplicada: R$ " . number_format($deliveryTax['calculated_value'], 2, ',', '.') . " ✓\n";
    } else {
        echo "Taxa NÃO foi aplicada nos custos calculados\n";
    }

    echo "---\n\n";
}
