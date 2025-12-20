<?php

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

$orders = App\Models\Order::whereNotNull('calculated_costs')
    ->whereBetween('placed_at', ['2025-12-01 00:00:00', '2025-12-31 23:59:59'])
    ->limit(5)
    ->get();

echo "Total de pedidos: " . $orders->count() . PHP_EOL;
echo PHP_EOL;

foreach ($orders as $order) {
    $costs = $order->calculated_costs;
    echo "Order #{$order->id}:" . PHP_EOL;
    echo "  total_taxes: " . ($costs['total_taxes'] ?? '0') . PHP_EOL;
    echo "  total_commissions: " . ($costs['total_commissions'] ?? '0') . PHP_EOL;
    echo "  total_costs: " . ($costs['total_costs'] ?? '0') . PHP_EOL;
    echo "  total_payment_methods: " . ($costs['total_payment_methods'] ?? '0') . PHP_EOL;
    echo PHP_EOL;
}
