<?php

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use App\Models\Order;
use Carbon\Carbon;

echo "=== FILTRO REAL: 01/12 - 31/12/2025 ===\n\n";

$startDate = '2025-12-01';
$endDate = '2025-12-31';

$startDateUtc = Carbon::parse($startDate . ' 00:00:00', 'America/Sao_Paulo')->setTimezone('UTC')->toDateTimeString();
$endDateUtc = Carbon::parse($endDate . ' 23:59:59', 'America/Sao_Paulo')->setTimezone('UTC')->toDateTimeString();

echo "Filtro: {$startDate} a {$endDate} (Brasília)\n";
echo "UTC: {$startDateUtc} a {$endDateUtc}\n\n";

$orders = Order::whereBetween('placed_at', [$startDateUtc, $endDateUtc])
    ->orderBy('placed_at', 'desc')
    ->get();

$total = $orders->count();
echo "Total de pedidos: {$total}\n\n";

// Analisar por dia em Brasília
$byDate = [];
foreach ($orders as $order) {
    $brasilia = Carbon::parse($order->placed_at)->setTimezone('America/Sao_Paulo');
    $dateKey = $brasilia->format('Y-m-d');

    if (!isset($byDate[$dateKey])) {
        $byDate[$dateKey] = 0;
    }
    $byDate[$dateKey]++;
}

ksort($byDate);

echo "Distribuição por dia (Brasília):\n";
foreach ($byDate as $date => $count) {
    $d = Carbon::parse($date);
    $mes = $d->format('m');
    $emoji = $mes == '11' ? '⚠️ NOV' : '✓ DEZ';
    echo "  {$date}: {$count} pedidos {$emoji}\n";
}

// Verificar página 7 (pedidos 61-70)
echo "\n=== PÁGINA 7 (Pedidos 61-70) ===\n\n";

$page7 = $orders->slice(60, 10);

foreach ($page7 as $order) {
    $brasilia = Carbon::parse($order->placed_at)->setTimezone('America/Sao_Paulo');
    echo sprintf(
        "%s %s - %s (provider: %s)\n",
        $brasilia->format('H:i:s'),
        $brasilia->format('d/m/Y'),
        $order->code,
        $order->provider
    );
}
