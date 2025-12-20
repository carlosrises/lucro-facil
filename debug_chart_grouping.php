<?php

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make('Illuminate\Contracts\Console\Kernel');
$kernel->bootstrap();

use App\Models\Order;
use Carbon\Carbon;

echo "=== ANÁLISE DE AGRUPAMENTO POR DIA ===\n\n";

$startDate = '2025-12-01';
$endDate = '2025-12-31';

$startDateUtc = Carbon::parse($startDate . ' 00:00:00', 'America/Sao_Paulo')->setTimezone('UTC')->toDateTimeString();
$endDateUtc = Carbon::parse($endDate . ' 23:59:59', 'America/Sao_Paulo')->setTimezone('UTC')->toDateTimeString();

$orders = Order::whereBetween('placed_at', [$startDateUtc, $endDateUtc])
    ->orderBy('placed_at')
    ->get();

echo "Total de pedidos: " . $orders->count() . "\n\n";

// Agrupar como no DashboardController
$ordersByDate = $orders->groupBy(function ($order) {
    return Carbon::parse($order->placed_at)->setTimezone('America/Sao_Paulo')->format('Y-m-d');
});

echo "Distribuição por dia (Brasília):\n";
foreach ($ordersByDate as $date => $dayOrders) {
    echo "  {$date}: " . $dayOrders->count() . " pedidos\n";

    // Mostrar alguns exemplos
    if ($dayOrders->count() > 0) {
        $first = $dayOrders->first();
        $last = $dayOrders->last();

        $firstUtc = Carbon::parse($first->placed_at);
        $firstBr = $firstUtc->copy()->setTimezone('America/Sao_Paulo');

        $lastUtc = Carbon::parse($last->placed_at);
        $lastBr = $lastUtc->copy()->setTimezone('America/Sao_Paulo');

        echo "    Primeiro: {$first->code} - {$firstBr->format('d/m H:i')}\n";
        echo "    Último: {$last->code} - {$lastBr->format('d/m H:i')}\n";
    }
}

echo "\n=== VERIFICAÇÃO: Loop de preenchimento ===\n\n";

// Simular o loop do DashboardController
$currentDate = Carbon::parse($startDate);
$endDateCarbon = Carbon::parse($endDate);

$daysInLoop = [];
while ($currentDate <= $endDateCarbon) {
    $dateStr = $currentDate->format('Y-m-d');
    $daysInLoop[] = $dateStr;
    $currentDate->addDay();
}

echo "Dias gerados pelo loop: " . count($daysInLoop) . "\n";
echo "Primeiros 5: " . implode(', ', array_slice($daysInLoop, 0, 5)) . "\n";
echo "Últimos 5: " . implode(', ', array_slice($daysInLoop, -5)) . "\n";
