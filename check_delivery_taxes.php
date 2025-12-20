<?php

require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

echo "Taxas de entrega cadastradas:\n";
echo "====================================\n\n";

$taxes = \App\Models\CostCommission::where('tenant_id', 1)
    ->where('name', 'like', '%entrega%')
    ->get(['id', 'name', 'provider', 'applies_to', 'type', 'value', 'active']);

if ($taxes->isEmpty()) {
    echo "Nenhuma taxa de entrega cadastrada.\n";
} else {
    foreach ($taxes as $tax) {
        echo "ID: {$tax->id}\n";
        echo "Nome: {$tax->name}\n";
        echo "Provider: " . ($tax->provider ?? 'todos') . "\n";
        echo "Aplica-se a: {$tax->applies_to}\n";
        echo "Tipo: {$tax->type}\n";
        echo "Valor: {$tax->value}\n";
        echo "Ativo: " . ($tax->active ? 'Sim' : 'Não') . "\n";
        echo "---\n";
    }
}

echo "\nVerificando lógica de aplicação:\n";
echo "====================================\n\n";

// Verificar pedidos delivery
$deliveryOrders = \App\Models\Order::where('tenant_id', 1)
    ->whereRaw("JSON_UNQUOTE(JSON_EXTRACT(raw, '$.session.table.table_type')) = 'delivery'")
    ->limit(5)
    ->get(['id', 'code', 'provider', 'origin', 'delivery_fee', 'raw']);

echo "Pedidos delivery (até 5):\n\n";
foreach ($deliveryOrders as $order) {
    $deliveryBy = $order->raw['session']['delivery_by'] ?? null;
    $tableType = $order->raw['session']['table']['table_type'] ?? null;

    echo "Pedido #{$order->id} - {$order->code}\n";
    echo "Provider: {$order->provider}\n";
    echo "Origin: {$order->origin}\n";
    echo "Table Type: {$tableType}\n";
    echo "Delivery By: {$deliveryBy}\n";
    echo "Delivery Fee: R$ " . number_format($order->delivery_fee, 2, ',', '.') . "\n";
    echo "Condição para aplicar taxa: table_type='delivery' AND delivery_by='MERCHANT'\n";
    echo "Aplica taxa? " . ($tableType === 'delivery' && $deliveryBy === 'MERCHANT' ? 'SIM' : 'NÃO') . "\n";
    echo "---\n";
}
