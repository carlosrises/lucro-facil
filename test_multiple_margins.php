<?php

require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

echo "Testando margem em vários pedidos:\n";
echo "===================================\n\n";

$orders = \App\Models\Order::where('tenant_id', 1)
    ->with('items.internalProduct.taxCategory', 'items.mappings.internalProduct.taxCategory')
    ->whereIn('id', [29, 31, 35, 66, 78]) // Pedidos com diferentes características
    ->get();

foreach ($orders as $order) {
    $netTotal = floatval($order->net_total);
    $deliveryFee = floatval($order->delivery_fee);
    $totalCosts = floatval($order->total_costs ?? 0);
    $totalCommissions = floatval($order->total_commissions ?? 0);

    // Subsídio
    $payments = $order->raw['session']['payments'] ?? [];
    $totalSubsidy = 0;
    foreach ($payments as $payment) {
        $paymentName = strtolower($payment['payment_method']['name'] ?? '');
        $paymentKeyword = strtolower($payment['payment_method']['keyword'] ?? '');
        if (strpos($paymentName, 'subsid') !== false || strpos($paymentName, 'cupom') !== false ||
            strpos($paymentKeyword, 'subsid') !== false || strpos($paymentKeyword, 'cupom') !== false) {
            $totalSubsidy += floatval($payment['payment_value'] ?? 0);
        }
    }

    // CMV
    $cmv = 0;
    foreach ($order->items as $item) {
        $itemQuantity = $item->qty ?? $item->quantity ?? 0;
        if ($item->mappings && count($item->mappings) > 0) {
            $mappingsCost = 0;
            foreach ($item->mappings as $mapping) {
                if ($mapping->internal_product && $mapping->internal_product->unit_cost) {
                    $unitCost = floatval($mapping->internal_product->unit_cost);
                    $mappingQuantity = $mapping->quantity ?? 1;
                    $mappingsCost += $unitCost * $mappingQuantity;
                }
            }
            $cmv += $mappingsCost * $itemQuantity;
        } elseif ($item->internal_product && $item->internal_product->unit_cost) {
            $unitCost = floatval($item->internal_product->unit_cost);
            $cmv += $unitCost * $itemQuantity;
        }
    }

    // Impostos
    $productTax = 0;
    foreach ($order->items as $item) {
        if ($item->internal_product && $item->internal_product->tax_category) {
            $quantity = $item->qty ?? $item->quantity ?? 0;
            $unitPrice = $item->unit_price ?? $item->price ?? 0;
            $taxRate = $item->internal_product->tax_category->total_tax_rate / 100;
            $productTax += $quantity * $unitPrice * $taxRate;
        }
    }

    $calculatedCosts = $order->calculated_costs;
    $additionalTaxes = $calculatedCosts['taxes'] ?? [];
    $totalAdditionalTax = array_reduce($additionalTaxes, fn($sum, $tax) => $sum + ($tax['calculated_value'] ?? 0), 0);
    $totalTax = $productTax + $totalAdditionalTax;

    // Taxas de pagamento
    $paymentMethodFees = $calculatedCosts['payment_methods'] ?? [];
    $totalPaymentMethodFee = array_reduce($paymentMethodFees, fn($sum, $fee) => $sum + ($fee['calculated_value'] ?? 0), 0);

    // Calcular margem
    $subtotal = $netTotal + $totalSubsidy + $deliveryFee;
    $netRevenue = $subtotal - $cmv - $totalTax - $totalCosts - $totalCommissions - $totalPaymentMethodFee;
    $margin = $subtotal > 0 ? ($netRevenue / $subtotal) * 100 : 0;

    echo "Pedido #{$order->id} - {$order->code} ({$order->origin})\n";
    echo "Net: R$ " . number_format($netTotal, 2, ',', '.') .
         " | Delivery: R$ " . number_format($deliveryFee, 2, ',', '.') .
         " | Subsídio: R$ " . number_format($totalSubsidy, 2, ',', '.') . "\n";
    echo "Subtotal: R$ " . number_format($subtotal, 2, ',', '.') .
         " | Líquido: R$ " . number_format($netRevenue, 2, ',', '.') .
         " | Margem: " . number_format($margin, 1, ',', '.') . "%\n";
    echo "---\n\n";
}
