<?php

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use App\Models\Order;
use Carbon\Carbon;

echo "=== VERIFICAÇÃO DE PEDIDOS COM DATAS ERRADAS ===\n\n";

// Buscar pedidos que aparecem em 27/11 quando filtrado por dezembro
// Na imagem, vemos pedidos de 27/11/2025 entre 11:20 e 17:24
echo "Buscando pedidos de 27/11/2025:\n\n";

$novemberOrders = Order::whereBetween('placed_at', ['2025-11-27 00:00:00', '2025-11-27 23:59:59'])
    ->orderBy('placed_at', 'desc')
    ->take(10)
    ->get();

foreach ($novemberOrders as $order) {
    $placedAtUtc = Carbon::parse($order->placed_at);
    $placedAtBrasilia = $placedAtUtc->copy()->setTimezone('America/Sao_Paulo');

    echo "Pedido {$order->code}:\n";
    echo "  Provider: {$order->provider}\n";
    echo "  DB (UTC): {$placedAtUtc->format('Y-m-d H:i:s')}\n";
    echo "  Brasília: {$placedAtBrasilia->format('Y-m-d H:i:s')}\n";

    $rawCreatedAt = data_get($order->raw, 'createdAt');
    if ($rawCreatedAt) {
        echo "  raw.createdAt: {$rawCreatedAt}\n";
    } else {
        echo "  raw.createdAt: (não existe)\n";
    }
    echo "\n";
}

echo "\n=== TESTANDO FILTRO DE DEZEMBRO COM CONVERSÃO ===\n\n";

// Testar o filtro correto (como deveria funcionar)
$startDate = '2025-12-01';
$endDate = '2025-12-31';

echo "Filtro solicitado: {$startDate} até {$endDate} (Brasília)\n\n";

// ANTES (incorreto)
$wrongCount = Order::whereBetween('placed_at', [
    $startDate . ' 00:00:00',
    $endDate . ' 23:59:59'
])->count();

echo "ANTES (interpretando como UTC): {$wrongCount} pedidos\n";

// DEPOIS (correto)
$startDateUtc = Carbon::parse($startDate . ' 00:00:00', 'America/Sao_Paulo')->setTimezone('UTC')->toDateTimeString();
$endDateUtc = Carbon::parse($endDate . ' 23:59:59', 'America/Sao_Paulo')->setTimezone('UTC')->toDateTimeString();

$correctCount = Order::whereBetween('placed_at', [$startDateUtc, $endDateUtc])->count();

echo "DEPOIS (convertendo Brasília→UTC): {$correctCount} pedidos\n";
echo "Filtro UTC usado: {$startDateUtc} até {$endDateUtc}\n\n";

echo "Diferença: " . ($wrongCount - $correctCount) . " pedidos (esses são de novembro em Brasília)\n";

echo "\n\n=== CONTAGEM DE PEDIDOS COM DATAS INCORRETAS ===\n\n";

// Contar pedidos que podem ter datas erradas
// Se raw.createdAt existe, comparar com placed_at
$ordersWithRaw = Order::whereNotNull('raw')->take(100)->get();

$needsCorrection = 0;
$alreadyCorrect = 0;

foreach ($ordersWithRaw as $order) {
    $rawCreatedAt = data_get($order->raw, 'createdAt');

    if ($rawCreatedAt) {
        $correctDate = Carbon::parse($rawCreatedAt, 'America/Sao_Paulo')->setTimezone('UTC');
        $currentDate = Carbon::parse($order->placed_at);

        // Comparar com margem de 1 segundo
        if (abs($correctDate->diffInSeconds($currentDate)) > 1) {
            $needsCorrection++;
        } else {
            $alreadyCorrect++;
        }
    }
}

echo "Amostra de 100 pedidos analisados:\n";
echo "  Precisam correção: {$needsCorrection}\n";
echo "  Já estão corretos: {$alreadyCorrect}\n";

if ($needsCorrection > 0) {
    echo "\n⚠️ AÇÃO NECESSÁRIA: Executar correção em massa dos pedidos existentes\n";
}
