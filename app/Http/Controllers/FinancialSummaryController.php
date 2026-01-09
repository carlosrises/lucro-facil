<?php

namespace App\Http\Controllers;

use App\Models\FinanceEntry;
use App\Models\Order;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Inertia\Inertia;

class FinancialSummaryController extends Controller
{
    public function index(Request $request)
    {
        $tenantId = tenant_id();

        // Filtro de período (mês atual por padrão)
        $month = $request->input('month', now()->format('Y-m'));
        [$year, $monthNum] = explode('-', $month);

        // Calcular primeiro e último dia do mês
        $startDate = Carbon::create($year, $monthNum, 1)->startOfDay();
        $endDate = Carbon::create($year, $monthNum, 1)->endOfMonth()->endOfDay();

        // 1. Buscar pedidos do período com relacionamentos
        $orders = Order::where('tenant_id', $tenantId)
            ->with(['items.internalProduct.taxCategory', 'items.mappings.internalProduct', 'store'])
            ->whereBetween('placed_at', [$startDate, $endDate])
            ->get();

        // 2. Inicializar acumuladores
        $totalRevenue = 0;
        $totalCmv = 0;
        $totalProductTax = 0;
        $totalAdditionalTax = 0;
        $totalCommissions = 0;
        $totalCosts = 0;
        $totalPaymentFees = 0;
        $totalDiscounts = 0;
        $totalSubsidies = 0;
        $revenueByStore = [];

        // 3. Processar cada pedido
        foreach ($orders as $order) {
            // Total do pedido: mesma lógica do detalhamento financeiro
            $revenue = 0;

            if ($order->provider === 'takeat') {
                // Takeat: usar total_delivery_price (inclui entrega e subsídios)
                if (isset($order->raw['session']['total_delivery_price'])) {
                    $revenue = (float) $order->raw['session']['total_delivery_price'];
                } elseif (isset($order->raw['session']['total_price'])) {
                    $revenue = (float) $order->raw['session']['total_price'];
                } else {
                    $revenue = (float) ($order->gross_total ?? 0);
                }
            } elseif (isset($order->raw['total']['orderAmount'])) {
                // iFood: orderAmount inclui produtos + entrega + taxas
                $revenue = (float) $order->raw['total']['orderAmount'];
            } else {
                // Fallback: usar gross_total
                $revenue = (float) ($order->gross_total ?? 0);
            }

            $totalRevenue += $revenue;

            // Agrupar por loja
            $storeName = $order->store->display_name ?? 'Desconhecido';
            if (! isset($revenueByStore[$storeName])) {
                $revenueByStore[$storeName] = 0;
            }
            $revenueByStore[$storeName] += $revenue;

            // Calcular CMV e Impostos dos produtos
            foreach ($order->items as $item) {
                $itemQuantity = $item->qty ?? $item->quantity ?? 0;

                // CMV
                if ($item->mappings && $item->mappings->count() > 0) {
                    foreach ($item->mappings as $mapping) {
                        if ($mapping->internalProduct && $mapping->internalProduct->unit_cost) {
                            $unitCost = (float) $mapping->internalProduct->unit_cost;
                            $mappingQuantity = $mapping->quantity ?? 1;
                            $totalCmv += $unitCost * $mappingQuantity * $itemQuantity;
                        }
                    }
                } elseif ($item->internalProduct && $item->internalProduct->unit_cost) {
                    $unitCost = (float) $item->internalProduct->unit_cost;
                    $totalCmv += $unitCost * $itemQuantity;
                }

                // Impostos dos produtos
                if ($item->internalProduct && $item->internalProduct->taxCategory) {
                    $taxRate = (float) ($item->internalProduct->taxCategory->total_tax_rate ?? 0);
                    if ($taxRate > 0) {
                        $unitPrice = (float) ($item->unit_price ?? 0);
                        $totalProductTax += ($itemQuantity * $unitPrice * $taxRate) / 100;
                    }
                }
            }

            // Custos do calculated_costs
            $costs = $order->calculated_costs;
            if ($costs) {
                // Impostos adicionais
                if (isset($costs['taxes']) && is_array($costs['taxes'])) {
                    foreach ($costs['taxes'] as $tax) {
                        $totalAdditionalTax += (float) ($tax['calculated_value'] ?? 0);
                    }
                }

                // Taxas de pagamento
                if (isset($costs['payment_methods']) && is_array($costs['payment_methods'])) {
                    foreach ($costs['payment_methods'] as $pm) {
                        $totalPaymentFees += (float) ($pm['calculated_value'] ?? 0);
                    }
                }
            }

            // Comissões
            $totalCommissions += (float) ($order->total_commissions ?? 0);

            // Custos operacionais
            $totalCosts += (float) ($order->total_costs ?? 0);

            // Descontos e Subsídios (mesma lógica do frontend)
            $discountTotal = (float) ($order->discount_total ?? 0);

            // Extrair subsídios dos pagamentos da sessão
            $sessionPayments = $order->raw['session']['payments'] ?? [];
            $subsidy = 0;

            foreach ($sessionPayments as $payment) {
                $paymentName = strtolower($payment['payment_method']['name'] ?? '');
                $paymentKeyword = strtolower($payment['payment_method']['keyword'] ?? '');

                // Verificar se é subsídio (contém "subsid" ou "cupom")
                if (str_contains($paymentName, 'subsid') ||
                    str_contains($paymentName, 'cupom') ||
                    str_contains($paymentKeyword, 'subsid') ||
                    str_contains($paymentKeyword, 'cupom')) {
                    $subsidy += (float) ($payment['payment_value'] ?? 0);
                }
            }

            // Desconto da loja = discount_total - subsídio
            $discount = $discountTotal - $subsidy;

            $totalDiscounts += $discount;
            $totalSubsidies += $subsidy;
        }

        // 4. Total de impostos
        $totalTaxes = $totalProductTax + $totalAdditionalTax;

        // 5. Formatar faturamento por loja
        $revenueByMarketplace = collect($revenueByStore)
            ->map(function ($value, $name) use ($totalRevenue) {
                return [
                    'name' => $name,
                    'value' => $value,
                    'percentage' => $totalRevenue > 0 ? round(($value / $totalRevenue) * 100, 1) : 0,
                ];
            })
            ->sortByDesc('value')
            ->values();

        // 6. Receitas extras (movimentações operacionais)
        $extraRevenue = (float) FinanceEntry::where('tenant_id', $tenantId)
            ->whereYear('occurred_on', $year)
            ->whereMonth('occurred_on', $monthNum)
            ->whereHas('category', function ($q) {
                $q->where('type', 'income');
            })
            ->sum('amount');

        // 7. Despesas operacionais extras (movimentações)
        $operationalExpenses = (float) FinanceEntry::where('tenant_id', $tenantId)
            ->whereYear('occurred_on', $year)
            ->whereMonth('occurred_on', $monthNum)
            ->whereHas('category', function ($q) {
                $q->where('type', 'expense');
            })
            ->sum('amount');

        // 8. Cálculos DRE
        // Faturamento
        $grossRevenue = $totalRevenue;

        // Deduções
        $paymentFees = $totalPaymentFees;
        $commissions = $totalCommissions;
        $discounts = $totalDiscounts;
        $subsidies = $totalSubsidies;

        // Receita pós Dedução = Faturamento - (Taxa de pagamento + Comissão Marketplace + Descontos) + Subsídios
        $revenueAfterDeductions = $grossRevenue - $paymentFees - $commissions - $discounts + $subsidies;
        $revenueAfterDeductionsPercent = $grossRevenue > 0 ? ($revenueAfterDeductions / $grossRevenue) * 100 : 0;

        // Custos
        $cmv = $totalCmv;
        $orderCosts = $totalCosts; // Despesas Operacionais
        $taxes = $totalTaxes;

        // Margem de Contribuição = Receita pós Dedução - CMV - Despesas Operacionais - Impostos
        $contributionMargin = $revenueAfterDeductions - $cmv - $orderCosts - $taxes;
        $contributionMarginPercent = $grossRevenue > 0 ? ($contributionMargin / $grossRevenue) * 100 : 0;

        // Movimentações financeiras
        $extraIncome = $extraRevenue; // Receitas (Movimentações Financeiras)
        $extraExpenses = $operationalExpenses; // Despesas (Movimentações Financeiras)

        // Lucro Líquido = Margem de Contribuição - Despesas + Receitas
        $netProfit = $contributionMargin - $extraExpenses + $extraIncome;
        $netProfitPercent = $grossRevenue > 0 ? ($netProfit / $grossRevenue) * 100 : 0;

        // Calcular porcentagens individuais
        $paymentFeesPercent = $grossRevenue > 0 ? ($paymentFees / $grossRevenue) * 100 : 0;
        $commissionsPercent = $grossRevenue > 0 ? ($commissions / $grossRevenue) * 100 : 0;
        $discountsPercent = $grossRevenue > 0 ? ($discounts / $grossRevenue) * 100 : 0;
        $subsidiesPercent = $grossRevenue > 0 ? ($subsidies / $grossRevenue) * 100 : 0;
        $cmvPercent = $grossRevenue > 0 ? ($cmv / $grossRevenue) * 100 : 0;
        $orderCostsPercent = $grossRevenue > 0 ? ($orderCosts / $grossRevenue) * 100 : 0;
        $taxesPercent = $grossRevenue > 0 ? ($taxes / $grossRevenue) * 100 : 0;
        $extraIncomePercent = $grossRevenue > 0 ? ($extraIncome / $grossRevenue) * 100 : 0;
        $extraExpensesPercent = $grossRevenue > 0 ? ($extraExpenses / $grossRevenue) * 100 : 0;

        return Inertia::render('financial/summary', [
            'data' => [
                // Receitas
                'grossRevenue' => $grossRevenue,
                'revenueByMarketplace' => $revenueByMarketplace,

                // Deduções
                'paymentFees' => $paymentFees,
                'paymentFeesPercent' => $paymentFeesPercent,
                'commissions' => $commissions,
                'commissionsPercent' => $commissionsPercent,
                'discounts' => $discounts,
                'discountsPercent' => $discountsPercent,
                'subsidies' => $subsidies,
                'subsidiesPercent' => $subsidiesPercent,

                // Resultado Intermediário
                'revenueAfterDeductions' => $revenueAfterDeductions,
                'revenueAfterDeductionsPercent' => $revenueAfterDeductionsPercent,

                // Custos
                'cmv' => $cmv,
                'cmvPercent' => $cmvPercent,
                'orderCosts' => $orderCosts, // Despesas Operacionais
                'orderCostsPercent' => $orderCostsPercent,
                'taxes' => $taxes,
                'taxesPercent' => $taxesPercent,

                // Margem
                'contributionMargin' => $contributionMargin,
                'contributionMarginPercent' => $contributionMarginPercent,

                // Movimentações Financeiras
                'extraIncome' => $extraIncome,
                'extraIncomePercent' => $extraIncomePercent,
                'extraExpenses' => $extraExpenses,
                'extraExpensesPercent' => $extraExpensesPercent,

                // Resultado Final
                'netProfit' => $netProfit,
                'netProfitPercent' => $netProfitPercent,
            ],
            'filters' => [
                'month' => $month,
            ],
        ]);
    }
}
