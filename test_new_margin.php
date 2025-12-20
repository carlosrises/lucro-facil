<?php

require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

echo "Testando nova fórmula de margem - Pedido 66:\n";
echo "=============================================\n\n";

$order = \App\Models\Order::with('items.internalProduct.taxCategory', 'items.mappings.internalProduct.taxCategory')->find(66);

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

echo "Valores:\n";
echo "--------\n";
echo "Net Total: R$ " . number_format($netTotal, 2, ',', '.') . "\n";
echo "Delivery Fee: R$ " . number_format($deliveryFee, 2, ',', '.') . "\n";
echo "Subsídio: R$ " . number_format($totalSubsidy, 2, ',', '.') . "\n";
echo "CMV: R$ " . number_format($cmv, 2, ',', '.') . "\n";
echo "Impostos: R$ " . number_format($totalTax, 2, ',', '.') . "\n";
echo "Custos: R$ " . number_format($totalCosts, 2, ',', '.') . "\n";
echo "Comissões: R$ " . number_format($totalCommissions, 2, ',', '.') . "\n";
echo "Taxas pagamento: R$ " . number_format($totalPaymentMethodFee, 2, ',', '.') . "\n\n";

// Nova fórmula do DataTable
$subtotal = $netTotal + $totalSubsidy + $deliveryFee;
$netRevenue = $subtotal - $cmv - $totalTax - $totalCosts - $totalCommissions - $totalPaymentMethodFee;
$margin = ($netRevenue / $subtotal) * 100;

echo "NOVO CÁLCULO DataTable:\n";
echo "=======================\n";
echo "Subtotal: R$ " . number_format($subtotal, 2, ',', '.') . "\n";
echo "Receita líquida: R$ " . number_format($netRevenue, 2, ',', '.') . "\n";
echo "MARGEM: " . number_format($margin, 1, ',', '.') . "%\n\n";

// Comparar com detalhamento financeiro
echo "DETALHAMENTO FINANCEIRO:\n";
echo "========================\n";
$paidByClient = $netTotal;
$subtotalFinancial = $paidByClient + $totalSubsidy + $deliveryFee;
$netRevenueFinancial = $subtotalFinancial - $cmv - $totalTax - $totalCosts - $totalCommissions - $totalPaymentMethodFee;
$marginFinancial = ($netRevenueFinancial / $subtotalFinancial) * 100;

echo "Subtotal: R$ " . number_format($subtotalFinancial, 2, ',', '.') . "\n";
echo "Receita líquida: R$ " . number_format($netRevenueFinancial, 2, ',', '.') . "\n";
echo "MARGEM: " . number_format($marginFinancial, 1, ',', '.') . "%\n\n";

if (abs($margin - $marginFinancial) < 0.1) {
    echo "✓ VALORES IGUAIS - Correção aplicada com sucesso!\n";
} else {
    echo "✗ Ainda há diferença: " . number_format($margin - $marginFinancial, 1, ',', '.') . "pp\n";
}
