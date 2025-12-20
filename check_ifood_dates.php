<?php

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use App\Models\Order;
use Carbon\Carbon;

echo "=== ANÁLISE: iFood Direto vs iFood via Takeat ===\n\n";

// iFood DIRETO (provider = ifood)
$ifoodDirect = Order::where('provider', 'ifood')
    ->whereNotNull('raw')
    ->orderBy('placed_at', 'desc')
    ->first();

// iFood via Takeat (provider = takeat, origin = ifood)
$ifoodTakeat = Order::where('provider', 'takeat')
    ->where('origin', 'ifood')
    ->whereNotNull('raw')
    ->orderBy('placed_at', 'desc')
    ->first();

if ($ifoodDirect) {
    echo "1. iFood DIRETO (provider = ifood):\n";
    echo "   Pedido: {$ifoodDirect->code}\n";
    $rawDate = data_get($ifoodDirect->raw, 'createdAt');
    echo "   raw.createdAt: {$rawDate}\n";
    echo "   Formato: " . (str_contains($rawDate ?? '', 'Z') ? 'ISO com Z (UTC)' : 'SEM Z (Brasília UTC-3)') . "\n";
    echo "   placed_at (DB): {$ifoodDirect->placed_at}\n";

    if ($rawDate) {
        // Testar as duas formas
        $parseUtc = Carbon::parse($rawDate);
        $parseBrasilia = Carbon::parse($rawDate, 'America/Sao_Paulo');

        echo "\n   Teste de interpretação:\n";
        echo "     Se for UTC: {$parseUtc->format('Y-m-d H:i:s')} → Brasília: {$parseUtc->setTimezone('America/Sao_Paulo')->format('Y-m-d H:i:s')}\n";
        echo "     Se for Brasília: {$parseBrasilia->format('Y-m-d H:i:s')} → UTC: {$parseBrasilia->copy()->setTimezone('UTC')->format('Y-m-d H:i:s')}\n";
        echo "\n     Está no DB como: {$ifoodDirect->placed_at}\n";
    }
    echo "\n";
}

if ($ifoodTakeat) {
    echo "2. iFood via TAKEAT (provider = takeat, origin = ifood):\n";
    echo "   Pedido: {$ifoodTakeat->code}\n";
    $rawDate = data_get($ifoodTakeat->raw, 'createdAt');
    echo "   raw.createdAt: " . ($rawDate ?: 'null') . "\n";
    echo "   placed_at (DB): {$ifoodTakeat->placed_at}\n\n";
}

// Buscar pedidos de novembro com provider = ifood
echo "=== PEDIDOS DE NOVEMBRO - iFood Direto ===\n\n";

$novOrders = Order::where('provider', 'ifood')
    ->whereBetween('placed_at', ['2025-11-01 00:00:00', '2025-11-30 23:59:59'])
    ->orderBy('placed_at', 'desc')
    ->take(5)
    ->get();

echo "Total: " . $novOrders->count() . "\n\n";

foreach ($novOrders as $order) {
    $rawDate = data_get($order->raw, 'createdAt');
    $utc = Carbon::parse($order->placed_at);
    $brasilia = $utc->copy()->setTimezone('America/Sao_Paulo');

    echo "Pedido {$order->code}:\n";
    echo "  raw.createdAt: {$rawDate}\n";
    echo "  Formato: " . (str_contains($rawDate ?? '', 'Z') ? 'Com Z' : 'Sem Z') . "\n";
    echo "  DB (UTC): {$utc->format('Y-m-d H:i:s')}\n";
    echo "  Brasília: {$brasilia->format('Y-m-d H:i:s')}\n";

    if ($rawDate && !str_contains($rawDate, 'Z')) {
        // Se não tem Z, foi parseado errado
        $correct = Carbon::parse($rawDate, 'America/Sao_Paulo')->setTimezone('UTC');
        echo "  DEVERIA SER (UTC): {$correct->format('Y-m-d H:i:s')}\n";
        echo "  ⚠️ DIFERENÇA DE " . $utc->diffInHours($correct) . " horas\n";
    }
    echo "\n";
}
