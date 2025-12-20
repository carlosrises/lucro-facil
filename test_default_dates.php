<?php

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make('Illuminate\Contracts\Console\Kernel');
$kernel->bootstrap();

use Carbon\Carbon;

echo "=== TESTE DE DATAS PADRÃO ===\n\n";

$now = now();

echo "Data atual: {$now->format('Y-m-d')}\n\n";

// Mês atual
$startOfMonth = $now->copy()->startOfMonth()->format('Y-m-d');
$endOfMonth = $now->copy()->endOfMonth()->format('Y-m-d');

echo "Mês atual (padrão novo):\n";
echo "  Início: {$startOfMonth}\n";
echo "  Fim: {$endOfMonth}\n\n";

// Últimos 30 dias (antigo)
$last30Start = $now->copy()->subDays(30)->format('Y-m-d');
$last30End = $now->format('Y-m-d');

echo "Últimos 30 dias (padrão antigo):\n";
echo "  Início: {$last30Start}\n";
echo "  Fim: {$last30End}\n\n";

// Converter para UTC e buscar pedidos
$startDateUtc = Carbon::parse($startOfMonth . ' 00:00:00', 'America/Sao_Paulo')->setTimezone('UTC')->toDateTimeString();
$endDateUtc = Carbon::parse($endOfMonth . ' 23:59:59', 'America/Sao_Paulo')->setTimezone('UTC')->toDateTimeString();

echo "Convertido para UTC:\n";
echo "  Início: {$startDateUtc}\n";
echo "  Fim: {$endDateUtc}\n\n";

$ordersCount = \App\Models\Order::whereBetween('placed_at', [$startDateUtc, $endDateUtc])->count();

echo "Total de pedidos no mês atual: {$ordersCount}\n";
