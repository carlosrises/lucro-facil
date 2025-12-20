<?php

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make('Illuminate\Contracts\Console\Kernel');
$kernel->bootstrap();

use App\Models\Order;
use Carbon\Carbon;

echo "=== TESTE: OrdersController SEM filtros na URL ===\n\n";

// Simular request SEM filtros (primeira carga)
$startDate = now()->startOfMonth()->format('Y-m-d');
$endDate = now()->endOfMonth()->format('Y-m-d');

echo "Datas padrão aplicadas:\n";
echo "  start_date: {$startDate}\n";
echo "  end_date: {$endDate}\n\n";

// Converter para UTC
$startDateUtc = Carbon::parse($startDate . ' 00:00:00', 'America/Sao_Paulo')->setTimezone('UTC')->toDateTimeString();
$endDateUtc = Carbon::parse($endDate . ' 23:59:59', 'America/Sao_Paulo')->setTimezone('UTC')->toDateTimeString();

echo "Convertido para UTC:\n";
echo "  start: {$startDateUtc}\n";
echo "  end: {$endDateUtc}\n\n";

// Query como o OrdersController faz
$total = Order::whereBetween('placed_at', [$startDateUtc, $endDateUtc])->count();

echo "Total de pedidos (mês atual): {$total}\n\n";

// Comparar com TODOS os pedidos (sem filtro)
$allOrders = Order::count();
echo "Total de TODOS os pedidos (sem filtro): {$allOrders}\n\n";

echo "✓ Na primeira carga deve mostrar: {$total} pedidos\n";
echo "✗ ANTES estava mostrando: {$allOrders} pedidos\n";
