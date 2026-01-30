<?php

namespace App\Http\Controllers;

use App\Models\FinanceEntry;
use App\Models\Order;
use App\Services\FinancialAggregationService;
use App\Services\OrderCostService;
use Carbon\Carbon;
use Illuminate\Contracts\Support\Arrayable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Inertia\Inertia;

class FinancialSummaryController extends Controller
{
    public function index(Request $request, FinancialAggregationService $financialAggregation, OrderCostService $orderCostService)
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
            ->whereBetween('placed_at', [$startDateUtc, $endDateUtc])
            ->whereNotIn('status', ['CANCELLED', 'CANCELLATION_REQUESTED']);

        // Usar FinancialAggregationService - FONTE ÚNICA DE VERDADE
        $totals = $financialAggregation->calculatePeriodTotals($baseQuery, $tenantId, $startDateUtc, $endDateUtc);

        $grossRevenue = $totals['total_revenue'];
        $totalCmv = $totals['total_cmv'];
        $totalProductTax = $totals['total_product_tax'];
        $totalAdditionalTaxes = $totals['total_additional_taxes'];
        $totalTaxes = $totals['total_taxes'];
        $totalRecalculatedCosts = $totals['total_recalculated_costs'];
        $totalRecalculatedCommissions = $totals['total_recalculated_commissions'];
        $totalRecalculatedPaymentFees = $totals['total_recalculated_payment_fees'];

        $totalSubsidies = $this->sumSubsidies(clone $baseQuery);
        $totalDiscounts = 0; // Descontos já estão no subtotal

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

        // Inicializar aggregations para breakdown
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
                'delivery_fee',
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
            &$orderCostsAggregation,
            $orderCostService
        ) {
            foreach ($orders as $order) {
                $label = $this->formatMarketplaceLabel($order->provider, $order->origin);

                // USAR OrderCostService para breakdown - consistente com totais
                $orderSubtotal = $orderCostService->getOrderSubtotal($order);

                $this->accumulateValue($revenueAggregation, $label, $orderSubtotal);

                $raw = $this->normalizeArray($order->raw);
                $subsidy = $this->extractSubsidyValue($raw);
                $this->accumulateValue($subsidiesAggregation, $label, $subsidy);

                $discountValue = max(((float) ($order->discount_total ?? 0)) - $subsidy, 0);
                $this->accumulateValue($discountsAggregation, $label, $discountValue);

                $calculatedCosts = $this->normalizeArray($order->calculated_costs);

                // Agregar custos para breakdown (totais já calculados pelo serviço)
                foreach (($calculatedCosts['costs'] ?? []) as $cost) {
                    if (! is_array($cost)) {
                        continue;
                    }

                    $costLabel = $cost['name'] ?? 'Custo não identificado';

                    if (($cost['type'] ?? '') === 'percentage') {
                        $costValue = ($orderSubtotal * (float) ($cost['value'] ?? 0)) / 100;
                    } else {
                        $costValue = (float) ($cost['calculated_value'] ?? 0);
                    }

                    $this->accumulateValue($orderCostsAggregation, $costLabel, $costValue);
                }

                // Agregar comissões para breakdown (totais já calculados pelo serviço)
                foreach (($calculatedCosts['commissions'] ?? []) as $commission) {
                    if (! is_array($commission)) {
                        continue;
                    }

                    $commissionLabel = $commission['name'] ?? 'Comissão não identificada';

                    if (($commission['type'] ?? '') === 'percentage') {
                        $commissionValue = ($orderSubtotal * (float) ($commission['value'] ?? 0)) / 100;
                    } else {
                        $commissionValue = (float) ($commission['calculated_value'] ?? 0);
                    }

                    $this->accumulateValue($commissionsAggregation, $commissionLabel, $commissionValue);
                }

                // Agregar taxas de pagamento para breakdown (totais já calculados pelo serviço)
                foreach (($calculatedCosts['payment_methods'] ?? []) as $payment) {
                    if (! is_array($payment)) {
                        continue;
                    }

                    $methodLabel = $payment['display_name']
                        ?? $payment['name']
                        ?? data_get($payment, 'payment_method.name')
                        ?? 'Taxa de pagamento';

                    if (($payment['type'] ?? '') === 'percentage') {
                        $methodValue = ($orderSubtotal * (float) ($payment['value'] ?? 0)) / 100;
                    } else {
                        $methodValue = (float) ($payment['calculated_value'] ?? 0);
                    }

                    $this->accumulateValue($paymentFeesAggregation, $methodLabel, $methodValue);
                }

                // Agregar impostos adicionais para breakdown (totais já calculados pelo serviço)
                foreach (($calculatedCosts['taxes'] ?? []) as $tax) {
                    if (! is_array($tax)) {
                        continue;
                    }

                    $taxLabel = $tax['display_name']
                        ?? $tax['name']
                        ?? $tax['title']
                        ?? 'Imposto adicional';

                    if (($tax['type'] ?? '') === 'percentage') {
                        $taxValue = ($orderSubtotal * (float) ($tax['value'] ?? 0)) / 100;
                    } else {
                        $taxValue = (float) ($tax['calculated_value'] ?? 0);
                    }

                    $this->accumulateValue($additionalTaxesAggregation, $taxLabel, $taxValue);
                }
            }
        });

        // Usar valores RECALCULADOS para Receita pós Dedução
        // Subtotal já tem descontos aplicados, não descontar novamente
        $revenueAfterDeductions = $grossRevenue - $totalRecalculatedPaymentFees - $totalRecalculatedCommissions;
        $revenueAfterDeductionsPercent = $grossRevenue > 0 ? ($revenueAfterDeductions / $grossRevenue) * 100 : 0;

        $contributionMargin = $revenueAfterDeductions - $totalCmv - $totalRecalculatedCosts - $totalTaxes;
        $contributionMarginPercent = $grossRevenue > 0 ? ($contributionMargin / $grossRevenue) * 100 : 0;

        $netProfit = $contributionMargin - $extraExpenses + $extraIncome;
        $netProfitPercent = $grossRevenue > 0 ? ($netProfit / $grossRevenue) * 100 : 0;

        $paymentFeesPercent = $grossRevenue > 0 ? ($totalRecalculatedPaymentFees / $grossRevenue) * 100 : 0;
        $commissionsPercent = $grossRevenue > 0 ? ($totalRecalculatedCommissions / $grossRevenue) * 100 : 0;
        $discountsPercent = $grossRevenue > 0 ? ($totalDiscounts / $grossRevenue) * 100 : 0;
        $subsidiesPercent = $grossRevenue > 0 ? ($totalSubsidies / $grossRevenue) * 100 : 0;
        $cmvPercent = $grossRevenue > 0 ? ($totalCmv / $grossRevenue) * 100 : 0;
        $orderCostsPercent = $grossRevenue > 0 ? ($totalRecalculatedCosts / $grossRevenue) * 100 : 0;
        $taxesPercent = $grossRevenue > 0 ? ($totalTaxes / $grossRevenue) * 100 : 0;
        $extraIncomePercent = $grossRevenue > 0 ? ($extraIncome / $grossRevenue) * 100 : 0;
        $extraExpensesPercent = $grossRevenue > 0 ? ($extraExpenses / $grossRevenue) * 100 : 0;

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
        $paymentFeesBreakdown = $this->formatBreakdownResponse($paymentFeesAggregation, $totalRecalculatedPaymentFees);
        $commissionsBreakdown = $this->formatBreakdownResponse($commissionsAggregation, $totalRecalculatedCommissions);
        $discountsBreakdown = $this->formatBreakdownResponse($discountsAggregation, $totalDiscounts);
        $subsidiesBreakdown = $this->formatBreakdownResponse($subsidiesAggregation, $totalSubsidies);

        $taxItems = $totalProductTax > 0
            ? ['Impostos dos produtos' => $totalProductTax] + $additionalTaxesAggregation
            : $additionalTaxesAggregation;

        $taxesBreakdown = $this->formatBreakdownResponse($taxItems, $totalTaxes);
        $orderCostsBreakdown = $this->formatBreakdownResponse($orderCostsAggregation, $totalRecalculatedCosts);
        $extraExpensesBreakdown = $this->formatBreakdownResponse($extraExpensesAggregation, $extraExpenses);
        $extraIncomeBreakdown = $this->formatBreakdownResponse($extraIncomeAggregation, $extraIncome);

        return Inertia::render('financial/summary', [
            'data' => [
                'grossRevenue' => $grossRevenue,
                'revenueByMarketplace' => $revenueByMarketplace,
                'revenueByStore' => $revenueByStore,
                'paymentFees' => $totalRecalculatedPaymentFees,
                'paymentFeesPercent' => $paymentFeesPercent,
                'paymentFeesBreakdown' => $paymentFeesBreakdown,
                'commissions' => $totalRecalculatedCommissions,
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
                'orderCosts' => $totalRecalculatedCosts,
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
        $orders = \DB::table('orders')
            ->leftJoin('stores', 'stores.id', '=', 'orders.store_id')
            ->where('orders.tenant_id', $tenantId)
            ->whereBetween('orders.placed_at', [$startDateUtc, $endDateUtc])
            ->select([
                'orders.provider',
                'orders.origin',
                'orders.store_id',
                'stores.display_name as store_name',
                'orders.gross_total',
                'orders.delivery_fee',
                'orders.raw',
            ])
            ->get();

        $marketplaceToStores = [];
        $storeToMarketplaces = [];

        foreach ($orders as $order) {
            // Calcular subtotal do pedido
            $deliveryFee = (float) $order->delivery_fee;
            $raw = is_string($order->raw) ? json_decode($order->raw, true) : (is_array($order->raw) ? $order->raw : []);
            $sessionPayments = $raw['session']['payments'] ?? [];

            $subsidies = collect($sessionPayments)->filter(function ($payment) {
                $paymentName = strtolower($payment['payment_method']['name'] ?? '');

                return str_contains($paymentName, 'subsid') || str_contains($paymentName, 'cupom');
            })->sum(fn ($p) => (float) ($p['payment_value'] ?? 0));

            $realPayments = collect($sessionPayments)
                ->filter(function ($payment) {
                    $paymentName = strtolower($payment['payment_method']['name'] ?? '');
                    $paymentKeyword = strtolower($payment['payment_method']['keyword'] ?? '');

                    return ! str_contains($paymentName, 'cashback')
                        && ! str_contains($paymentKeyword, 'clube')
                        && ! str_contains($paymentName, 'subsid')
                        && ! str_contains($paymentName, 'cupom');
                })
                ->sum(fn ($p) => (float) ($p['payment_value'] ?? 0));

            if ($realPayments == 0 && count($sessionPayments) == 0) {
                if ($order->provider === 'takeat' && isset($raw['session']['total_price'])) {
                    $realPayments = (float) $raw['session']['total_price'];
                } else {
                    $realPayments = (float) $order->gross_total;
                }
            }

            $deliveryBy = strtoupper($raw['session']['delivery_by'] ?? '');
            $isMarketplaceDelivery = in_array($deliveryBy, ['IFOOD', 'MARKETPLACE']);

            $orderSubtotal = $realPayments + $subsidies;
            if (! $isMarketplaceDelivery && $deliveryFee > 0) {
                $orderSubtotal += $deliveryFee;
            }

            $label = $this->formatMarketplaceLabel($order->provider, $order->origin);
            $storeName = $order->store_name ?? 'Loja não identificada';
            $value = $orderSubtotal;

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
