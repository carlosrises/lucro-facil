<?php

require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

echo "Tipos de pedido encontrados:\n";
echo "================================\n\n";

$orders = \App\Models\Order::where('tenant_id', 1)->get(['id', 'code', 'provider', 'raw']);

$types = [];

foreach ($orders as $order) {
    $type = null;

    if ($order->provider === 'takeat') {
        $type = $order->raw['session']['table']['table_type'] ?? null;
    } else {
        // iFood, Rappi, etc
        $type = $order->raw['orderType'] ?? null;
    }

    if ($type) {
        if (!isset($types[$type])) {
            $types[$type] = ['count' => 0, 'examples' => []];
        }
        $types[$type]['count']++;
        if (count($types[$type]['examples']) < 3) {
            $types[$type]['examples'][] = "#{$order->id} - {$order->code} ({$order->provider})";
        }
    }
}

foreach ($types as $type => $data) {
    echo "Tipo: " . strtoupper($type) . "\n";
    echo "Total: {$data['count']} pedidos\n";
    echo "Exemplos:\n";
    foreach ($data['examples'] as $example) {
        echo "  - {$example}\n";
    }
    echo "---\n\n";
}

// Verificar nomenclatura
echo "Mapeamento sugerido:\n";
echo "====================\n";
echo "delivery → Delivery\n";
echo "pdv → Balcão/PDV\n";
echo "pickup → Retirada\n";
echo "takeout → Retirada\n";
