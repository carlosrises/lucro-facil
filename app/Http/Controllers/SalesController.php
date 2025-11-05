<?php

namespace App\Http\Controllers;

use App\Jobs\SyncSalesJob;
use App\Models\Sale;
use App\Models\Store;
use Illuminate\Http\Request;
use Inertia\Inertia;

class SalesController extends Controller
{
    /**
     * GET /api/ifood/sales
     * Exibe dados financeiros/faturamento do Financial API v3.0
     *
     * Filtros:
     * - store_id: int
     * - status: string (ex: CONCLUDED, CANCELLED)
     * - channel: string (ex: IFOOD)
     * - search: string (busca por short_id ou sale_uuid)
     * - start_date, end_date: YYYY-MM-DD
     * - per_page: int (default 10)
     */
    public function index(Request $request)
    {
        $query = Sale::query()
            ->where('tenant_id', tenant_id())
            ->when($request->input('status'), fn ($q, $status) => $q->where('current_status', $status))
            ->when($request->input('store_id'), fn ($q, $storeId) => $q->where('store_id', $storeId))
            ->when($request->input('channel'), fn ($q, $channel) => $q->where('sales_channel', $channel))
            ->when($request->input('search'), fn ($q, $search) => $q->where(function ($query) use ($search) {
                $query->where('short_id', 'like', "%{$search}%")
                    ->orWhere('sale_uuid', 'like', "%{$search}%");
            }))
            ->when($request->input('start_date') && $request->input('end_date'), fn ($q) => $q->whereBetween('sale_created_at', [
                request('start_date').' 00:00:00',
                request('end_date').' 23:59:59',
            ]))
            ->orderByDesc('sale_created_at')
            ->orderByDesc('id');

        $perPage = (int) $request->input('per_page', 10);
        $paginatedSales = $query->paginate($perPage)->withQueryString();

        // Mapear dados financeiros do Financial API v3.0
        $mappedSales = $paginatedSales->getCollection()->map(function ($sale) {
            $rawData = is_array($sale->raw) ? $sale->raw : [];
            $billingSummary = $rawData['billingSummary'] ?? [];
            $billingEntries = $billingSummary['billingEntries'] ?? [];

            // Extrair valores de comissões, taxas e repasses
            $commissions = collect($billingEntries)->where('type', 'COMMISSION')->sum('value');
            $fees = collect($billingEntries)->where('type', 'FEE')->sum('value');
            $transfers = collect($billingEntries)->where('type', 'TRANSFER')->sum('value');

            return [
                'id' => $sale->id,
                'sale_id' => $sale->short_id ?? $sale->sale_uuid,
                'type' => $sale->type,
                'category' => $sale->category,
                'status' => $sale->current_status,
                'channel' => $sale->sales_channel,
                'sale_date' => $sale->sale_created_at?->format('Y-m-d H:i:s'),
                'concluded_date' => $sale->concluded_at?->format('Y-m-d H:i:s'),
                'expected_payment_date' => $sale->expected_payment_date?->format('Y-m-d'),

                // Valores financeiros
                'bag_value' => $sale->bag_value ?? 0,
                'delivery_fee' => $sale->delivery_fee ?? 0,
                'service_fee' => $sale->service_fee ?? 0,
                'gross_value' => $sale->gross_value ?? 0,
                'discount_value' => $sale->discount_value ?? 0,
                'net_value' => $sale->net_value ?? 0,

                // Informações de pagamento
                'payment_method' => $sale->payment_method,
                'payment_brand' => $sale->payment_brand,
                'payment_value' => $sale->payment_value ?? 0,
                'payment_liability' => $sale->payment_liability,

                // Valores extraídos de billingEntries
                'commissions' => $commissions,
                'fees' => $fees,
                'transfers' => $transfers,
                'sale_balance' => $sale->net_value ?? 0,

                // BillingEntries detalhados
                'billing_entries' => $billingEntries,
            ];
        });

        $sales = new \Illuminate\Pagination\LengthAwarePaginator(
            $mappedSales,
            $paginatedSales->total(),
            $paginatedSales->perPage(),
            $paginatedSales->currentPage(),
            [
                'path' => request()->url(),
                'pageName' => 'page',
            ]
        );

        $sales->appends(request()->query());

        $stores = Store::query()
            ->select('id', 'display_name AS name')
            ->where('tenant_id', tenant_id())
            ->orderBy('display_name')
            ->get();

        return Inertia::render('sales', [
            'sales' => $sales,
            'filters' => [
                'status' => $request->input('status'),
                'store_id' => $request->input('store_id'),
                'channel' => $request->input('channel'),
                'search' => $request->input('search'),
                'start_date' => $request->input('start_date'),
                'end_date' => $request->input('end_date'),
                'per_page' => $perPage,
            ],
            'stores' => $stores,
        ]);
    }

    /**
     * Exibe uma venda específica.
     */
    public function show(Sale $sale)
    {
        // return Inertia::render('sales/show', ['sale' => $sale]);
    }

    /**
     * POST /api/ifood/sales/sync
     * Aciona o job de sincronização (assíncrono)
     */
    public function sync(Request $request)
    {
        $validated = $request->validate([
            'store_id' => ['required', 'integer', 'exists:stores,id'],
        ]);

        $storeId = (int) $validated['store_id'];
        $tenantId = (int) auth()->user()->tenant_id;

        // (Opcional) verificação de ownership do store
        $store = Store::where('tenant_id', $tenantId)->findOrFail($storeId);

        dispatch(new SyncSalesJob($tenantId, $store->id));

        return response()->json([
            'success' => true,
            'message' => 'Sincronização de vendas iniciada.',
        ]);
    }
}
