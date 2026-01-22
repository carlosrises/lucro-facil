<?php

namespace App\Http\Controllers;

use App\Models\FinanceEntry;
use App\Models\Order;
use Carbon\Carbon;
use Illuminate\Contracts\Support\Arrayable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Inertia\Inertia;

class FinancialSummaryController extends Controller
{
    public function index(Request $request)
    {
        $tenantId = $request->user()->tenant_id;

        $monthInput = $request->input('month', now('America/Sao_Paulo')->format('Y-m'));

        try {
            $period = Carbon::createFromFormat('Y-m', $monthInput, 'America/Sao_Paulo');
        } catch (\Throwable $e) {
            $period = now('America/Sao_Paulo');
            $monthInput = $period->format('Y-m');
        }

        $startDateLocal = $period->copy()->startOfMonth()->startOfDay();
        $endDateLocal = $period->copy()->endOfMonth()->endOfDay();

        $startDateUtc = $startDateLocal->copy()->setTimezone('UTC')->toDateTimeString();
        $endDateUtc = $endDateLocal->copy()->setTimezone('UTC')->toDateTimeString();

        $baseQuery = Order::where('tenant_id', $tenantId)
            ->whereBetween('placed_at', [$startDateUtc, $endDateUtc]);

        $simpleTotals = (clone $baseQuery)
            ->selectRaw('
                SUM(gross_total) as sum_gross_total,
                SUM(discount_total) as sum_discount_total,
                SUM(total_commissions) as sum_total_commissions,
                SUM(total_costs) as sum_total_costs,
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
                ) as sum_additional_taxes
            ')
            ->first();

        $grossRevenue = (float) ($simpleTotals->sum_gross_total ?? 0);
        $totalDiscounts = (float) ($simpleTotals->sum_discount_total ?? 0);
        $totalCommissions = (float) ($simpleTotals->sum_total_commissions ?? 0);
        $totalCosts = (float) ($simpleTotals->sum_total_costs ?? 0);
        $totalPaymentFees = (float) ($simpleTotals->sum_payment_fees ?? 0);
        $totalAdditionalTax = (float) ($simpleTotals->sum_additional_taxes ?? 0);

        $cmvData = \DB::table('orders')
            ->join('order_items', 'order_items.order_id', '=', 'orders.id')
            ->join('order_item_mappings', 'order_item_mappings.order_item_id', '=', 'order_items.id')
            ->join('internal_products', 'internal_products.id', '=', 'order_item_mappings.internal_product_id')
            ->where('orders.tenant_id', $tenantId)
            ->whereBetween('orders.placed_at', [$startDateUtc, $endDateUtc])
            ->selectRaw('
                SUM(
                    order_items.qty * order_item_mappings.quantity *
                    COALESCE(order_item_mappings.unit_cost_override, internal_products.unit_cost)
                ) as total_cmv
            ')
            ->first();

        $totalCmv = (float) ($cmvData->total_cmv ?? 0);

        $productTaxData = \DB::table('orders')
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
            ->whereBetween('orders.placed_at', [$startDateUtc, $endDateUtc])
            ->selectRaw('
                SUM(
                    order_items.qty * order_items.unit_price *
                    CASE tax_categories.tax_calculation_type
                        WHEN "detailed" THEN (
                            COALESCE(tax_categories.iss_rate, 0) +
                            COALESCE(tax_categories.icms_rate, 0) +
                            COALESCE(tax_categories.pis_rate, 0) +
                            COALESCE(tax_categories.cofins_rate, 0)
                        )
                        WHEN "fixed" THEN COALESCE(tax_categories.fixed_tax_rate, 0)
                        ELSE 0
                    END / 100
                ) as total_product_tax
            ')
            ->first();

        $totalProductTax = (float) ($productTaxData->total_product_tax ?? 0);

        $totalSubsidies = $this->sumSubsidies(clone $baseQuery);
        $totalDiscounts = max($totalDiscounts - $totalSubsidies, 0);

        $totalTaxes = $totalProductTax + $totalAdditionalTax;

        $financeStart = $startDateLocal->copy();
        $financeEnd = $endDateLocal->copy();

        // Coletar despesas operacionais com breakdown por categoria
        $extraExpensesAggregation = [];
        $extraExpensesEntries = FinanceEntry::where('tenant_id', $tenantId)
            ->withoutTemplates()
            ->whereBetween('occurred_on', [$financeStart, $financeEnd])
            ->whereHas('category', function ($q) {
                $q->where('type', 'expense');
            })
            ->with('category')
            ->get();

        foreach ($extraExpensesEntries as $entry) {
            $categoryName = $entry->category->name ?? 'Sem categoria';
            $this->accumulateValue($extraExpensesAggregation, $categoryName, (float) $entry->amount);
        }

        $extraExpenses = (float) $extraExpensesEntries->sum('amount');

        // Coletar receitas operacionais com breakdown por categoria
        $extraIncomeAggregation = [];
        $extraIncomeEntries = FinanceEntry::where('tenant_id', $tenantId)
            ->withoutTemplates()
            ->whereBetween('occurred_on', [$financeStart, $financeEnd])
            ->whereHas('category', function ($q) {
                $q->where('type', 'income');
            })
            ->with('category')
            ->get();

        foreach ($extraIncomeEntries as $entry) {
            $categoryName = $entry->category->name ?? 'Sem categoria';
            $this->accumulateValue($extraIncomeAggregation, $categoryName, (float) $entry->amount);
        }

        $extraIncome = (float) $extraIncomeEntries->sum('amount');

        $revenueAfterDeductions = $grossRevenue - $totalPaymentFees - $totalCommissions - $totalDiscounts;
        $revenueAfterDeductionsPercent = $grossRevenue > 0 ? ($revenueAfterDeductions / $grossRevenue) * 100 : 0;

        $contributionMargin = $revenueAfterDeductions - $totalCmv - $totalCosts - $totalTaxes;
        $contributionMarginPercent = $grossRevenue > 0 ? ($contributionMargin / $grossRevenue) * 100 : 0;

        $netProfit = $contributionMargin - $extraExpenses + $extraIncome;
        $netProfitPercent = $grossRevenue > 0 ? ($netProfit / $grossRevenue) * 100 : 0;

        $paymentFeesPercent = $grossRevenue > 0 ? ($totalPaymentFees / $grossRevenue) * 100 : 0;
        $commissionsPercent = $grossRevenue > 0 ? ($totalCommissions / $grossRevenue) * 100 : 0;
        $discountsPercent = $grossRevenue > 0 ? ($totalDiscounts / $grossRevenue) * 100 : 0;
        $subsidiesPercent = $grossRevenue > 0 ? ($totalSubsidies / $grossRevenue) * 100 : 0;
        $cmvPercent = $grossRevenue > 0 ? ($totalCmv / $grossRevenue) * 100 : 0;
        $orderCostsPercent = $grossRevenue > 0 ? ($totalCosts / $grossRevenue) * 100 : 0;
        $taxesPercent = $grossRevenue > 0 ? ($totalTaxes / $grossRevenue) * 100 : 0;
        $extraIncomePercent = $grossRevenue > 0 ? ($extraIncome / $grossRevenue) * 100 : 0;
        $extraExpensesPercent = $grossRevenue > 0 ? ($extraExpenses / $grossRevenue) * 100 : 0;

        $paymentFeesAggregation = [];
        $commissionsAggregation = [];
        $discountsAggregation = [];
        $subsidiesAggregation = [];
        $additionalTaxesAggregation = [];
        $revenueAggregation = [];
        $orderCostsAggregation = [];
        [$marketplaceStoreMap, $storeMarketplaceMap] = $this->buildRevenueCrossTables(
            $tenantId,
            $startDateUtc,
            $endDateUtc
        );

        $breakdownQuery = (clone $baseQuery)
            ->select([
                'id',
                'provider',
                'origin',
                'gross_total',
                'total_commissions',
                'discount_total',
                'calculated_costs',
                'raw',
            ]);

        $breakdownQuery->chunkById(200, function ($orders) use (
            &$revenueAggregation,
            &$paymentFeesAggregation,
            &$commissionsAggregation,
            &$discountsAggregation,
            &$subsidiesAggregation,
            &$additionalTaxesAggregation,
            &$orderCostsAggregation
        ) {
            foreach ($orders as $order) {
                $label = $this->formatMarketplaceLabel($order->provider, $order->origin);

                $this->accumulateValue($revenueAggregation, $label, (float) ($order->gross_total ?? 0));

                $raw = $this->normalizeArray($order->raw);
                $subsidy = $this->extractSubsidyValue($raw);
                $this->accumulateValue($subsidiesAggregation, $label, $subsidy);

                $discountValue = max(((float) ($order->discount_total ?? 0)) - $subsidy, 0);
                $this->accumulateValue($discountsAggregation, $label, $discountValue);

                $calculatedCosts = $this->normalizeArray($order->calculated_costs);

                // Acumular custos variáveis (apenas costs, sem commissions que têm card próprio)
                foreach (($calculatedCosts['costs'] ?? []) as $cost) {
                    if (! is_array($cost)) {
                        continue;
                    }

                    $costLabel = $cost['name'] ?? 'Custo não identificado';
                    $costValue = (float) ($cost['calculated_value'] ?? 0);
                    $this->accumulateValue($orderCostsAggregation, $costLabel, $costValue);
                }

                // Acumular comissões por tipo de taxa (nome)
                foreach (($calculatedCosts['commissions'] ?? []) as $commission) {
                    if (! is_array($commission)) {
                        continue;
                    }

                    $commissionLabel = $commission['name'] ?? 'Comissão não identificada';
                    $commissionValue = (float) ($commission['calculated_value'] ?? 0);
                    $this->accumulateValue($commissionsAggregation, $commissionLabel, $commissionValue);
                }

                foreach (($calculatedCosts['payment_methods'] ?? []) as $payment) {
                    if (! is_array($payment)) {
                        continue;
                    }

                    $methodLabel = $payment['display_name']
                        ?? $payment['name']
                        ?? data_get($payment, 'payment_method.name')
                        ?? 'Taxa de pagamento';

                    $methodValue = (float) ($payment['calculated_value'] ?? 0);
                    $this->accumulateValue($paymentFeesAggregation, $methodLabel, $methodValue);
                }

                foreach (($calculatedCosts['taxes'] ?? []) as $tax) {
                    if (! is_array($tax)) {
                        continue;
                    }

                    $taxLabel = $tax['display_name']
                        ?? $tax['name']
                        ?? $tax['title']
                        ?? 'Imposto adicional';

                    $taxValue = (float) ($tax['calculated_value'] ?? 0);
                    $this->accumulateValue($additionalTaxesAggregation, $taxLabel, $taxValue);
                }
            }
        });

        $revenueByMarketplace = $this->formatBreakdownResponse($revenueAggregation, $grossRevenue);
        $revenueByMarketplace = array_map(function ($item) use ($marketplaceStoreMap) {
            $stores = $marketplaceStoreMap[$item['name']] ?? [];
            $item['stores'] = $this->formatBreakdownResponse($stores, $item['value']);

            return $item;
        }, $revenueByMarketplace);

        $storeTotals = array_map(function ($entries) {
            return array_sum($entries);
        }, $storeMarketplaceMap);

        $revenueByStore = $this->formatBreakdownResponse($storeTotals, $grossRevenue);
        $revenueByStore = array_map(function ($item) use ($storeMarketplaceMap) {
            $marketplaces = $storeMarketplaceMap[$item['name']] ?? [];
            $item['marketplaces'] = $this->formatBreakdownResponse($marketplaces, $item['value']);

            return $item;
        }, $revenueByStore);
        $paymentFeesBreakdown = $this->formatBreakdownResponse($paymentFeesAggregation, $totalPaymentFees);
        $commissionsBreakdown = $this->formatBreakdownResponse($commissionsAggregation, $totalCommissions);
        $discountsBreakdown = $this->formatBreakdownResponse($discountsAggregation, $totalDiscounts);
        $subsidiesBreakdown = $this->formatBreakdownResponse($subsidiesAggregation, $totalSubsidies);

        $taxItems = $totalProductTax > 0
            ? ['Impostos dos produtos' => $totalProductTax] + $additionalTaxesAggregation
            : $additionalTaxesAggregation;

        $taxesBreakdown = $this->formatBreakdownResponse($taxItems, $totalTaxes);
        $orderCostsBreakdown = $this->formatBreakdownResponse($orderCostsAggregation, $totalCosts);
        $extraExpensesBreakdown = $this->formatBreakdownResponse($extraExpensesAggregation, $extraExpenses);
        $extraIncomeBreakdown = $this->formatBreakdownResponse($extraIncomeAggregation, $extraIncome);

        return Inertia::render('financial/summary', [
            'data' => [
                'grossRevenue' => $grossRevenue,
                'revenueByMarketplace' => $revenueByMarketplace,
                'revenueByStore' => $revenueByStore,
                'paymentFees' => $totalPaymentFees,
                'paymentFeesPercent' => $paymentFeesPercent,
                'paymentFeesBreakdown' => $paymentFeesBreakdown,
                'commissions' => $totalCommissions,
                'commissionsPercent' => $commissionsPercent,
                'commissionsBreakdown' => $commissionsBreakdown,
                'discounts' => $totalDiscounts,
                'discountsPercent' => $discountsPercent,
                'discountsBreakdown' => $discountsBreakdown,
                'subsidies' => $totalSubsidies,
                'subsidiesPercent' => $subsidiesPercent,
                'subsidiesBreakdown' => $subsidiesBreakdown,
                'revenueAfterDeductions' => $revenueAfterDeductions,
                'revenueAfterDeductionsPercent' => $revenueAfterDeductionsPercent,
                'cmv' => $totalCmv,
                'cmvPercent' => $cmvPercent,
                'orderCosts' => $totalCosts,
                'orderCostsPercent' => $orderCostsPercent,
                'orderCostsBreakdown' => $orderCostsBreakdown,
                'taxes' => $totalTaxes,
                'taxesPercent' => $taxesPercent,
                'taxesBreakdown' => $taxesBreakdown,
                'contributionMargin' => $contributionMargin,
                'contributionMarginPercent' => $contributionMarginPercent,
                'extraIncome' => $extraIncome,
                'extraIncomePercent' => $extraIncomePercent,
                'extraIncomeBreakdown' => $extraIncomeBreakdown,
                'extraExpenses' => $extraExpenses,
                'extraExpensesPercent' => $extraExpensesPercent,
                'extraExpensesBreakdown' => $extraExpensesBreakdown,
                'netProfit' => $netProfit,
                'netProfitPercent' => $netProfitPercent,
            ],
            'filters' => [
                'month' => $monthInput,
            ],
        ]);
    }

    private function sumSubsidies(Builder $query): float
    {
        $total = 0.0;

        $query
            ->select(['id', 'raw'])
            ->chunkById(200, function ($orders) use (&$total) {
                foreach ($orders as $order) {
                    $raw = $this->normalizeArray($order->raw);
                    $total += $this->extractSubsidyValue($raw);
                }
            });

        return $total;
    }

    private function extractSubsidyValue(array $raw): float
    {
        $sum = 0.0;
        $sessionPayments = $raw['session']['payments'] ?? [];

        foreach ($sessionPayments as $payment) {
            if (! is_array($payment)) {
                continue;
            }

            $paymentName = strtolower(data_get($payment, 'payment_method.name', ''));
            $paymentKeyword = strtolower(data_get($payment, 'payment_method.keyword', ''));

            if (
                str_contains($paymentName, 'subsid') ||
                str_contains($paymentName, 'cupom') ||
                str_contains($paymentKeyword, 'subsid') ||
                str_contains($paymentKeyword, 'cupom')
            ) {
                $sum += (float) ($payment['payment_value'] ?? 0);
            }
        }

        return $sum;
    }

    private function normalizeArray($value): array
    {
        if (is_array($value)) {
            return $value;
        }

        if ($value instanceof Arrayable) {
            return $value->toArray();
        }

        if ($value instanceof \JsonSerializable) {
            $decoded = $value->jsonSerialize();
            return is_array($decoded) ? $decoded : [];
        }

        if (is_string($value) && $value !== '') {
            $decoded = json_decode($value, true);
            return is_array($decoded) ? $decoded : [];
        }

        return [];
    }

    private function accumulateValue(array &$bucket, string $label, float $value): void
    {
        if (abs($value) < 0.0001) {
            return;
        }

        if (! array_key_exists($label, $bucket)) {
            $bucket[$label] = 0.0;
        }

        $bucket[$label] += $value;
    }

    private function formatBreakdownResponse(array $items, float $total): array
    {
        if (empty($items)) {
            return [];
        }

        return collect($items)
            ->map(function ($value, $name) use ($total) {
                $amount = round((float) $value, 2);

                return [
                    'name' => $name,
                    'value' => $amount,
                    'percentage' => $total > 0 ? round(($amount / $total) * 100, 1) : 0,
                ];
            })
            ->sortByDesc('value')
            ->values()
            ->all();
    }

    private function formatMarketplaceLabel(?string $provider, ?string $origin): string
    {
        $provider = $provider ? strtolower($provider) : 'desconhecido';
        $origin = $origin ? strtolower($origin) : null;

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

        if ($provider === 'takeat' && $origin && $origin !== 'takeat') {
            $originLabel = $originLabels[$origin] ?? ucfirst($origin);

            return sprintf('%s (Takeat)', $originLabel);
        }

        return $providerLabels[$provider] ?? ucfirst($provider);
    }

    private function buildRevenueCrossTables(int $tenantId, string $startDateUtc, string $endDateUtc): array
    {
        $rows = \DB::table('orders')
            ->leftJoin('stores', 'stores.id', '=', 'orders.store_id')
            ->where('orders.tenant_id', $tenantId)
            ->whereBetween('orders.placed_at', [$startDateUtc, $endDateUtc])
            ->select([
                'orders.provider',
                'orders.origin',
                'orders.store_id',
                'stores.display_name as store_name',
            ])
            ->selectRaw('SUM(orders.gross_total) as total_revenue')
            ->groupBy('orders.provider', 'orders.origin', 'orders.store_id', 'stores.display_name')
            ->get();

        $marketplaceToStores = [];
        $storeToMarketplaces = [];

        foreach ($rows as $row) {
            $label = $this->formatMarketplaceLabel($row->provider, $row->origin);
            $storeName = $row->store_name ?? 'Loja não identificada';
            $value = (float) ($row->total_revenue ?? 0);

            if (! isset($marketplaceToStores[$label])) {
                $marketplaceToStores[$label] = [];
            }

            if (! isset($marketplaceToStores[$label][$storeName])) {
                $marketplaceToStores[$label][$storeName] = 0.0;
            }

            $marketplaceToStores[$label][$storeName] += $value;

            if (! isset($storeToMarketplaces[$storeName])) {
                $storeToMarketplaces[$storeName] = [];
            }

            if (! isset($storeToMarketplaces[$storeName][$label])) {
                $storeToMarketplaces[$storeName][$label] = 0.0;
            }

            $storeToMarketplaces[$storeName][$label] += $value;
        }

        return [$marketplaceToStores, $storeToMarketplaces];
    }
}
