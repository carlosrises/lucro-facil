<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

class FinancialAggregationService
{
    public function __construct(private OrderCostService $orderCostService) {}

    /**
     * Calcula todos os valores financeiros de forma otimizada usando chunk e agregação
     */
    public function calculatePeriodTotals($baseQuery, int $tenantId, string $startDateUtc, string $endDateUtc): array
    {
        // CMV via SQL agregado usando subquery para manter os filtros
        // Primeiro, obter os IDs dos pedidos filtrados
        $orderIds = (clone $baseQuery)
            ->whereBetween('placed_at', [$startDateUtc, $endDateUtc])
            ->pluck('id');

        // Calcular CMV apenas para os pedidos filtrados
        $cmvData = DB::table('order_items')
            ->join('order_item_mappings', 'order_item_mappings.order_item_id', '=', 'order_items.id')
            ->join('internal_products', 'internal_products.id', '=', 'order_item_mappings.internal_product_id')
            ->whereIn('order_items.order_id', $orderIds)
            ->selectRaw('
                SUM(
                    order_items.qty * order_item_mappings.quantity *
                    COALESCE(order_item_mappings.unit_cost_override, internal_products.unit_cost)
                ) as total_cmv
            ')
            ->first();

        $totalCmv = (float) ($cmvData->total_cmv ?? 0);

        // Inicializar totais
        $totalRevenue = 0;
        $totalProductTax = 0;
        $totalAdditionalTaxes = 0;
        $totalRecalculatedCosts = 0;
        $totalRecalculatedCommissions = 0;
        $totalRecalculatedPaymentFees = 0;
        $totalOrders = 0;

        // Processar pedidos em chunks - usar baseQuery com filtro de data
        (clone $baseQuery)
            ->whereBetween('placed_at', [$startDateUtc, $endDateUtc])
            ->select(['id', 'calculated_costs', 'raw', 'delivery_fee', 'net_total', 'provider'])
            ->with(['items.internalProduct.taxCategory'])
            ->chunkById(200, function ($orders) use (
                &$totalRevenue,
                &$totalProductTax,
                &$totalAdditionalTaxes,
                &$totalRecalculatedCosts,
                &$totalRecalculatedCommissions,
                &$totalRecalculatedPaymentFees,
                &$totalOrders
            ) {
                foreach ($orders as $order) {
                    $totalOrders++;

                    // Calcular subtotal usando OrderCostService - FONTE ÚNICA DE VERDADE
                    $orderSubtotal = $this->orderCostService->getOrderSubtotal($order);
                    $totalRevenue += $orderSubtotal;

                    // Calcular impostos dos produtos
                    $items = $order->items ?? [];
                    $taxCategories = [];
                    $totalItemsPrice = 0;

                    foreach ($items as $item) {
                        $internalProduct = $item->internalProduct;
                        if (! $internalProduct || ! $internalProduct->taxCategory) {
                            continue;
                        }

                        $quantity = $item->qty ?? $item->quantity ?? 0;
                        $unitPrice = $item->unit_price ?? $item->price ?? 0;
                        $itemTotal = $quantity * $unitPrice;
                        $totalItemsPrice += $itemTotal;

                        $taxCategoryId = $internalProduct->taxCategory->id;

                        if (isset($taxCategories[$taxCategoryId])) {
                            $taxCategories[$taxCategoryId]['itemsTotal'] += $itemTotal;
                        } else {
                            $taxCategories[$taxCategoryId] = [
                                'rate' => $internalProduct->taxCategory->total_tax_rate,
                                'itemsTotal' => $itemTotal,
                            ];
                        }
                    }

                    // Calcular imposto proporcional ao subtotal
                    foreach ($taxCategories as $category) {
                        $proportion = $totalItemsPrice > 0 ? ($category['itemsTotal'] / $totalItemsPrice) : 0;
                        $taxValue = ($orderSubtotal * $proportion * $category['rate']) / 100;
                        $totalProductTax += $taxValue;
                    }

                    // Processar calculated_costs
                    $calculatedCosts = is_array($order->calculated_costs)
                        ? $order->calculated_costs
                        : ($order->calculated_costs ? json_decode($order->calculated_costs, true) : []);

                    // Impostos adicionais - recalcular percentuais para alinhar com frontend
                    foreach (($calculatedCosts['taxes'] ?? []) as $tax) {
                        if (! is_array($tax)) {
                            continue;
                        }
                        if (($tax['type'] ?? '') === 'percentage') {
                            $value = (float) ($tax['value'] ?? 0);
                            $totalAdditionalTaxes += ($orderSubtotal * $value) / 100;
                        } else {
                            $totalAdditionalTaxes += (float) ($tax['calculated_value'] ?? 0);
                        }
                    }

                    // Custos operacionais - recalcular percentuais para alinhar com frontend
                    foreach (($calculatedCosts['costs'] ?? []) as $cost) {
                        if (! is_array($cost)) {
                            continue;
                        }
                        if (($cost['type'] ?? '') === 'percentage') {
                            $value = (float) ($cost['value'] ?? 0);
                            $totalRecalculatedCosts += ($orderSubtotal * $value) / 100;
                        } else {
                            $totalRecalculatedCosts += (float) ($cost['calculated_value'] ?? 0);
                        }
                    }

                    // Comissões - recalcular percentuais para alinhar com frontend
                    foreach (($calculatedCosts['commissions'] ?? []) as $commission) {
                        if (! is_array($commission)) {
                            continue;
                        }
                        if (($commission['type'] ?? '') === 'percentage') {
                            $value = (float) ($commission['value'] ?? 0);
                            $totalRecalculatedCommissions += ($orderSubtotal * $value) / 100;
                        } else {
                            $totalRecalculatedCommissions += (float) ($commission['calculated_value'] ?? 0);
                        }
                    }

                    // Taxas de pagamento - recalcular percentuais para alinhar com frontend
                    foreach (($calculatedCosts['payment_methods'] ?? []) as $payment) {
                        if (! is_array($payment)) {
                            continue;
                        }
                        if (($payment['type'] ?? '') === 'percentage') {
                            $value = (float) ($payment['value'] ?? 0);
                            $totalRecalculatedPaymentFees += ($orderSubtotal * $value) / 100;
                        } else {
                            $totalRecalculatedPaymentFees += (float) ($payment['calculated_value'] ?? 0);
                        }
                    }
                }
            });

        return [
            'total_revenue' => $totalRevenue,
            'total_cmv' => $totalCmv,
            'total_product_tax' => $totalProductTax,
            'total_additional_taxes' => $totalAdditionalTaxes,
            'total_taxes' => $totalProductTax + $totalAdditionalTaxes,
            'total_recalculated_costs' => $totalRecalculatedCosts,
            'total_recalculated_commissions' => $totalRecalculatedCommissions,
            'total_recalculated_payment_fees' => $totalRecalculatedPaymentFees,
            'total_orders' => $totalOrders,
        ];
    }
}
