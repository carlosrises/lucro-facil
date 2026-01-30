<?php

namespace App\Http\Controllers;

use App\Models\FinanceEntry;
use App\Models\Order;
use App\Models\Store;
use App\Services\FinancialAggregationService;
use App\Services\OrderCostService;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Inertia\Inertia;

class DashboardController extends Controller
{
    public function index(Request $request, FinancialAggregationService $financialAggregation)
    {
        try {
            // Aumentar limite de memória e timeout (mitigação temporária para evitar timeouts durante investigação)
            ini_set('memory_limit', '1024M');
            ini_set('max_execution_time', '300'); // 5 minutos

            $tenantId = $request->user()->tenant_id;

            // Filtro de período (mês atual por padrão)
            $startDate = $request->input('start_date', now()->startOfMonth()->format('Y-m-d'));
            $endDate = $request->input('end_date', now()->endOfMonth()->format('Y-m-d'));
            $storeId = $request->input('store_id');
            $providerFilter = $request->input('provider');

            // Converter datas do horário de Brasília para UTC para filtrar corretamente
            $startDateUtc = Carbon::parse($startDate.' 00:00:00', 'America/Sao_Paulo')->setTimezone('UTC')->toDateTimeString();
            $endDateUtc = Carbon::parse($endDate.' 23:59:59', 'America/Sao_Paulo')->setTimezone('UTC')->toDateTimeString();

            // Base query para reutilizar
            $baseQuery = Order::where('tenant_id', $tenantId)
                ->whereBetween('placed_at', [$startDateUtc, $endDateUtc])
                ->whereNotIn('status', ['CANCELLED', 'CANCELLATION_REQUESTED'])
                ->when($storeId, fn ($q) => $q->where('store_id', $storeId))
                ->when($providerFilter, function ($q, $providerFilter) {
                    // Aceita múltiplos providers separados por vírgula
                    $providers = explode(',', $providerFilter);

                    $q->where(function ($query) use ($providers) {
                        foreach ($providers as $filter) {
                            $query->orWhere(function ($subQuery) use ($filter) {
                                // Formato: "provider", "provider:origin" ou "channel:value"
                                if (str_contains($filter, 'channel:')) {
                                    // Filtrar por channel do raw JSON
                                    $channel = str_replace('channel:', '', $filter);
                                    $subQuery->whereRaw("JSON_UNQUOTE(JSON_EXTRACT(raw, '$.channel')) = ?", [$channel]);
                                } elseif (str_contains($filter, ':')) {
                                    [$provider, $origin] = explode(':', $filter, 2);
                                    $subQuery->where('provider', $provider)->where('origin', $origin);
                                } else {
                                    // Se for takeat sem origin, filtrar por origin = takeat (pedidos próprios)
                                    if ($filter === 'takeat') {
                                        $subQuery->where('provider', 'takeat')
                                            ->where(function ($q) {
                                                $q->where('origin', 'takeat')
                                                    ->orWhereNull('origin');
                                            });
                                    } else {
                                        $subQuery->where('provider', $filter);
                                    }
                                }
                            });
                        }
                    });
                });

            // Usar serviço de agregação financeira - FONTE ÚNICA DE VERDADE
            $totals = $financialAggregation->calculatePeriodTotals(
                $baseQuery,
                $tenantId,
                $startDateUtc,
                $endDateUtc
            );

            $totalRevenue = $totals['total_revenue'];
            $totalCmv = $totals['total_cmv'];
            $totalTaxes = $totals['total_taxes'];
            $totalRecalculatedCosts = $totals['total_recalculated_costs'];
            $totalRecalculatedCommissions = $totals['total_recalculated_commissions'];
            $totalRecalculatedPaymentFees = $totals['total_recalculated_payment_fees'];
            $totalOrders = $totals['total_orders'];

            $totalSubsidies = $this->sumSubsidies(clone $baseQuery);

            // Buscar movimentações financeiras do período
            $startDateParsed = Carbon::parse($startDate);
            $endDateParsed = Carbon::parse($endDate);

            // Receitas extras (movimentações financeiras)
            $extraIncome = (float) FinanceEntry::where('tenant_id', $tenantId)
                ->withoutTemplates()
                ->whereBetween('occurred_on', [$startDateParsed, $endDateParsed])
                ->whereHas('category', function ($q) {
                    $q->where('type', 'income');
                })
                ->sum('amount');

            // Despesas extras (movimentações financeiras) - ESTAS SÃO OS CUSTOS FIXOS
            $extraExpenses = (float) FinanceEntry::where('tenant_id', $tenantId)
                ->withoutTemplates()
                ->whereBetween('occurred_on', [$startDateParsed, $endDateParsed])
                ->whereHas('category', function ($q) {
                    $q->where('type', 'expense');
                })
                ->sum('amount');

            // Cálculos principais (mesma lógica da página de Pedidos)
            // IMPORTANTE: Usar valores RECALCULADOS, não os do banco
            // 1. Receita pós Dedução = Subtotal - (Taxa Pagamento + Comissão)
            // Subsídio já está incluso no Subtotal, descontos já estão aplicados no Subtotal
            $revenueAfterDeductions = $totalRevenue - $totalRecalculatedPaymentFees - $totalRecalculatedCommissions;

            // 2. Margem de Contribuição (Lucro Bruto)
            // Receita após deduções - CMV - Custos Operacionais - Impostos
            $contributionMargin = $revenueAfterDeductions - $totalCmv - $totalRecalculatedCosts - $totalTaxes;

            // 3. Custos Fixos = Movimentações Financeiras (despesas)
            $fixedCosts = $extraExpenses;

            // 4. Lucro Líquido = Margem de Contribuição - Custos Fixos + Receitas Extras
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

            // Mesma lógica do período atual, mas com datas anteriores
            $previousBaseQuery = Order::where('tenant_id', $tenantId)
                ->whereBetween('placed_at', [$previousStartDateUtc, $previousEndDateUtc])
                ->whereNotIn('status', ['CANCELLED', 'CANCELLATION_REQUESTED'])
                ->when($storeId, fn ($q) => $q->where('store_id', $storeId))
                ->when($providerFilter, function ($q, $providerFilter) {
                    // Aceita múltiplos providers separados por vírgula
                    $providers = explode(',', $providerFilter);

                    $q->where(function ($query) use ($providers) {
                        foreach ($providers as $filter) {
                            $query->orWhere(function ($subQuery) use ($filter) {
                                // Formato: "provider" ou "provider:origin"
                                if (str_contains($filter, ':')) {
                                    [$provider, $origin] = explode(':', $filter, 2);
                                    $subQuery->where('provider', $provider)->where('origin', $origin);
                                } else {
                                    $subQuery->where('provider', $filter);
                                }
                            });
                        }
                    });
                });

            $previousSimpleTotals = (clone $previousBaseQuery)
                ->selectRaw('
                SUM(gross_total) as sum_gross_total,
                SUM(discount_total) as sum_discount_total,
                SUM(total_commissions) as sum_total_commissions,
                SUM(total_costs) as sum_total_costs,
                SUM(net_revenue) as sum_net_revenue,
                SUM(
                    COALESCE(
                        CAST(JSON_UNQUOTE(JSON_EXTRACT(calculated_costs, "$.total_payment_methods")) AS DECIMAL(18, 4)),
                        0
                    )
                ) as sum_payment_fees,
                SUM(
                    COALESCE(
                        CAST(JSON_UNQUOTE(JSON_EXTRACT(calculated_costs, "$.total_taxes")) AS DECIMAL(18, 4)),
                        0
                    )
                ) as sum_additional_taxes,
                SUM(
                    COALESCE(
                        CAST(JSON_UNQUOTE(JSON_EXTRACT(calculated_costs, "$.total_delivery")) AS DECIMAL(18, 4)),
                        0
                    )
                ) as sum_delivery_costs
            ')
                ->first();

            $previousCommissions = (float) ($previousSimpleTotals->sum_total_commissions ?? 0);
            $previousCosts = (float) ($previousSimpleTotals->sum_total_costs ?? 0);
            $previousDiscounts = (float) ($previousSimpleTotals->sum_discount_total ?? 0);
            $previousRevenue = (float) ($previousSimpleTotals->sum_gross_total ?? 0);
            $previousDeliveryFee = (float) ($previousSimpleTotals->sum_delivery_costs ?? 0);
            $previousPaymentFees = (float) ($previousSimpleTotals->sum_payment_fees ?? 0);
            $previousAdditionalTax = (float) ($previousSimpleTotals->sum_additional_taxes ?? 0);

            // CMV período anterior (SQL agregado)
            $previousCmvData = \DB::table('orders')
                ->join('order_items', 'order_items.order_id', '=', 'orders.id')
                ->join('order_item_mappings', 'order_item_mappings.order_item_id', '=', 'order_items.id')
                ->join('internal_products', 'internal_products.id', '=', 'order_item_mappings.internal_product_id')
                ->where('orders.tenant_id', $tenantId)
                ->whereBetween('orders.placed_at', [$previousStartDateUtc, $previousEndDateUtc])
                ->when($storeId, fn ($q) => $q->where('orders.store_id', $storeId))
                ->when($providerFilter, function ($q, $providerFilter) {
                    if (str_contains($providerFilter, ':')) {
                        [$provider, $origin] = explode(':', $providerFilter, 2);
                        $q->where('orders.provider', $provider)->where('orders.origin', $origin);
                    } else {
                        $q->where('orders.provider', $providerFilter);
                    }
                })
                ->selectRaw('SUM(order_items.qty * order_item_mappings.quantity * COALESCE(order_item_mappings.unit_cost_override, internal_products.unit_cost)) as total_cmv')
                ->first();

            $previousCmv = (float) ($previousCmvData->total_cmv ?? 0);

            // Subsídios do período anterior
            $previousSubsidies = $this->sumSubsidies(clone $previousBaseQuery);

            // Ajustar descontos
            $previousDiscounts = $previousDiscounts - $previousSubsidies;

            // Impostos dos produtos (SQL agregado)
            $previousTaxData = \DB::table('orders')
                ->join('order_items', 'order_items.order_id', '=', 'orders.id')
                ->join('internal_products', function ($join) {
                    $join->on('internal_products.tenant_id', '=', 'order_items.tenant_id')
                        ->whereRaw('EXISTS (
                         SELECT 1 FROM product_mappings
                         WHERE product_mappings.external_item_id = order_items.sku
                         AND product_mappings.internal_product_id = internal_products.id
                     )');
                })
                ->join('tax_categories', 'tax_categories.id', '=', 'internal_products.tax_category_id')
                ->where('orders.tenant_id', $tenantId)
                ->whereBetween('orders.placed_at', [$previousStartDateUtc, $previousEndDateUtc])
                ->when($storeId, fn ($q) => $q->where('orders.store_id', $storeId))
                ->when($providerFilter, function ($q, $providerFilter) {
                    if (str_contains($providerFilter, ':')) {
                        [$provider, $origin] = explode(':', $providerFilter, 2);
                        $q->where('orders.provider', $provider)->where('orders.origin', $origin);
                    } else {
                        $q->where('orders.provider', $providerFilter);
                    }
                })
                ->selectRaw('
                SUM(
                    order_items.qty * order_items.unit_price *
                    CASE tax_categories.tax_calculation_type
                        WHEN "detailed" THEN (COALESCE(tax_categories.iss_rate, 0) + COALESCE(tax_categories.icms_rate, 0) + COALESCE(tax_categories.pis_rate, 0) + COALESCE(tax_categories.cofins_rate, 0))
                        WHEN "fixed" THEN COALESCE(tax_categories.fixed_tax_rate, 0)
                        ELSE 0
                    END / 100
                ) as total_product_tax
            ')
                ->first();

            $previousProductTax = (float) ($previousTaxData->total_product_tax ?? 0);
            $previousTaxes = $previousProductTax + $previousAdditionalTax;

            // Movimentações financeiras do período anterior
            $previousStartDateParsed = Carbon::parse($previousStartDate);
            $previousEndDateParsed = Carbon::parse($previousEndDate);

            $previousExtraIncome = (float) FinanceEntry::where('tenant_id', $tenantId)
                ->withoutTemplates()
                ->whereBetween('occurred_on', [$previousStartDateParsed, $previousEndDateParsed])
                ->whereHas('category', function ($q) {
                    $q->where('type', 'income');
                })
                ->sum('amount');

            $previousExtraExpenses = (float) FinanceEntry::where('tenant_id', $tenantId)
                ->withoutTemplates()
                ->whereBetween('occurred_on', [$previousStartDateParsed, $previousEndDateParsed])
                ->whereHas('category', function ($q) {
                    $q->where('type', 'expense');
                })
                ->sum('amount');

            // Cálculos do período anterior (mesma lógica do DRE)
            $previousRevenueAfterDeductions = $previousRevenue - $previousPaymentFees - $previousCommissions;
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
            // Otimização: usar SQL agregado ao invés de loop PHP
            $chartData = [];

            // Buscar totais por dia usando SQL
            $dailyTotals = Order::where('tenant_id', $tenantId)
                ->whereBetween('placed_at', [$startDateUtc, $endDateUtc])
                ->when($storeId, fn ($q) => $q->where('store_id', $storeId))
                ->when($providerFilter, function ($q, $providerFilter) {
                    if (str_contains($providerFilter, ':')) {
                        [$provider, $origin] = explode(':', $providerFilter, 2);
                        $q->where('provider', $provider)->where('origin', $origin);
                    } else {
                        $q->where('provider', $providerFilter);
                    }
                })
                ->selectRaw("
                DATE(CONVERT_TZ(placed_at, '+00:00', '-03:00')) as date,
                SUM(gross_total) as total_revenue,
                SUM(total_commissions) as total_commissions,
                SUM(total_costs) as total_costs,
                COUNT(*) as order_count
            ")
                ->groupBy('date')
                ->orderBy('date')
                ->get()
                ->keyBy('date');

            // Preencher todos os dias do período
            $currentDate = Carbon::parse($startDate);
            $endDateCarbon = Carbon::parse($endDate);

            while ($currentDate <= $endDateCarbon) {
                $dateStr = $currentDate->format('Y-m-d');
                $dayData = $dailyTotals->get($dateStr);

                if ($dayData) {
                    $dayRevenue = (float) $dayData->total_revenue;
                    $dayCommissions = (float) $dayData->total_commissions;
                    $dayCosts = (float) $dayData->total_costs;

                    // Calcular proporções do dia em relação ao total
                    $proportion = $totalRevenue > 0 ? ($dayRevenue / $totalRevenue) : 0;

                    // Distribuir proporcionalmente os valores que não estão agregados por dia
                    $dayCmv = $totalCmv * $proportion;
                    $dayTaxes = $totalTaxes * $proportion;
                    $dayPaymentFees = $totalRecalculatedPaymentFees * $proportion;

                    $dayNetTotal = $dayRevenue - $dayCommissions - $dayCosts - $dayCmv - $dayTaxes - $dayPaymentFees;
                } else {
                    $dayRevenue = 0;
                    $dayCommissions = 0;
                    $dayCosts = 0;
                    $dayCmv = 0;
                    $dayTaxes = 0;
                    $dayPaymentFees = 0;
                    $dayNetTotal = 0;
                }

                $chartData[] = [
                    'date' => $dateStr,
                    'revenue' => round($dayRevenue, 2),
                    'cmv' => round($dayCmv, 2),
                    'taxes' => round($dayTaxes, 2),
                    'commissions' => round($dayCommissions, 2),
                    'costs' => round($dayCosts, 2),
                    'paymentFees' => round($dayPaymentFees, 2),
                    'netTotal' => round($dayNetTotal, 2),
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

            // Buscar TODOS os providers de stores configuradas + combinações existentes nos pedidos
            $providerLabels = [
                'ifood' => 'iFood',
                'takeat' => 'Takeat',
                '99food' => '99Food',
                'rappi' => 'Rappi',
                'uber_eats' => 'Uber Eats',
            ];

            $originLabels = [
                'ifood' => 'iFood',
                '99food' => '99Food',
                'neemo' => 'Neemo',
                'keeta' => 'Keeta',
                'totem' => 'Totem',
                'pdv' => 'PDV',
                'takeat' => 'Próprio',
            ];

            // Buscar providers das stores configuradas
            $storeProviders = Store::where('tenant_id', $tenantId)
                ->select('provider')
                ->distinct()
                ->pluck('provider')
                ->map(function ($provider) use ($providerLabels) {
                    return [
                        'value' => $provider,
                        'label' => $providerLabels[$provider] ?? ucfirst($provider),
                    ];
                });

            // Buscar combinações Takeat + origin dos pedidos
            $takeatOrigins = Order::where('tenant_id', $tenantId)
                ->where('provider', 'takeat')
                ->whereNotNull('origin')
                ->where('origin', '!=', 'takeat')
                ->select('origin')
                ->distinct()
                ->pluck('origin')
                ->map(function ($origin) use ($originLabels) {
                    $originLabel = $originLabels[$origin] ?? ucfirst($origin);

                    return [
                        'value' => "takeat:{$origin}",
                        'label' => "{$originLabel} (Takeat)",
                    ];
                });

            // Buscar channels distintos do raw JSON
            $channels = Order::where('tenant_id', $tenantId)
                ->whereNotNull('raw')
                ->whereRaw("JSON_EXTRACT(raw, '$.channel') IS NOT NULL")
                ->get()
                ->pluck('raw')
                ->map(function ($raw) {
                    $data = is_string($raw) ? json_decode($raw, true) : $raw;
                    return $data['channel'] ?? null;
                })
                ->filter()
                ->unique()
                ->map(function ($channel) {
                    $channelLabels = [
                        'delivery' => '🚚 Delivery',
                        'takeout' => '🏪 Retirada',
                        'indoor' => '🍽️ Salão',
                    ];

                    return [
                        'value' => "channel:{$channel}",
                        'label' => $channelLabels[$channel] ?? ucfirst($channel),
                    ];
                })
                ->values();

            // Combinar e ordenar
            $providerOptions = $storeProviders
                ->merge($takeatOrigins)
                ->merge($channels)
                ->unique('value')
                ->sortBy('label')
                ->values();

            // Obter plano atual do tenant
            $tenant = $request->user()->tenant;
            $currentPlan = $tenant->plan ? [
                'code' => $tenant->plan->code,
                'name' => $tenant->plan->name,
            ] : [
                'code' => 'FREE',
                'name' => 'Grátis',
            ];

            return Inertia::render('dashboard', [
                'dashboardData' => [
                    'revenue' => round($totalRevenue, 2),
                    'revenueChange' => round($revenueChange, 1),
                    'revenueAfterDeductions' => round($revenueAfterDeductions, 2), // Líquido Pós Venda
                    'revenueAfterDeductionsChange' => round($revenueAfterDeductionsChange, 1),
                    'cmv' => round($totalCmv, 2),
                    'cmvChange' => round($cmvChange, 1),
                    'deliveryFee' => round($totalRecalculatedCosts, 2),
                    'deliveryChange' => round($deliveryChange, 1),
                    'taxes' => round($totalTaxes, 2),
                    'taxesChange' => round($taxesChange, 1),
                    'fixedCosts' => round($fixedCosts, 2), // Movimentações financeiras (despesas)
                    'fixedCostsChange' => round($fixedCostsChange, 1),
                    'contributionMargin' => round($contributionMargin, 2), // Lucro Bruto (MC)
                    'contributionMarginChange' => round($contributionMarginChange, 1),
                    'netProfit' => round($netProfit, 2), // Lucro Líquido
                    'netProfitChange' => round($netProfitChange, 1),
                    'orderCount' => $totalOrders,
                ],
                'chartData' => $chartData,
                'stores' => $stores,
                'providerOptions' => $providerOptions,
                'currentPlan' => $currentPlan,
                'filters' => [
                    'start_date' => $startDate,
                    'end_date' => $endDate,
                    'store_id' => $storeId,
                    'provider' => $providerFilter,
                ],
            ]);
        } catch (\Exception $e) {
            logger()->error('❌ Dashboard - Erro fatal ao processar dashboard', [
                'tenant_id' => $request->user()->tenant_id ?? null,
                'start_date' => $startDate ?? null,
                'end_date' => $endDate ?? null,
                'store_id' => $storeId ?? null,
                'provider' => $providerFilter ?? null,
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString(),
            ]);

            // Re-lançar para Laravel processar adequadamente
            throw $e;
        }
    }

    private function sumSubsidies(Builder $query): float
    {
        $total = 0.0;

        $query
            ->select(['id', 'raw'])
            ->chunkById(200, function ($orders) use (&$total) {
                foreach ($orders as $order) {
                    $raw = is_array($order->raw) ? $order->raw : [];
                    $sessionPayments = $raw['session']['payments'] ?? [];

                    foreach ($sessionPayments as $payment) {
                        if (! is_array($payment)) {
                            continue;
                        }

                        $paymentName = strtolower($payment['payment_method']['name'] ?? '');
                        $paymentKeyword = strtolower($payment['payment_method']['keyword'] ?? '');

                        if (
                            str_contains($paymentName, 'subsid') ||
                            str_contains($paymentName, 'cupom') ||
                            str_contains($paymentKeyword, 'subsid') ||
                            str_contains($paymentKeyword, 'cupom')
                        ) {
                            $total += (float) ($payment['payment_value'] ?? 0);
                        }
                    }
                }
            });

        return $total;
    }
}
