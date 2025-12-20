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
        $revenueByStore = [];

        // 3. Processar cada pedido
        foreach ($orders as $order) {
            // Calcular faturamento somando os itens (não usar gross_total que pode estar incorreto)
            $revenue = 0;
            foreach ($order->items as $item) {
                $itemPrice = (float) ($item->price ?? $item->unit_price ?? 0);
                $itemQuantity = (float) ($item->quantity ?? $item->qty ?? 1);
                $revenue += $itemPrice * $itemQuantity;
            }
            $totalRevenue += $revenue;

            // Agrupar por loja
            $storeName = $order->store->display_name ?? 'Desconhecido';
            if (!isset($revenueByStore[$storeName])) {
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
        // Receita Bruta
        $grossRevenue = $totalRevenue;

        // (-) CMV
        $cmv = $totalCmv;

        // (=) Lucro Bruto (Margem de Contribuição)
        $grossProfit = $grossRevenue - $cmv;
        $grossProfitPercent = $grossRevenue > 0 ? ($grossProfit / $grossRevenue) * 100 : 0;

        // (-) Impostos
        $taxes = $totalTaxes;

        // (=) Resultado após impostos
        $resultAfterTaxes = $grossProfit - $taxes;

        // (-) Comissões
        $commissions = $totalCommissions;

        // (-) Taxas de pagamento
        $paymentFees = $totalPaymentFees;

        // (-) Custos operacionais dos pedidos
        $orderCosts = $totalCosts;

        // (=) Lucro Operacional dos Pedidos (antes de receitas/despesas extras)
        $operationalProfit = $resultAfterTaxes - $commissions - $paymentFees - $orderCosts;
        $operationalProfitPercent = $grossRevenue > 0 ? ($operationalProfit / $grossRevenue) * 100 : 0;

        // (+) Receitas extras
        $extraIncome = $extraRevenue;

        // (-) Despesas operacionais extras
        $extraExpenses = $operationalExpenses;

        // (=) Lucro Líquido Final
        $netProfit = $operationalProfit + $extraIncome - $extraExpenses;
        $netProfitPercent = $grossRevenue > 0 ? ($netProfit / $grossRevenue) * 100 : 0;

        return Inertia::render('financial/summary', [
            'data' => [
                // Receitas
                'grossRevenue' => $grossRevenue,
                'revenueByMarketplace' => $revenueByMarketplace,

                // Custos
                'cmv' => $cmv,
                'taxes' => $taxes,
                'commissions' => $commissions,
                'paymentFees' => $paymentFees,
                'orderCosts' => $orderCosts,

                // Operacionais
                'extraIncome' => $extraIncome,
                'extraExpenses' => $extraExpenses,

                // Resultados
                'grossProfit' => $grossProfit,
                'grossProfitPercent' => $grossProfitPercent,
                'resultAfterTaxes' => $resultAfterTaxes,
                'operationalProfit' => $operationalProfit,
                'operationalProfitPercent' => $operationalProfitPercent,
                'netProfit' => $netProfit,
                'netProfitPercent' => $netProfitPercent,
            ],
            'filters' => [
                'month' => $month,
            ],
        ]);
    }
}
