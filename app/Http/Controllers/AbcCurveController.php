<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\InternalProduct;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class AbcCurveController extends Controller
{
    public function index(Request $request)
    {
        $tenantId = $request->user()->tenant_id;

        // Filtro de período (mês atual por padrão)
        $startDate = $request->input('start_date', now()->startOfMonth()->format('Y-m-d'));
        $endDate = $request->input('end_date', now()->endOfMonth()->format('Y-m-d'));

        // Converter datas do horário de Brasília para UTC
        $startDateUtc = Carbon::parse($startDate . ' 00:00:00', 'America/Sao_Paulo')->setTimezone('UTC')->toDateTimeString();
        $endDateUtc = Carbon::parse($endDate . ' 23:59:59', 'America/Sao_Paulo')->setTimezone('UTC')->toDateTimeString();

        // Buscar itens de pedidos do período agrupados por produto interno
        // Nota: order_items usa SKU para mapear produtos via product_mappings
        $productsData = DB::table('order_items')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->join('product_mappings', function ($join) use ($tenantId) {
                $join->on('product_mappings.external_item_id', '=', 'order_items.sku')
                    ->where('product_mappings.tenant_id', '=', $tenantId);
            })
            ->where('orders.tenant_id', $tenantId)
            ->whereBetween('orders.placed_at', [$startDateUtc, $endDateUtc])
            ->whereNotNull('product_mappings.internal_product_id')
            ->select([
                'product_mappings.internal_product_id',
                DB::raw('SUM(order_items.qty) as total_quantity'),
                DB::raw('SUM(order_items.qty * order_items.unit_price) as total_revenue'),
                DB::raw('COUNT(DISTINCT order_items.order_id) as order_count'),
            ])
            ->groupBy('product_mappings.internal_product_id')
            ->orderBy('total_revenue', 'desc')
            ->get();

        // Calcular totais
        $totalRevenue = $productsData->sum('total_revenue');
        $totalQuantity = $productsData->sum('total_quantity');

        // Classificar produtos em curvas ABC
        $cumulativeRevenue = 0;
        $curveA = [];
        $curveB = [];
        $curveC = [];

        foreach ($productsData as $product) {
            $cumulativeRevenue += $product->total_revenue;
            $percentage = ($cumulativeRevenue / $totalRevenue) * 100;

            $productData = [
                'internal_product_id' => $product->internal_product_id,
                'total_quantity' => $product->total_quantity,
                'total_revenue' => $product->total_revenue,
                'order_count' => $product->order_count,
                'percentage' => ($product->total_revenue / $totalRevenue) * 100,
                'cumulative_percentage' => $percentage,
            ];

            if ($percentage <= 80) {
                $curveA[] = $productData;
            } elseif ($percentage <= 95) {
                $curveB[] = $productData;
            } else {
                $curveC[] = $productData;
            }
        }

        // Carregar detalhes dos produtos
        $productIds = $productsData->pluck('internal_product_id')->unique();
        $products = InternalProduct::whereIn('id', $productIds)
            ->select(['id', 'name', 'sku', 'unit_cost'])
            ->get()
            ->keyBy('id');

        // Preparar dados para a tabela
        $tableData = $productsData->map(function ($item) use ($products, $totalRevenue, $curveA, $curveB) {
            $product = $products->get($item->internal_product_id);

            // Determinar curva
            $curve = 'C';
            if (collect($curveA)->where('internal_product_id', $item->internal_product_id)->isNotEmpty()) {
                $curve = 'A';
            } elseif (collect($curveB)->where('internal_product_id', $item->internal_product_id)->isNotEmpty()) {
                $curve = 'B';
            }

            // Calcular lucro (simplificado)
            $cost = $product ? (float) $product->unit_cost * $item->total_quantity : 0;
            $profit = $item->total_revenue - $cost;

            return [
                'id' => $item->internal_product_id,
                'name' => $product ? $product->name : 'Produto não mapeado',
                'sku' => $product ? $product->sku : null,
                'quantity' => (float) $item->total_quantity,
                'revenue' => (float) $item->total_revenue,
                'profit' => $profit,
                'cost' => $cost,
                'order_count' => $item->order_count,
                'percentage' => ($item->total_revenue / $totalRevenue) * 100,
                'curve' => $curve,
            ];
        });

        // Calcular métricas dos cards
        $curveAMetrics = [
            'quantity' => collect($curveA)->sum('total_quantity'),
            'revenue' => collect($curveA)->sum('total_revenue'),
            'count' => count($curveA),
        ];

        $curveBMetrics = [
            'quantity' => collect($curveB)->sum('total_quantity'),
            'revenue' => collect($curveB)->sum('total_revenue'),
            'count' => count($curveB),
        ];

        $curveCMetrics = [
            'quantity' => $totalQuantity - $curveAMetrics['quantity'] - $curveBMetrics['quantity'],
            'revenue' => $totalRevenue - $curveAMetrics['revenue'] - $curveBMetrics['revenue'],
            'count' => $productsData->count() - count($curveA) - count($curveB),
        ];

        return Inertia::render('abc-curve', [
            'products' => $tableData->values(),
            'metrics' => [
                'curveA' => $curveAMetrics,
                'curveB' => $curveBMetrics,
                'curveC' => $curveCMetrics,
                'total' => [
                    'quantity' => $totalQuantity,
                    'revenue' => $totalRevenue,
                    'count' => $productsData->count(),
                ],
            ],
            'filters' => [
                'start_date' => $startDate,
                'end_date' => $endDate,
            ],
        ]);
    }
}
