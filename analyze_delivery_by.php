<?php

require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

echo "Análise detalhada de delivery_by por marketplace:\n";
echo "====================================================\n\n";

// Buscar pedidos delivery de diferentes marketplaces
$orders = \App\Models\Order::where('tenant_id', 1)
    ->whereRaw("JSON_UNQUOTE(JSON_EXTRACT(raw, '$.session.table.table_type')) = 'delivery'")
    ->get(['id', 'code', 'provider', 'origin', 'delivery_fee', 'raw']);

$byMarketplace = [];

foreach ($orders as $order) {
    $deliveryBy = $order->raw['session']['delivery_by'] ?? null;
    $marketplace = $order->origin ?? $order->provider;

    if (!isset($byMarketplace[$marketplace])) {
        $byMarketplace[$marketplace] = [
            'total' => 0,
            'with_merchant' => 0,
            'with_marketplace' => 0,
            'empty' => 0,
            'with_fee' => 0,
            'without_fee' => 0,
        ];
    }

    $byMarketplace[$marketplace]['total']++;

    if ($deliveryBy === 'MERCHANT') {
        $byMarketplace[$marketplace]['with_merchant']++;
    } elseif ($deliveryBy === 'MARKETPLACE') {
        $byMarketplace[$marketplace]['with_marketplace']++;
    } elseif (empty($deliveryBy)) {
        $byMarketplace[$marketplace]['empty']++;
    }

    if ($order->delivery_fee > 0) {
        $byMarketplace[$marketplace]['with_fee']++;
    } else {
        $byMarketplace[$marketplace]['without_fee']++;
    }
}

foreach ($byMarketplace as $marketplace => $stats) {
    echo "Marketplace: " . strtoupper($marketplace) . "\n";
    echo "Total de pedidos delivery: {$stats['total']}\n";
    echo "Com delivery_by='MERCHANT': {$stats['with_merchant']}\n";
    echo "Com delivery_by='MARKETPLACE': {$stats['with_marketplace']}\n";
    echo "Com delivery_by vazio: {$stats['empty']}\n";
    echo "Com delivery_fee > 0: {$stats['with_fee']}\n";
    echo "Sem delivery_fee: {$stats['without_fee']}\n";
    echo "---\n\n";
}

// Mostrar exemplos de pedidos com delivery_fee mas sem MERCHANT
echo "Pedidos com delivery_fee > 0 mas delivery_by != MERCHANT:\n";
echo "===========================================================\n\n";

$problematicOrders = \App\Models\Order::where('tenant_id', 1)
    ->whereRaw("JSON_UNQUOTE(JSON_EXTRACT(raw, '$.session.table.table_type')) = 'delivery'")
    ->where('delivery_fee', '>', 0)
    ->get(['id', 'code', 'provider', 'origin', 'delivery_fee', 'raw']);

foreach ($problematicOrders as $order) {
    $deliveryBy = $order->raw['session']['delivery_by'] ?? null;

    if ($deliveryBy !== 'MERCHANT') {
        echo "Pedido #{$order->id} - {$order->code}\n";
        echo "Marketplace: {$order->origin}\n";
        echo "Delivery By: " . ($deliveryBy ?: 'vazio') . "\n";
        echo "Delivery Fee: R$ " . number_format($order->delivery_fee, 2, ',', '.') . "\n";
        echo "---\n";
    }
}
