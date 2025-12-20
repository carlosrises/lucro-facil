<?php

require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

echo "Testando filtro de tipo de pedido:\n";
echo "====================================\n\n";

// Testar cada tipo
$types = ['delivery', 'takeout', 'balcony', 'self-service'];

foreach ($types as $type) {
    echo "Tipo: " . strtoupper($type) . "\n";

    $count = \App\Models\Order::where('tenant_id', 1)
        ->where(function ($query) use ($type) {
            $normalizedType = strtoupper($type);

            $query->where(function ($q) use ($normalizedType) {
                $q->where('provider', 'takeat')
                    ->whereRaw("UPPER(JSON_UNQUOTE(JSON_EXTRACT(raw, '$.session.table.table_type'))) = ?", [$normalizedType]);
            })
            ->orWhereRaw("UPPER(JSON_UNQUOTE(JSON_EXTRACT(raw, '$.orderType'))) = ?", [$normalizedType]);
        })
        ->count();

    echo "Total de pedidos: {$count}\n";
    echo "---\n\n";
}

// Listar alguns exemplos
echo "Exemplos de pedidos por tipo:\n";
echo "==============================\n\n";

$orders = \App\Models\Order::where('tenant_id', 1)
    ->limit(10)
    ->get(['id', 'code', 'provider', 'raw']);

foreach ($orders as $order) {
    $type = null;

    if ($order->provider === 'takeat') {
        $type = $order->raw['session']['table']['table_type'] ?? null;
    } else {
        $type = $order->raw['orderType'] ?? null;
    }

    echo "#{$order->id} - {$order->code} ({$order->provider}): " . strtoupper($type ?? 'N/A') . "\n";
}
