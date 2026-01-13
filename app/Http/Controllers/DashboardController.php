<?php

namespace App\Http\Controllers;

use App\Models\FinanceEntry;
use App\Models\Order;
use App\Models\Store;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Inertia\Inertia;

class DashboardController extends Controller
{
    public function index(Request $request)
    {
        $tenantId = $request->user()->tenant_id;

        // Filtro de período (mês atual por padrão)
        $startDate = $request->input('start_date', now()->startOfMonth()->format('Y-m-d'));
        $endDate = $request->input('end_date', now()->endOfMonth()->format('Y-m-d'));
        $storeId = $request->input('store_id');
        $provider = $request->input('provider');

        // Converter datas do horário de Brasília para UTC para filtrar corretamente
        $startDateUtc = Carbon::parse($startDate.' 00:00:00', 'America/Sao_Paulo')->setTimezone('UTC')->toDateTimeString();
        $endDateUtc = Carbon::parse($endDate.' 23:59:59', 'America/Sao_Paulo')->setTimezone('UTC')->toDateTimeString();

        // Buscar pedidos do período
        $orders = Order::where('tenant_id', $tenantId)
            ->with(['items.internalProduct', 'items.mappings.internalProduct'])
            ->whereBetween('placed_at', [$startDateUtc, $endDateUtc])
            ->when($storeId, fn($q) => $q->where('store_id', $storeId))
            ->when($provider, fn($q) => $q->where('provider', $provider))
            ->get();

        // Inicializar acumuladores
        $totalRevenue = 0;
        $totalCmv = 0;
        $totalDeliveryFee = 0;
        $totalProductTax = 0; // Impostos dos produtos
        $totalAdditionalTax = 0; // Impostos adicionais
        $totalCommissions = 0;
        $totalPaymentMethodFees = 0;
        $totalCosts = 0; // Custos operacionais (despesas operacionais)
        $totalDiscounts = 0;
        $totalSubsidies = 0;

        foreach ($orders as $order) {
            // Total do pedido: mesma lógica do DRE
            $orderRevenue = 0;

            if ($order->provider === 'takeat') {
                // Takeat: usar total_delivery_price (inclui entrega e subsídios)
                if (isset($order->raw['session']['total_delivery_price'])) {
                    $orderRevenue = (float) $order->raw['session']['total_delivery_price'];
                } elseif (isset($order->raw['session']['total_price'])) {
                    $orderRevenue = (float) $order->raw['session']['total_price'];
                } else {
                    $orderRevenue = (float) ($order->gross_total ?? 0);
                }
            } elseif (isset($order->raw['total']['orderAmount'])) {
                // iFood: orderAmount inclui produtos + entrega + taxas
                $orderRevenue = (float) $order->raw['total']['orderAmount'];
            } else {
                // Fallback: usar gross_total
                $orderRevenue = (float) ($order->gross_total ?? 0);
            }

            $totalRevenue += $orderRevenue;

            // Taxa de entrega (CUSTOS de entrega, não receita)
            // Buscar apenas em calculated_costs.costs (custos operacionais de entrega)
            // NÃO usar order->delivery_fee (é receita cobrada do cliente, não custo)
            $deliveryFromCosts = 0;
            $costs = $order->calculated_costs ?? null;
            if ($costs && isset($costs['costs']) && is_array($costs['costs'])) {
                foreach ($costs['costs'] as $c) {
                    $cname = strtolower($c['name'] ?? '');
                    if (strpos($cname, 'entreg') !== false || strpos($cname, 'delivery') !== false) {
                        $deliveryFromCosts += (float) ($c['calculated_value'] ?? 0);
                    }
                }
            }

            $totalDeliveryFee += $deliveryFromCosts;

            // Calcular CMV e Impostos dos produtos a partir dos itens
            foreach ($order->items as $item) {
                $itemQuantity = $item->qty ?? $item->quantity ?? 0;
                $itemCost = 0;

                // Calcular CMV
                if ($item->mappings && $item->mappings->count() > 0) {
                    foreach ($item->mappings as $mapping) {
                        if ($mapping->internalProduct && $mapping->internalProduct->unit_cost) {
                            $unitCost = (float) $mapping->internalProduct->unit_cost;
                            $mappingQuantity = $mapping->quantity ?? 1;
                            $itemCost += $unitCost * $mappingQuantity;
                        }
                    }
                    $totalCmv += $itemCost * $itemQuantity;
                } elseif ($item->internalProduct && $item->internalProduct->unit_cost) {
                    $unitCost = (float) $item->internalProduct->unit_cost;
                    $totalCmv += $unitCost * $itemQuantity;
                }

                // Calcular Impostos dos produtos (se tiver categoria de imposto)
                if ($item->internalProduct && $item->internalProduct->taxCategory) {
                    $taxRate = (float) ($item->internalProduct->taxCategory->total_tax_rate ?? 0);
                    if ($taxRate > 0) {
                        $unitPrice = (float) ($item->unit_price ?? $item->price ?? 0);
                        $totalProductTax += ($itemQuantity * $unitPrice * $taxRate) / 100;
                    }
                }
            }

            // Custos do calculated_costs
            $costs = $order->calculated_costs;
            if ($costs) {
                // Impostos adicionais (do array taxes em calculated_costs)
                if (isset($costs['taxes']) && is_array($costs['taxes'])) {
                    foreach ($costs['taxes'] as $tax) {
                        $totalAdditionalTax += (float) ($tax['calculated_value'] ?? 0);
                    }
                }

                // Taxas de meio de pagamento (do array payment_methods em calculated_costs)
                if (isset($costs['payment_methods']) && is_array($costs['payment_methods'])) {
                    foreach ($costs['payment_methods'] as $pm) {
                        $totalPaymentMethodFees += (float) ($pm['calculated_value'] ?? 0);
                    }
                }
            }

            // Comissões (do campo total_commissions do pedido)
            $totalCommissions += (float) ($order->total_commissions ?? 0);

            // Custos operacionais (do campo total_costs do pedido)
            $totalCosts += (float) ($order->total_costs ?? 0);

            // Descontos e Subsídios (mesma lógica do DRE)
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

        // Total de impostos = impostos dos produtos + impostos adicionais
        $totalTaxes = $totalProductTax + $totalAdditionalTax;

        // Buscar movimentações financeiras do período
        $startDateParsed = Carbon::parse($startDate);
        $endDateParsed = Carbon::parse($endDate);

        // Receitas extras (movimentações financeiras)
        $extraIncome = (float) FinanceEntry::where('tenant_id', $tenantId)
            ->whereBetween('occurred_on', [$startDateParsed, $endDateParsed])
            ->whereHas('category', function ($q) {
                $q->where('type', 'income');
            })
            ->sum('amount');

        // Despesas extras (movimentações financeiras) - ESTAS SÃO OS CUSTOS FIXOS
        $extraExpenses = (float) FinanceEntry::where('tenant_id', $tenantId)
            ->whereBetween('occurred_on', [$startDateParsed, $endDateParsed])
            ->whereHas('category', function ($q) {
                $q->where('type', 'expense');
            })
            ->sum('amount');

        // Cálculos principais (mesma lógica do DRE)
        // 1. Receita pós Dedução = Faturamento - (Taxa Pagamento + Comissão + Descontos) + Subsídios
        $revenueAfterDeductions = $totalRevenue - $totalPaymentMethodFees - $totalCommissions - $totalDiscounts + $totalSubsidies;

        // 2. Margem de Contribuição (Lucro Bruto) = Receita pós Dedução - CMV - Despesas Operacionais - Impostos
        $contributionMargin = $revenueAfterDeductions - $totalCmv - $totalCosts - $totalTaxes;

        // 3. Custos Fixos = Movimentações Financeiras (despesas)
        $fixedCosts = $extraExpenses;

        // 4. Lucro Líquido = Margem de Contribuição - Despesas Financeiras + Receitas Financeiras
        $netProfit = $contributionMargin - $extraExpenses + $extraIncome;

        // Margem líquida %
        $marginPercent = $totalRevenue > 0 ? ($netProfit / $totalRevenue) * 100 : 0;

        // Comparação com período anterior (mesmo número de dias)
        $days = Carbon::parse($startDate)->diffInDays(Carbon::parse($endDate)) + 1;
        $previousStartDate = Carbon::parse($startDate)->subDays($days)->format('Y-m-d');
        $previousEndDate = Carbon::parse($startDate)->subDay()->format('Y-m-d');

        // Converter datas do horário de Brasília para UTC
        $previousStartDateUtc = Carbon::parse($previousStartDate.' 00:00:00', 'America/Sao_Paulo')->setTimezone('UTC')->toDateTimeString();
        $previousEndDateUtc = Carbon::parse($previousEndDate.' 23:59:59', 'America/Sao_Paulo')->setTimezone('UTC')->toDateTimeString();

        $previousOrders = Order::where('tenant_id', $tenantId)
            ->with(['items.internalProduct', 'items.mappings.internalProduct'])
            ->whereBetween('placed_at', [$previousStartDateUtc, $previousEndDateUtc])
            ->when($storeId, fn($q) => $q->where('store_id', $storeId))
            ->get();

        $previousRevenue = 0;
        $previousCmv = 0;
        $previousDeliveryFee = 0;
        $previousProductTax = 0;
        $previousAdditionalTax = 0;
        $previousCommissions = 0;
        $previousCosts = 0;
        $previousPaymentFees = 0;
        $previousDiscounts = 0;
        $previousSubsidies = 0;

        foreach ($previousOrders as $order) {
            // Total do pedido: mesma lógica do DRE
            $orderRevenue = 0;

            if ($order->provider === 'takeat') {
                if (isset($order->raw['session']['total_delivery_price'])) {
                    $orderRevenue = (float) $order->raw['session']['total_delivery_price'];
                } elseif (isset($order->raw['session']['total_price'])) {
                    $orderRevenue = (float) $order->raw['session']['total_price'];
                } else {
                    $orderRevenue = (float) ($order->gross_total ?? 0);
                }
            } elseif (isset($order->raw['total']['orderAmount'])) {
                $orderRevenue = (float) $order->raw['total']['orderAmount'];
            } else {
                $orderRevenue = (float) ($order->gross_total ?? 0);
            }

            $previousRevenue += $orderRevenue;
            // Taxa de entrega do período anterior (CUSTOS apenas)
            $prevDeliveryFromCosts = 0;
            $prevCosts = $order->calculated_costs ?? null;
            if ($prevCosts && isset($prevCosts['costs']) && is_array($prevCosts['costs'])) {
                foreach ($prevCosts['costs'] as $c) {
                    $cname = strtolower($c['name'] ?? '');
                    if (strpos($cname, 'entreg') !== false || strpos($cname, 'delivery') !== false) {
                        $prevDeliveryFromCosts += (float) ($c['calculated_value'] ?? 0);
                    }
                }
            }

            $previousDeliveryFee += $prevDeliveryFromCosts;

            // Calcular CMV e impostos dos produtos do período anterior
            foreach ($order->items as $item) {
                $itemQuantity = $item->qty ?? $item->quantity ?? 0;
                $itemCost = 0;

                if ($item->mappings && $item->mappings->count() > 0) {
                    foreach ($item->mappings as $mapping) {
                        if ($mapping->internalProduct && $mapping->internalProduct->unit_cost) {
                            $unitCost = (float) $mapping->internalProduct->unit_cost;
                            $mappingQuantity = $mapping->quantity ?? 1;
                            $itemCost += $unitCost * $mappingQuantity;
                        }
                    }
                    $previousCmv += $itemCost * $itemQuantity;
                } elseif ($item->internalProduct && $item->internalProduct->unit_cost) {
                    $unitCost = (float) $item->internalProduct->unit_cost;
                    $previousCmv += $unitCost * $itemQuantity;
                }

                // Impostos dos produtos
                if ($item->internalProduct && $item->internalProduct->taxCategory) {
                    $taxRate = (float) ($item->internalProduct->taxCategory->total_tax_rate ?? 0);
                    if ($taxRate > 0) {
                        $unitPrice = (float) ($item->unit_price ?? $item->price ?? 0);
                        $previousProductTax += ($itemQuantity * $unitPrice * $taxRate) / 100;
                    }
                }
            }

            $costs = $order->calculated_costs;
            if ($costs) {
                // Impostos adicionais
                if (isset($costs['taxes']) && is_array($costs['taxes'])) {
                    foreach ($costs['taxes'] as $tax) {
                        $previousAdditionalTax += (float) ($tax['calculated_value'] ?? 0);
                    }
                }

                // Taxas de pagamento
                if (isset($costs['payment_methods']) && is_array($costs['payment_methods'])) {
                    foreach ($costs['payment_methods'] as $pm) {
                        $previousPaymentFees += (float) ($pm['calculated_value'] ?? 0);
                    }
                }
            }

            // Comissões e custos dos campos do pedido
            $previousCommissions += (float) ($order->total_commissions ?? 0);
            $previousCosts += (float) ($order->total_costs ?? 0);

            // Descontos e Subsídios (mesma lógica do DRE)
            $discountTotal = (float) ($order->discount_total ?? 0);
            $sessionPayments = $order->raw['session']['payments'] ?? [];
            $subsidy = 0;

            foreach ($sessionPayments as $payment) {
                $paymentName = strtolower($payment['payment_method']['name'] ?? '');
                $paymentKeyword = strtolower($payment['payment_method']['keyword'] ?? '');

                if (str_contains($paymentName, 'subsid') ||
                    str_contains($paymentName, 'cupom') ||
                    str_contains($paymentKeyword, 'subsid') ||
                    str_contains($paymentKeyword, 'cupom')) {
                    $subsidy += (float) ($payment['payment_value'] ?? 0);
                }
            }

            $discount = $discountTotal - $subsidy;
            $previousDiscounts += $discount;
            $previousSubsidies += $subsidy;
        }

        // Total de impostos do período anterior
        $previousTaxes = $previousProductTax + $previousAdditionalTax;

        // Movimentações financeiras do período anterior
        $previousStartDateParsed = Carbon::parse($previousStartDate);
        $previousEndDateParsed = Carbon::parse($previousEndDate);

        $previousExtraIncome = (float) FinanceEntry::where('tenant_id', $tenantId)
            ->whereBetween('occurred_on', [$previousStartDateParsed, $previousEndDateParsed])
            ->whereHas('category', function ($q) {
                $q->where('type', 'income');
            })
            ->sum('amount');

        $previousExtraExpenses = (float) FinanceEntry::where('tenant_id', $tenantId)
            ->whereBetween('occurred_on', [$previousStartDateParsed, $previousEndDateParsed])
            ->whereHas('category', function ($q) {
                $q->where('type', 'expense');
            })
            ->sum('amount');

        // Cálculos do período anterior (mesma lógica do DRE)
        $previousRevenueAfterDeductions = $previousRevenue - $previousPaymentFees - $previousCommissions - $previousDiscounts + $previousSubsidies;
        $previousContributionMargin = $previousRevenueAfterDeductions - $previousCmv - $previousCosts - $previousTaxes;
        $previousFixedCosts = $previousExtraExpenses;
        $previousNetProfit = $previousContributionMargin - $previousExtraExpenses + $previousExtraIncome;

        // Variações percentuais
        $revenueChange = $previousRevenue > 0 ? (($totalRevenue - $previousRevenue) / $previousRevenue) * 100 : 0;
        $revenueAfterDeductionsChange = $previousRevenueAfterDeductions > 0 ? (($revenueAfterDeductions - $previousRevenueAfterDeductions) / $previousRevenueAfterDeductions) * 100 : 0;
        $cmvChange = $previousCmv > 0 ? (($totalCmv - $previousCmv) / $previousCmv) * 100 : 0;
        $deliveryChange = $previousDeliveryFee > 0 ? (($totalDeliveryFee - $previousDeliveryFee) / $previousDeliveryFee) * 100 : 0;
        $taxesChange = $previousTaxes > 0 ? (($totalTaxes - $previousTaxes) / $previousTaxes) * 100 : 0;
        $fixedCostsChange = $previousFixedCosts > 0 ? (($fixedCosts - $previousFixedCosts) / $previousFixedCosts) * 100 : 0;
        $contributionMarginChange = $previousContributionMargin > 0 ? (($contributionMargin - $previousContributionMargin) / $previousContributionMargin) * 100 : 0;
        $netProfitChange = $previousNetProfit > 0 ? (($netProfit - $previousNetProfit) / $previousNetProfit) * 100 : 0;

        // Gerar dados do gráfico (agrupados por dia no horário de Brasília)
        $chartData = [];
        $ordersByDate = $orders->groupBy(function ($order) {
            // Converter UTC para Brasília antes de agrupar
            return Carbon::parse($order->placed_at)->setTimezone('America/Sao_Paulo')->format('Y-m-d');
        });

        // Preencher todos os dias do período
        $currentDate = Carbon::parse($startDate);
        $endDateCarbon = Carbon::parse($endDate);

        while ($currentDate <= $endDateCarbon) {
            $dateStr = $currentDate->format('Y-m-d');
            $dayOrders = $ordersByDate->get($dateStr, collect());

            $dayRevenue = 0;
            $dayNetProfit = 0;
            $dayTotalCmv = 0;
            $dayTotalTaxes = 0;
            $dayTotalCommissions = 0;
            $dayTotalCosts = 0;
            $dayTotalPmFees = 0;

            foreach ($dayOrders as $order) {
                // Total do pedido: iFood usa raw.total.orderAmount, Takeat usa gross_total
                $orderTotal = 0;
                if (isset($order->raw['total']['orderAmount'])) {
                    $orderTotal = (float) $order->raw['total']['orderAmount'];
                } else {
                    $orderTotal = (float) ($order->gross_total ?? 0);
                }
                $dayRevenue += $orderTotal;

                // Calcular custos do dia
                $dayCmv = 0;
                $dayProductTax = 0;

                foreach ($order->items as $item) {
                    $itemQuantity = $item->qty ?? $item->quantity ?? 0;
                    $itemCost = 0;

                    // CMV
                    if ($item->mappings && $item->mappings->count() > 0) {
                        foreach ($item->mappings as $mapping) {
                            if ($mapping->internalProduct && $mapping->internalProduct->unit_cost) {
                                $unitCost = (float) $mapping->internalProduct->unit_cost;
                                $mappingQuantity = $mapping->quantity ?? 1;
                                $itemCost += $unitCost * $mappingQuantity;
                            }
                        }
                        $dayCmv += $itemCost * $itemQuantity;
                    } elseif ($item->internalProduct && $item->internalProduct->unit_cost) {
                        $unitCost = (float) $item->internalProduct->unit_cost;
                        $dayCmv += $unitCost * $itemQuantity;
                    }

                    // Impostos dos produtos
                    if ($item->internalProduct && $item->internalProduct->taxCategory) {
                        $taxRate = (float) ($item->internalProduct->taxCategory->total_tax_rate ?? 0);
                        if ($taxRate > 0) {
                            $unitPrice = (float) ($item->unit_price ?? $item->price ?? 0);
                            $dayProductTax += ($itemQuantity * $unitPrice * $taxRate) / 100;
                        }
                    }
                }

                $dayAdditionalTax = 0;
                $dayCommissions = 0;
                $dayPmFees = 0;
                $dayCosts = 0;

                $costs = $order->calculated_costs;
                if ($costs) {
                    // Impostos adicionais
                    if (isset($costs['taxes']) && is_array($costs['taxes'])) {
                        foreach ($costs['taxes'] as $tax) {
                            $dayAdditionalTax += (float) ($tax['calculated_value'] ?? 0);
                        }
                    }

                    // Taxas de pagamento
                    if (isset($costs['payment_methods']) && is_array($costs['payment_methods'])) {
                        foreach ($costs['payment_methods'] as $pm) {
                            $dayPmFees += (float) ($pm['calculated_value'] ?? 0);
                        }
                    }
                }

                // Comissões e custos dos campos do pedido
                $dayCommissions += (float) ($order->total_commissions ?? 0);
                $dayCosts += (float) ($order->total_costs ?? 0);

                $dayTotalTax = $dayProductTax + $dayAdditionalTax;
                $dayFixedCosts = $dayCommissions + $dayCosts + $dayPmFees;
                $dayNetProfit += $orderTotal - $dayCmv - $dayTotalTax - $dayFixedCosts;

                // Acumular valores separados para o tooltip
                $dayTotalCmv += $dayCmv;
                $dayTotalTaxes += $dayTotalTax;
                $dayTotalCommissions += $dayCommissions;
                $dayTotalCosts += $dayCosts;
                $dayTotalPmFees += $dayPmFees;
            }

            $chartData[] = [
                'date' => $dateStr,
                'revenue' => round($dayRevenue, 2),
                'cmv' => round($dayTotalCmv, 2),
                'taxes' => round($dayTotalTaxes, 2),
                'commissions' => round($dayTotalCommissions, 2),
                'costs' => round($dayTotalCosts, 2),
                'paymentFees' => round($dayTotalPmFees, 2),
                'netTotal' => round($dayNetProfit, 2),
            ];

            $currentDate->addDay();
        }

        // Buscar todas as stores do tenant para o filtro
        $stores = Store::where('tenant_id', $tenantId)
            ->orderBy('display_name')
            ->get(['id', 'display_name', 'provider'])
            ->map(function ($store) {
                return [
                    'id' => $store->id,
                    'name' => $store->display_name,
                    'provider' => $store->provider,
                ];
            });

        // Buscar providers únicos do tenant
        $providers = Order::where('tenant_id', $tenantId)
            ->select('provider')
            ->distinct()
            ->orderBy('provider')
            ->pluck('provider')
            ->filter()
            ->map(function ($provider) {
                return [
                    'value' => $provider,
                    'label' => match($provider) {
                        'ifood' => 'iFood',
                        'rappi' => 'Rappi',
                        'takeat' => 'Takeat',
                        '99food' => '99Food',
                        default => ucfirst($provider),
                    },
                ];
            })
            ->values();

        return Inertia::render('dashboard', [
            'dashboardData' => [
                'revenue' => round($totalRevenue, 2),
                'revenueChange' => round($revenueChange, 1),
                'revenueAfterDeductions' => round($revenueAfterDeductions, 2), // Líquido Pós Venda
                'revenueAfterDeductionsChange' => round($revenueAfterDeductionsChange, 1),
                'cmv' => round($totalCmv, 2),
                'cmvChange' => round($cmvChange, 1),
                'deliveryFee' => round($totalDeliveryFee, 2),
                'deliveryChange' => round($deliveryChange, 1),
                'taxes' => round($totalTaxes, 2),
                'taxesChange' => round($taxesChange, 1),
                'fixedCosts' => round($fixedCosts, 2), // Movimentações financeiras (despesas)
                'fixedCostsChange' => round($fixedCostsChange, 1),
                'contributionMargin' => round($contributionMargin, 2), // Lucro Bruto (MC)
                'contributionMarginChange' => round($contributionMarginChange, 1),
                'netProfit' => round($netProfit, 2), // Lucro Líquido
                'netProfitChange' => round($netProfitChange, 1),
                'orderCount' => $orders->count(),
            ],
            'chartData' => $chartData,
            'stores' => $stores,
            'providers' => $providers,
            'filters' => [
                'start_date' => $startDate,
                'end_date' => $endDate,
                'store_id' => $storeId,
                'provider' => $provider,
            ],
        ]);
    }
}
