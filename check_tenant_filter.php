<?php

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make('Illuminate\Contracts\Console\Kernel');
$kernel->bootstrap();

use App\Models\Order;
use App\Models\User;
use Carbon\Carbon;

echo "=== TESTE COM TENANT_ID ===\n\n";

$user = User::first();

if (!$user) {
    echo "Nenhum usuário encontrado!\n";
    exit;
}

echo "Usuário: {$user->name}\n";
echo "Tenant ID: {$user->tenant_id}\n\n";

// Simular filtro exato
$startDate = '2025-12-01';
$endDate = '2025-12-31';

$startDateUtc = Carbon::parse($startDate . ' 00:00:00', 'America/Sao_Paulo')->setTimezone('UTC')->toDateTimeString();
$endDateUtc = Carbon::parse($endDate . ' 23:59:59', 'America/Sao_Paulo')->setTimezone('UTC')->toDateTimeString();

echo "Filtro UTC: {$startDateUtc} a {$endDateUtc}\n\n";

// SEM tenant_id (como estava antes?)
$withoutTenant = Order::whereBetween('placed_at', [$startDateUtc, $endDateUtc])
    ->count();

echo "SEM filtro de tenant: {$withoutTenant} pedidos\n";

// COM tenant_id (correto)
$withTenant = Order::where('tenant_id', $user->tenant_id)
    ->whereBetween('placed_at', [$startDateUtc, $endDateUtc])
    ->count();

echo "COM filtro de tenant: {$withTenant} pedidos\n\n";

// Verificar se OrdersController está filtrando por tenant
echo "=== VERIFICANDO ORDERSCONTROLLER ===\n\n";

$controllerFile = file_get_contents(__DIR__ . '/app/Http/Controllers/OrdersController.php');

if (strpos($controllerFile, 'tenant_id()') !== false) {
    echo "✓ OrdersController usa tenant_id()\n";
} else {
    echo "⚠️ OrdersController NÃO usa tenant_id() - PROBLEMA!\n";
}

// Buscar pedidos de novembro no filtro (global)
$novemberGlobal = Order::whereBetween('placed_at', [$startDateUtc, $endDateUtc])
    ->whereRaw("DATE(CONVERT_TZ(placed_at, '+00:00', '-03:00')) < '2025-12-01'")
    ->count();

echo "\nPedidos de novembro (sem tenant): {$novemberGlobal}\n";

// Com tenant
$novemberTenant = Order::where('tenant_id', $user->tenant_id)
    ->whereBetween('placed_at', [$startDateUtc, $endDateUtc])
    ->whereRaw("DATE(CONVERT_TZ(placed_at, '+00:00', '-03:00')) < '2025-12-01'")
    ->count();

echo "Pedidos de novembro (com tenant): {$novemberTenant}\n";
