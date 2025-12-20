<?php

require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

echo "Testando nova lógica de provider para taxas inline:\n";
echo "====================================================\n\n";

// Simular diferentes cenários
$scenarios = [
    ['provider' => 'takeat', 'origin' => 'ifood', 'expected' => 'takeat-ifood'],
    ['provider' => 'takeat', 'origin' => '99food', 'expected' => 'takeat-99food'],
    ['provider' => 'takeat', 'origin' => 'neemo', 'expected' => 'takeat-neemo'],
    ['provider' => 'takeat', 'origin' => 'keeta', 'expected' => 'takeat-keeta'],
    ['provider' => 'takeat', 'origin' => 'balcony', 'expected' => 'takeat'],
    ['provider' => 'takeat', 'origin' => 'totem', 'expected' => 'takeat'],
    ['provider' => 'takeat', 'origin' => 'pdv', 'expected' => 'takeat'],
    ['provider' => 'takeat', 'origin' => 'takeat', 'expected' => 'takeat'],
    ['provider' => 'ifood', 'origin' => null, 'expected' => 'ifood'],
];

echo "Cenários de provider:\n";
echo "---------------------\n\n";

foreach ($scenarios as $scenario) {
    $provider = $scenario['provider'];
    $origin = $scenario['origin'];
    $expected = $scenario['expected'];

    // Lógica do frontend
    $integratedMarketplaces = ['ifood', '99food', 'neemo', 'keeta'];

    if ($provider !== 'takeat' || !$origin) {
        $result = $provider;
    } elseif (in_array($origin, $integratedMarketplaces)) {
        $result = "takeat-{$origin}";
    } else {
        $result = 'takeat';
    }

    $status = $result === $expected ? '✓' : '✗';

    echo "{$status} Provider: {$provider}, Origin: " . ($origin ?? 'null') . "\n";
    echo "   Esperado: {$expected}\n";
    echo "   Resultado: {$result}\n";
    echo "---\n\n";
}

// Verificar pedidos reais e suas origens
echo "Pedidos reais por origin:\n";
echo "-------------------------\n\n";

$orders = \App\Models\Order::where('tenant_id', 1)
    ->where('provider', 'takeat')
    ->select('origin', \DB::raw('COUNT(*) as count'))
    ->groupBy('origin')
    ->get();

foreach ($orders as $order) {
    $integratedMarketplaces = ['ifood', '99food', 'neemo', 'keeta'];
    $shouldUseProvider = in_array($order->origin, $integratedMarketplaces)
        ? "takeat-{$order->origin}"
        : 'takeat';

    echo "Origin: {$order->origin} ({$order->count} pedidos)\n";
    echo "Provider a ser usado: {$shouldUseProvider}\n";
    echo "---\n\n";
}

// Verificar taxas existentes
echo "Taxas de pagamento cadastradas:\n";
echo "--------------------------------\n\n";

$taxes = \App\Models\CostCommission::where('tenant_id', 1)
    ->where('applies_to', 'payment_method')
    ->get(['id', 'name', 'provider', 'active']);

foreach ($taxes as $tax) {
    echo "#{$tax->id} - {$tax->name}\n";
    echo "Provider: " . ($tax->provider ?? 'todos') . "\n";
    echo "Ativo: " . ($tax->active ? 'Sim' : 'Não') . "\n";
    echo "---\n\n";
}
