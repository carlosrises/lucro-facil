<?php

require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

echo "Criando taxa de pagamento Crédito para Takeat próprio:\n";
echo "======================================================\n\n";

// Criar taxa semelhante à Stone Crédito, mas para takeat próprio
$tax = \App\Models\CostCommission::create([
    'tenant_id' => 1,
    'name' => 'Taxa Crédito Takeat',
    'category' => 'payment_method',
    'provider' => 'takeat',
    'type' => 'percentage',
    'value' => 3.00, // 3% (ajustar conforme necessário)
    'applies_to' => 'payment_method',
    'payment_type' => 'offline',
    'condition_values' => ['CREDIT_CARD'],
    'affects_revenue_base' => false,
    'enters_tax_base' => false,
    'reduces_revenue_base' => false,
    'active' => true,
]);

echo "Taxa criada com sucesso!\n";
echo "ID: {$tax->id}\n";
echo "Nome: {$tax->name}\n";
echo "Provider: {$tax->provider}\n";
echo "Tipo: {$tax->type}\n";
echo "Valor: {$tax->value}%\n";
echo "Payment Type: {$tax->payment_type}\n";
echo "Condition Values: " . json_encode($tax->condition_values) . "\n\n";

echo "Recalculando pedido 66...\n";
$order = \App\Models\Order::find(66);
$service = new \App\Services\OrderCostService();
$costs = $service->calculateCosts($order);

// Atualizar o pedido
$order->calculated_costs = $costs;
$order->total_costs = $costs['total_costs'];
$order->total_commissions = $costs['total_commissions'];
$order->net_revenue = $costs['net_revenue'];
$order->costs_calculated_at = now();
$order->save();

echo "Pedido recalculado!\n\n";

echo "Taxas de pagamento aplicadas:\n";
foreach ($costs['payment_methods'] ?? [] as $tax) {
    echo "  - {$tax['name']}: R$ " . number_format($tax['calculated_value'], 2, ',', '.') . "\n";
}

echo "\nTotal de taxas: R$ " . number_format($costs['total_payment_methods'] ?? 0, 2, ',', '.') . "\n";
