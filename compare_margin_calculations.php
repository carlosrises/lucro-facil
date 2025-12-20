<?php

require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

echo "Comparando cálculo de margem - Pedido 66:\n";
echo "==========================================\n\n";

$order = \App\Models\Order::with('items.internalProduct.taxCategory', 'items.mappings.internalProduct.taxCategory')->find(66);

if (!$order) {
    echo "Pedido não encontrado!\n";
    exit;
}

// Valores base
$netTotal = floatval($order->net_total);
$grossTotal = floatval($order->gross_total);
$discountTotal = floatval($order->discount_total);
$deliveryFee = floatval($order->delivery_fee);

echo "Valores base do pedido:\n";
echo "------------------------\n";
echo "Gross Total: R$ " . number_format($grossTotal, 2, ',', '.') . "\n";
echo "Discount Total: R$ " . number_format($discountTotal, 2, ',', '.') . "\n";
echo "Delivery Fee: R$ " . number_format($deliveryFee, 2, ',', '.') . "\n";
echo "Net Total: R$ " . number_format($netTotal, 2, ',', '.') . "\n\n";

// Calcular subsídio
$payments = $order->raw['session']['payments'] ?? [];
$totalSubsidy = 0;

foreach ($payments as $payment) {
    $paymentName = strtolower($payment['payment_method']['name'] ?? '');
    $paymentKeyword = strtolower($payment['payment_method']['keyword'] ?? '');

    if (strpos($paymentName, 'subsid') !== false ||
        strpos($paymentName, 'cupom') !== false ||
        strpos($paymentKeyword, 'subsid') !== false ||
        strpos($paymentKeyword, 'cupom') !== false) {
        $totalSubsidy += floatval($payment['payment_value'] ?? 0);
    }
}

echo "Subsídio: R$ " . number_format($totalSubsidy, 2, ',', '.') . "\n\n";

// Calcular CMV
$cmv = 0;
foreach ($order->items as $item) {
    $itemQuantity = $item->qty ?? $item->quantity ?? 0;

    // Sistema novo: mappings
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
    }
    // Fallback: sistema legado
    elseif ($item->internal_product && $item->internal_product->unit_cost) {
        $unitCost = floatval($item->internal_product->unit_cost);
        $cmv += $unitCost * $itemQuantity;
    }
}

echo "CMV: R$ " . number_format($cmv, 2, ',', '.') . "\n\n";

// Calcular impostos dos produtos
$productTax = 0;
foreach ($order->items as $item) {
    if ($item->internal_product && $item->internal_product->tax_category) {
        $quantity = $item->qty ?? $item->quantity ?? 0;
        $unitPrice = $item->unit_price ?? $item->price ?? 0;
        $taxRate = $item->internal_product->tax_category->total_tax_rate / 100;
        $productTax += $quantity * $unitPrice * $taxRate;
    }
}

echo "Impostos dos produtos: R$ " . number_format($productTax, 2, ',', '.') . "\n\n";

// Impostos adicionais
$calculatedCosts = $order->calculated_costs;
$additionalTaxes = $calculatedCosts['taxes'] ?? [];
$totalAdditionalTax = array_reduce($additionalTaxes, fn($sum, $tax) => $sum + ($tax['calculated_value'] ?? 0), 0);

echo "Impostos adicionais: R$ " . number_format($totalAdditionalTax, 2, ',', '.') . "\n";
echo "Total de impostos: R$ " . number_format($productTax + $totalAdditionalTax, 2, ',', '.') . "\n\n";

// Custos operacionais
$totalCosts = floatval($order->total_costs ?? 0);
echo "Custos operacionais: R$ " . number_format($totalCosts, 2, ',', '.') . "\n\n";

// Comissões
$totalCommissions = floatval($order->total_commissions ?? 0);
echo "Comissões: R$ " . number_format($totalCommissions, 2, ',', '.') . "\n\n";

// Taxas de pagamento
$paymentMethodFees = $calculatedCosts['payment_methods'] ?? [];
$totalPaymentMethodFee = array_reduce($paymentMethodFees, fn($sum, $fee) => $sum + ($fee['calculated_value'] ?? 0), 0);
echo "Taxas de pagamento: R$ " . number_format($totalPaymentMethodFee, 2, ',', '.') . "\n\n";

// ============================================
// CÁLCULO DO DETALHAMENTO FINANCEIRO (order-financial-card.tsx)
// ============================================
echo "CÁLCULO 1 - Detalhamento Financeiro:\n";
echo "=====================================\n";

$paidByClient = $netTotal;
$subtotal = $paidByClient + $totalSubsidy + $deliveryFee;

echo "Pago pelo cliente: R$ " . number_format($paidByClient, 2, ',', '.') . "\n";
echo "Subtotal (pago + subsídio + delivery): R$ " . number_format($subtotal, 2, ',', '.') . "\n";

$netRevenue1 = $subtotal - $cmv - ($productTax + $totalAdditionalTax) - $totalCosts - $totalCommissions - $totalPaymentMethodFee;
$margin1 = ($netRevenue1 / $subtotal) * 100;

echo "Receita líquida: R$ " . number_format($netRevenue1, 2, ',', '.') . "\n";
echo "MARGEM: " . number_format($margin1, 1, ',', '.') . "%\n\n";

// ============================================
// CÁLCULO DA TABELA (columns.tsx)
// ============================================
echo "CÁLCULO 2 - DataTable:\n";
echo "======================\n";

$orderTotal = $netTotal; // Para Takeat usa net_total
echo "Order Total: R$ " . number_format($orderTotal, 2, ',', '.') . "\n";
echo "Total Subsidy: R$ " . number_format($totalSubsidy, 2, ',', '.') . "\n";

$netRevenue2 = $orderTotal + $totalSubsidy - $cmv - ($productTax + $totalAdditionalTax) - $totalCosts - $totalCommissions;
$margin2 = ($netRevenue2 / ($orderTotal + $totalSubsidy)) * 100;

echo "Receita líquida: R$ " . number_format($netRevenue2, 2, ',', '.') . "\n";
echo "MARGEM: " . number_format($margin2, 1, ',', '.') . "%\n\n";

// ============================================
// DIFERENÇAS
// ============================================
echo "DIFERENÇAS:\n";
echo "===========\n";

$diffSubtotal = $subtotal - ($orderTotal + $totalSubsidy);
$diffNetRevenue = $netRevenue1 - $netRevenue2;
$diffMargin = $margin1 - $margin2;

echo "Subtotal - DataTable base: R$ " . number_format($diffSubtotal, 2, ',', '.') . " (delivery_fee incluído no subtotal)\n";
echo "Receita líquida: R$ " . number_format($diffNetRevenue, 2, ',', '.') . " (taxas de pagamento não deduzidas no DataTable)\n";
echo "Margem: " . number_format($diffMargin, 1, ',', '.') . "pp\n\n";

echo "CONCLUSÃO:\n";
echo "==========\n";
echo "O detalhamento financeiro está CORRETO.\n";
echo "O DataTable precisa:\n";
echo "1. Adicionar delivery_fee à base de cálculo\n";
echo "2. Deduzir as taxas de pagamento (payment_methods)\n";
