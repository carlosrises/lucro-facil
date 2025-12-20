<?php

require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

echo "Verificando correções:\n";
echo "======================\n\n";

// 1. Verificar taxa de entrega no pedido 66
echo "1. TAXA DE ENTREGA - Pedido 66\n";
echo "-------------------------------\n";
$order66 = \App\Models\Order::find(66);
$costs = is_array($order66->calculated_costs) ? $order66->calculated_costs : json_decode($order66->calculated_costs, true);

$deliveryTax = collect($costs['costs'] ?? [])->firstWhere('id', 21);
if ($deliveryTax) {
    echo "✓ Taxa de entrega aplicada: R$ " . number_format($deliveryTax['calculated_value'], 2, ',', '.') . "\n";
} else {
    echo "✗ Taxa de entrega NÃO aplicada\n";
}

// 2. Verificar filtro de pedidos sem taxa de pagamento
echo "\n2. FILTRO SEM TAXA DE PAGAMENTO\n";
echo "--------------------------------\n";

$noPaymentTaxOrders = \App\Models\Order::where('tenant_id', 1)
    ->where(function ($query) {
        // 1. Sem método de pagamento
        $query->where(function ($q) {
            $q->where('provider', 'takeat')
                ->whereRaw("JSON_LENGTH(JSON_EXTRACT(raw, '$.session.payments')) = 0 OR JSON_EXTRACT(raw, '$.session.payments') IS NULL");
        })
        // 2. OU com método mas sem taxa aplicada
        ->orWhere(function ($q) {
            $q->whereRaw("JSON_LENGTH(JSON_EXTRACT(calculated_costs, '$.payment_methods')) = 0 OR JSON_EXTRACT(calculated_costs, '$.payment_methods') IS NULL");
        });
    })
    ->get(['id', 'code', 'provider', 'origin']);

echo "Total de pedidos sem taxa de pagamento: " . $noPaymentTaxOrders->count() . "\n\n";

echo "Pedidos sem taxa de pagamento vinculada:\n";
foreach ($noPaymentTaxOrders->take(10) as $order) {
    echo "  - #{$order->id} - {$order->code} ({$order->origin})\n";
}

echo "\nPedido 66 aparece? " . ($noPaymentTaxOrders->contains('id', 66) ? '✓ SIM' : '✗ NÃO') . "\n";

// 3. Verificar quantos pedidos delivery tiveram a taxa aplicada
echo "\n3. PEDIDOS DELIVERY COM TAXA APLICADA\n";
echo "--------------------------------------\n";

$deliveryOrders = \App\Models\Order::where('tenant_id', 1)
    ->whereRaw("JSON_UNQUOTE(JSON_EXTRACT(raw, '$.session.table.table_type')) = 'delivery'")
    ->get(['id', 'code', 'delivery_fee', 'calculated_costs', 'raw']);

$withTax = 0;
$withoutTax = 0;

foreach ($deliveryOrders as $order) {
    $costs = is_array($order->calculated_costs) ? $order->calculated_costs : json_decode($order->calculated_costs, true);
    $deliveryTax = collect($costs['costs'] ?? [])->firstWhere('id', 21);

    if ($deliveryTax) {
        $withTax++;
    } else {
        $withoutTax++;
        $deliveryBy = $order->raw['session']['delivery_by'] ?? null;
        echo "  ⚠️ Sem taxa: #{$order->id} - delivery_by: " . ($deliveryBy ?: 'vazio') . ", delivery_fee: {$order->delivery_fee}\n";
    }
}

echo "\nTotal delivery: " . $deliveryOrders->count() . "\n";
echo "Com taxa aplicada: {$withTax}\n";
echo "Sem taxa aplicada: {$withoutTax}\n";
