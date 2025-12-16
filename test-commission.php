<?php

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$order = \App\Models\Order::where('provider', 'takeat')->where('origin', '99food')->first();

if (!$order) {
    echo "Nenhum pedido encontrado\n";
    exit;
}

echo "Pedido #{$order->id}\n";
echo "Provider: {$order->provider}\n";
echo "Origin: {$order->origin}\n";
echo "Net Total: {$order->net_total}\n\n";

// Buscar comissões manualmente
$costCommissions = \App\Models\CostCommission::where('tenant_id', $order->tenant_id)
    ->where('active', true)
    ->where(function($q) use ($order) {
        $q->whereNull('provider')
          ->orWhere('provider', $order->provider)
          ->orWhere('provider', $order->origin);
    })
    ->get();

echo "Comissões encontradas: " . $costCommissions->count() . "\n";
foreach ($costCommissions as $comm) {
    echo "- {$comm->name} (provider: {$comm->provider}, category: {$comm->category})\n";
}

echo "\n\nCalculando custos...\n";
$costService = new \App\Services\OrderCostService();
$result = $costService->calculateCosts($order);

echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
