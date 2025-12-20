<?php

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Order;

$order = Order::find(61);

if ($order) {
    echo "=== PEDIDO 61 - Calculated Costs ===\n";
    echo "Provider: {$order->provider}\n";
    echo "Origin: {$order->origin}\n";
    echo "Net Total: R$ {$order->net_total}\n";

    $calculatedCosts = $order->calculated_costs;
    $totalPM = isset($calculatedCosts['total_payment_methods']) ? $calculatedCosts['total_payment_methods'] : 0;
    echo "Total Payment Methods: R$ {$totalPM}\n\n";

    if (isset($calculatedCosts['payment_methods'])) {
        echo "Taxas de pagamento aplicadas:\n";
        foreach ($calculatedCosts['payment_methods'] as $pm) {
            echo "- {$pm['name']}: R$ {$pm['calculated_value']}\n";
        }
    } else {
        echo "Nenhuma taxa de pagamento aplicada\n";
    }
}
