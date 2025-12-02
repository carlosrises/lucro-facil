<?php

namespace App\Http\Controllers;

use App\Models\FinanceEntry;
use App\Models\Order;
use App\Models\Sale;
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

        // 1. Faturamento por marketplace (pedidos concluídos)
        $salesByStore = Order::where('orders.tenant_id', $tenantId)
            ->where('orders.status', 'CON') // Concluído
            ->whereYear('orders.placed_at', $year)
            ->whereMonth('orders.placed_at', $monthNum)
            ->join('order_items', 'orders.id', '=', 'order_items.order_id')
            ->join('stores', 'orders.store_id', '=', 'stores.id')
            ->selectRaw('orders.store_id, stores.display_name as store_name, SUM(order_items.total) as total')
            ->groupBy('orders.store_id', 'stores.display_name')
            ->get();

        $totalRevenue = (float) $salesByStore->sum('total');

        $revenueByMarketplace = $salesByStore->map(function ($item) use ($totalRevenue) {
            $value = (float) ($item->total ?? 0);
            return [
                'name' => $item->store_name ?? 'Desconhecido',
                'value' => $value,
                'percentage' => $totalRevenue > 0 ? round(($value / $totalRevenue) * 100) : 0,
            ];
        });

        // 2. Receitas extras (movimentações de receita)
        $extraRevenue = (float) FinanceEntry::where('tenant_id', $tenantId)
            ->whereYear('occurred_on', $year)
            ->whereMonth('occurred_on', $monthNum)
            ->whereHas('category', function ($q) {
                $q->where('type', 'income');
            })
            ->sum('amount');

        // 3. Despesas operacionais
        $operationalExpenses = (float) FinanceEntry::where('tenant_id', $tenantId)
            ->whereYear('occurred_on', $year)
            ->whereMonth('occurred_on', $monthNum)
            ->whereHas('category', function ($q) {
                $q->where('type', 'expense');
            })
            ->sum('amount');

        // 4. Cálculos
        $netMarketplace = $totalRevenue; // Já é líquido das taxas do marketplace
        $grossProfit = $netMarketplace; // Simplificado, sem CMV por enquanto
        $netOperationalProfit = $grossProfit + $extraRevenue - $operationalExpenses;

        return Inertia::render('financial/summary', [
            'data' => [
                'revenue' => [
                    'total' => $totalRevenue,
                    'byMarketplace' => $revenueByMarketplace,
                ],
                'netMarketplace' => $netMarketplace,
                'grossProfit' => $grossProfit,
                'extraRevenue' => $extraRevenue,
                'operationalExpenses' => $operationalExpenses,
                'netOperationalProfit' => $netOperationalProfit,
            ],
            'filters' => [
                'month' => $month,
            ],
        ]);
    }
}
