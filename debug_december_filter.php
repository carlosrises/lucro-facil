<?php

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use App\Models\Order;
use Carbon\Carbon;

echo "=== SIMULAÇÃO EXATA DO FILTRO 01/12 - 31/12 ===\n\n";

$startDate = '2025-12-01';
$endDate = '2025-12-31';

// Como está sendo feito agora (com conversão)
$startDateUtc = Carbon::parse($startDate . ' 00:00:00', 'America/Sao_Paulo')->setTimezone('UTC')->toDateTimeString();
$endDateUtc = Carbon::parse($endDate . ' 23:59:59', 'America/Sao_Paulo')->setTimezone('UTC')->toDateTimeString();

echo "Filtro solicitado: {$startDate} a {$endDate}\n";
echo "Intervalo UTC: {$startDateUtc} a {$endDateUtc}\n\n";

$orders = Order::whereBetween('placed_at', [$startDateUtc, $endDateUtc])
    ->orderBy('placed_at', 'desc')
    ->take(20)
    ->get(['id', 'code', 'placed_at', 'provider']);

echo "Últimos 20 pedidos retornados:\n\n";

foreach ($orders as $order) {
    $utc = Carbon::parse($order->placed_at);
    $brasilia = $utc->copy()->setTimezone('America/Sao_Paulo');

    $diaBrasilia = $brasilia->format('d/m/Y');
    $horarioBrasilia = $brasilia->format('H:i:s');

    $emoji = $brasilia->month == 11 ? '⚠️ NOVEMBRO' : '✓ DEZEMBRO';

    echo sprintf(
        "%s %s - %s %s (Provider: %s)\n",
        $horarioBrasilia,
        $diaBrasilia,
        $order->code,
        $emoji,
        $order->provider
    );
}

echo "\n\n=== ANÁLISE DO PROBLEMA ===\n\n";

// Contar quantos pedidos de novembro estão sendo incluídos
$novemberCount = Order::whereBetween('placed_at', [$startDateUtc, $endDateUtc])
    ->whereRaw("DATE(CONVERT_TZ(placed_at, '+00:00', '-03:00')) < '2025-12-01'")
    ->count();

echo "Pedidos de NOVEMBRO incluídos no filtro de dezembro: {$novemberCount}\n";

// Mostrar alguns exemplos
$novemberOrders = Order::whereBetween('placed_at', [$startDateUtc, $endDateUtc])
    ->whereRaw("DATE(CONVERT_TZ(placed_at, '+00:00', '-03:00')) < '2025-12-01'")
    ->orderBy('placed_at', 'desc')
    ->take(5)
    ->get(['code', 'placed_at']);

if ($novemberOrders->count() > 0) {
    echo "\nExemplos:\n";
    foreach ($novemberOrders as $order) {
        $utc = Carbon::parse($order->placed_at);
        $brasilia = $utc->copy()->setTimezone('America/Sao_Paulo');
        echo "  {$order->code}: UTC={$utc->format('Y-m-d H:i')} → Brasília={$brasilia->format('Y-m-d H:i')}\n";
    }
}
