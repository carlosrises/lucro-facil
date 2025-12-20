<?php

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Order;

$order = Order::find(32);

if ($order) {
    echo "=== PEDIDO 32 (Voucher) ===\n";
    $calculatedCosts = $order->calculated_costs;
    $totalPM = isset($calculatedCosts['total_payment_methods']) ? $calculatedCosts['total_payment_methods'] : 0;
    echo "Total Payment Methods: R$ {$totalPM}\n\n";

    if (isset($calculatedCosts['payment_methods'])) {
        foreach ($calculatedCosts['payment_methods'] as $pm) {
            echo "- {$pm['name']}: R$ {$pm['calculated_value']}\n";
        }
    }
}
