<?php

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use App\Models\Order;
use Carbon\Carbon;

echo "=== ANÁLISE DE FORMATOS DE DATA POR PROVIDER/ORIGIN ===\n\n";

// Buscar pedidos de diferentes origens
$ifoodNormal = Order::where('provider', 'ifood')
    ->where('origin', '!=', 'DIRECT_SALE')
    ->whereNotNull('raw')
    ->orderBy('placed_at', 'desc')
    ->first();

$ifoodDirect = Order::where('provider', 'ifood')
    ->where('origin', 'DIRECT_SALE')
    ->whereNotNull('raw')
    ->orderBy('placed_at', 'desc')
    ->first();

$takeat = Order::where('provider', 'takeat')
    ->whereNotNull('raw')
    ->orderBy('placed_at', 'desc')
    ->first();

if ($ifoodNormal) {
    echo "1. iFood NORMAL (Marketplace):\n";
    echo "   Pedido: {$ifoodNormal->code}\n";
    echo "   Origin: {$ifoodNormal->origin}\n";
    $rawDate = data_get($ifoodNormal->raw, 'createdAt');
    echo "   raw.createdAt: {$rawDate}\n";
    echo "   Formato: " . (str_contains($rawDate, 'Z') ? 'ISO com Z (UTC)' : 'Sem indicador de timezone') . "\n";
    echo "   placed_at (DB): {$ifoodNormal->placed_at}\n\n";
}

if ($ifoodDirect) {
    echo "2. iFood DIRETO:\n";
    echo "   Pedido: {$ifoodDirect->code}\n";
    echo "   Origin: {$ifoodDirect->origin}\n";
    $rawDate = data_get($ifoodDirect->raw, 'createdAt');
    echo "   raw.createdAt: {$rawDate}\n";
    echo "   Formato: " . (str_contains($rawDate, 'Z') ? 'ISO com Z (UTC)' : 'Sem indicador de timezone') . "\n";
    echo "   placed_at (DB): {$ifoodDirect->placed_at}\n";

    // Testar as duas interpretações
    if ($rawDate) {
        echo "\n   Teste de interpretação:\n";

        $asUtc = Carbon::parse($rawDate);
        echo "     Como UTC: {$asUtc->format('Y-m-d H:i:s')} UTC\n";
        echo "               {$asUtc->setTimezone('America/Sao_Paulo')->format('Y-m-d H:i:s')} Brasília\n";

        $asBrasilia = Carbon::parse($rawDate, 'America/Sao_Paulo');
        echo "     Como Brasília: {$asBrasilia->format('Y-m-d H:i:s')} Brasília\n";
        echo "                    {$asBrasilia->setTimezone('UTC')->format('Y-m-d H:i:s')} UTC\n";

        echo "\n   Qual está no DB? {$ifoodDirect->placed_at}\n";
        echo "   Deveria ser (UTC): " . $asBrasilia->setTimezone('UTC')->format('Y-m-d H:i:s') . "\n";
    }
    echo "\n";
}

if ($takeat) {
    echo "3. Takeat:\n";
    echo "   Pedido: {$takeat->code}\n";
    $rawDate = data_get($takeat->raw, 'createdAt');
    echo "   raw.createdAt: " . ($rawDate ?: 'null') . "\n";
    echo "   placed_at (DB): {$takeat->placed_at}\n\n";
}

// Buscar pedidos de novembro do iFood Direto
echo "\n=== PEDIDOS DE NOVEMBRO - iFood Direto ===\n\n";

$novOrders = Order::where('provider', 'ifood')
    ->where('origin', 'DIRECT_SALE')
    ->whereBetween('placed_at', ['2025-11-27 00:00:00', '2025-11-27 23:59:59'])
    ->orderBy('placed_at', 'desc')
    ->take(5)
    ->get();

foreach ($novOrders as $order) {
    $rawDate = data_get($order->raw, 'createdAt');
    $utc = Carbon::parse($order->placed_at);
    $brasilia = $utc->copy()->setTimezone('America/Sao_Paulo');

    echo "Pedido {$order->code}:\n";
    echo "  raw.createdAt: {$rawDate}\n";
    echo "  DB (UTC): {$utc->format('Y-m-d H:i:s')}\n";
    echo "  Brasília: {$brasilia->format('Y-m-d H:i:s')}\n";
    echo "  Dia em Brasília: {$brasilia->format('d/m')}\n\n";
}
