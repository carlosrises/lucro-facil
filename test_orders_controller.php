<?php

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make('Illuminate\Contracts\Console\Kernel');
$kernel->bootstrap();

use App\Models\Order;
use Carbon\Carbon;

echo "=== SIMULAÇÃO EXATA DO ORDERSCONTROLLER ===\n\n";

// Simular request
$startDate = '2025-12-01';
$endDate = '2025-12-31';

echo "Request params:\n";
echo "  start_date: {$startDate}\n";
echo "  end_date: {$endDate}\n\n";

// Código EXATO do OrdersController
$startDateUtc = \Carbon\Carbon::parse($startDate . ' 00:00:00', 'America/Sao_Paulo')->setTimezone('UTC')->toDateTimeString();
$endDateUtc = \Carbon\Carbon::parse($endDate . ' 23:59:59', 'America/Sao_Paulo')->setTimezone('UTC')->toDateTimeString();

echo "Converted to UTC:\n";
echo "  start: {$startDateUtc}\n";
echo "  end: {$endDateUtc}\n\n";

// Query EXATA do OrdersController (simplificada)
$query = Order::query()
    ->select([
        'id', 'order_uuid', 'code', 'status', 'provider', 'origin',
        'store_id', 'placed_at', 'gross_total', 'discount_total',
        'delivery_fee', 'tip', 'net_total', 'tenant_id',
    ])
    ->whereBetween('placed_at', [$startDateUtc, $endDateUtc])
    ->orderBy('placed_at', 'desc');

$total = $query->count();
echo "Total de pedidos: {$total}\n\n";

// Página 7 (pedidos 61-70)
$page7Orders = $query->skip(60)->take(10)->get();

echo "=== PÁGINA 7 (Pedidos 61-70) ===\n\n";

foreach ($page7Orders as $order) {
    $utc = Carbon::parse($order->placed_at);
    $brasilia = $utc->copy()->setTimezone('America/Sao_Paulo');

    echo sprintf(
        "%s %s - %s (provider: %s, origin: %s)\n",
        $brasilia->format('H:i:s'),
        $brasilia->format('d/m/Y'),
        $order->code,
        $order->provider,
        $order->origin ?: 'null'
    );
}

echo "\n\n=== VERIFICAÇÃO: Pedidos de NOVEMBRO ===\n\n";

$novemberOrders = Order::whereBetween('placed_at', [$startDateUtc, $endDateUtc])
    ->whereRaw("DATE(CONVERT_TZ(placed_at, '+00:00', '-03:00')) < '2025-12-01'")
    ->get();

echo "Pedidos de novembro no filtro: " . $novemberOrders->count() . "\n";

if ($novemberOrders->count() > 0) {
    echo "\n⚠️ PROBLEMA ENCONTRADO! Pedidos de novembro estão sendo incluídos:\n\n";

    foreach ($novemberOrders as $order) {
        $utc = Carbon::parse($order->placed_at);
        $brasilia = $utc->copy()->setTimezone('America/Sao_Paulo');

        echo "  {$order->code}:\n";
        echo "    UTC: {$utc->format('Y-m-d H:i:s')}\n";
        echo "    Brasília: {$brasilia->format('Y-m-d H:i:s')}\n";
        echo "    Provider: {$order->provider}\n\n";
    }
} else {
    echo "✓ Nenhum pedido de novembro encontrado\n";
}
