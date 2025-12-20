<?php

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use App\Models\Order;
use Carbon\Carbon;

echo "=== TESTE DE CONVERSÃO DE TIMEZONE ===\n\n";

// Teste 1: Como as datas devem ser interpretadas
echo "1. Simulação de filtro por 1º de Dezembro 2025:\n";
echo "   Usuário seleciona: 2025-12-01 (pensa em horário de Brasília)\n\n";

$startDate = '2025-12-01';
$endDate = '2025-12-01';

// ANTES (INCORRETO): Interpreta como UTC
$startDateUtcWrong = $startDate . ' 00:00:00';
$endDateUtcWrong = $endDate . ' 23:59:59';
echo "   ANTES (incorreto - interpreta como UTC):\n";
echo "     Filtro: {$startDateUtcWrong} até {$endDateUtcWrong}\n";
echo "     Problema: Pega pedidos de 01/12 00:00 UTC (30/11 21:00 Brasília) até 01/12 23:59 UTC (01/12 20:59 Brasília)\n";
echo "     Resultado: Inclui pedidos do dia 30/11 em Brasília!\n\n";

// DEPOIS (CORRETO): Converte de Brasília para UTC
$startDateUtc = Carbon::parse($startDate . ' 00:00:00', 'America/Sao_Paulo')->setTimezone('UTC')->toDateTimeString();
$endDateUtc = Carbon::parse($endDate . ' 23:59:59', 'America/Sao_Paulo')->setTimezone('UTC')->toDateTimeString();
echo "   DEPOIS (correto - converte Brasília → UTC):\n";
echo "     Filtro: {$startDateUtc} até {$endDateUtc}\n";
echo "     Busca: 01/12 00:00 Brasília (03:00 UTC) até 01/12 23:59 Brasília (02:59 UTC do dia seguinte)\n";
echo "     Resultado: Só inclui pedidos do dia 01/12 em Brasília!\n\n";

// Teste 2: Pedidos reais
echo "2. Pedidos do dia 08/12/2025 (horário de Brasília):\n\n";

$startDate = '2025-12-08';
$endDate = '2025-12-08';
$startDateUtc = Carbon::parse($startDate . ' 00:00:00', 'America/Sao_Paulo')->setTimezone('UTC')->toDateTimeString();
$endDateUtc = Carbon::parse($endDate . ' 23:59:59', 'America/Sao_Paulo')->setTimezone('UTC')->toDateTimeString();

$ordersCorrect = Order::whereBetween('placed_at', [$startDateUtc, $endDateUtc])
    ->orderBy('placed_at')
    ->take(10)
    ->get(['id', 'code', 'placed_at']);

echo "   Total com filtro correto: " . $ordersCorrect->count() . " pedidos\n\n";

foreach ($ordersCorrect as $order) {
    $placedAtUtc = Carbon::parse($order->placed_at);
    $placedAtBrasilia = $placedAtUtc->copy()->setTimezone('America/Sao_Paulo');

    echo "   Pedido: {$order->code}\n";
    echo "     DB (UTC): {$placedAtUtc->format('Y-m-d H:i:s')}\n";
    echo "     Brasília: {$placedAtBrasilia->format('Y-m-d H:i:s')}\n";
    echo "     ✓ Dia correto em Brasília: {$placedAtBrasilia->format('d/m')}\n\n";
}
