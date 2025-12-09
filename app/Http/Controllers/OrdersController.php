<?php

namespace App\Http\Controllers;

use App\Enums\IfoodOrderStatus;
use App\Models\Order;
use App\Models\Store;
use Illuminate\Http\Request;
use Inertia\Inertia;

class OrdersController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $query = Order::query()
            ->select([
                'id', 'order_uuid', 'code', 'status', 'provider', 'origin',
                'store_id', 'placed_at', 'gross_total', 'discount_total',
                'delivery_fee', 'tip', 'net_total', 'raw', 'tenant_id',
                'total_costs', 'total_commissions', 'net_revenue', 'costs_calculated_at',
            ])
            ->with(['items.internalProduct.taxCategory', 'sale'])
            ->where('tenant_id', tenant_id())
            ->when($request->input('status'), function ($q, $status) {
                // Aceita tanto status completo quanto abreviado usando o Enum
                if ($status !== 'all') {
                    $abbreviated = IfoodOrderStatus::fullCodeToCode($status);
                    $q->where(function ($query) use ($status, $abbreviated) {
                        $query->where('status', $status)
                            ->orWhere('status', $abbreviated);
                    });
                }

                return $q;
            })
            ->when($request->input('store_id'), fn ($q, $storeId) => $q->where('store_id', $storeId)
            )
            ->when($request->input('provider'), fn ($q, $provider) => $q->where('provider', $provider)
            )
            ->when($request->input('start_date') && $request->input('end_date'), fn ($q) => $q->whereBetween('placed_at', [
                request('start_date').' 00:00:00',
                request('end_date').' 23:59:59',
            ])
            )
            ->when($request->input('unmapped_only'), function ($q) {
                // Filtrar apenas pedidos com itens não mapeados
                $q->whereHas('items', function ($query) {
                    $query->whereDoesntHave('internalProduct');
                });
            })
            ->orderByDesc('placed_at')
            ->orderByDesc('id');

        $perPage = (int) $request->input('per_page', 10);

        $orders = $query->paginate($perPage)->withQueryString();

        // Para popular o filtro de lojas dinamicamente
        $stores = Store::query()
            ->select('id', 'display_name AS name')
            ->orderBy('display_name')
            ->get();

        // Contar produtos únicos não associados
        $unmappedProductsCount = \App\Models\OrderItem::query()
            ->where('tenant_id', tenant_id())
            ->whereNotNull('sku')
            ->whereNotIn('sku', function ($query) {
                $query->select('external_item_id')
                    ->from('product_mappings')
                    ->where('tenant_id', tenant_id());
            })
            ->distinct('sku')
            ->count('sku');

        // Buscar produtos internos para associação
        $internalProducts = \App\Models\InternalProduct::query()
            ->where('tenant_id', tenant_id())
            ->select('id', 'name', 'sku', 'unit_cost')
            ->orderBy('name')
            ->get();

        // Buscar configurações de margem do tenant
        $tenant = \App\Models\Tenant::find(tenant_id());

        return Inertia::render('orders', [
            'orders' => $orders,
            'filters' => [
                'status' => $request->input('status'),
                'store_id' => $request->input('store_id'),
                'provider' => $request->input('provider'),
                'start_date' => $request->input('start_date'),
                'end_date' => $request->input('end_date'),
                'unmapped_only' => $request->input('unmapped_only'),
                'per_page' => $perPage,
            ],
            'stores' => $stores,
            'unmappedProductsCount' => $unmappedProductsCount,
            'internalProducts' => $internalProducts,
            'marginSettings' => [
                'margin_excellent' => (float) ($tenant->margin_excellent ?? 100.00),
                'margin_good_min' => (float) ($tenant->margin_good_min ?? 30.00),
                'margin_good_max' => (float) ($tenant->margin_good_max ?? 99.99),
                'margin_poor' => (float) ($tenant->margin_poor ?? 0.00),
            ],
        ]);
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        //
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        //
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id)
    {
        //
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(string $id)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $id)
    {
        //
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id)
    {
        //
    }

    /**
     * POST /orders/{id}/confirm
     * Confirma um pedido
     */
    public function confirm($id)
    {
        try {
            $order = Order::where('id', $id)
                ->where('tenant_id', auth()->user()->tenant_id)
                ->firstOrFail();

            if ($order->provider !== 'ifood') {
                return response()->json([
                    'success' => false,
                    'message' => 'Apenas pedidos iFood podem ser confirmados por esta ação',
                ], 400);
            }

            if (! $order->store_id) {
                return response()->json([
                    'success' => false,
                    'message' => 'Pedido sem loja associada. Sincronize novamente os pedidos.',
                ], 400);
            }

            $client = new \App\Services\IfoodClient($order->tenant_id, $order->store_id);
            $result = $client->confirmOrder($order->order_uuid);

            // Atualiza status local
            $order->update(['status' => 'CONFIRMED']);

            return response()->json([
                'success' => true,
                'message' => 'Pedido confirmado com sucesso',
                'data' => $result,
            ]);
        } catch (\Throwable $e) {
            logger()->error('Erro ao confirmar pedido', [
                'order_id' => $id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Erro ao confirmar pedido: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * POST /orders/{id}/dispatch
     * Despacha um pedido (inicia entrega)
     */
    public function dispatch($id)
    {
        try {
            $order = Order::where('id', $id)
                ->where('tenant_id', auth()->user()->tenant_id)
                ->firstOrFail();

            if ($order->provider !== 'ifood') {
                return response()->json([
                    'success' => false,
                    'message' => 'Apenas pedidos iFood podem ser despachados por esta ação',
                ], 400);
            }

            if (! $order->store_id) {
                return response()->json([
                    'success' => false,
                    'message' => 'Pedido sem loja associada. Sincronize novamente os pedidos.',
                ], 400);
            }

            $client = new \App\Services\IfoodClient($order->tenant_id, $order->store_id);
            $result = $client->dispatchOrder($order->order_uuid);

            // Atualiza status local
            $order->update(['status' => 'DISPATCHED']);

            return response()->json([
                'success' => true,
                'message' => 'Pedido despachado com sucesso',
                'data' => $result,
            ]);
        } catch (\Throwable $e) {
            logger()->error('Erro ao despachar pedido', [
                'order_id' => $id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Erro ao despachar pedido: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * POST /orders/{id}/ready
     * Marca pedido TAKEOUT como pronto para retirada
     */
    public function ready($id)
    {
        try {
            $order = Order::where('id', $id)
                ->where('tenant_id', auth()->user()->tenant_id)
                ->firstOrFail();

            if ($order->provider !== 'ifood') {
                return response()->json([
                    'success' => false,
                    'message' => 'Apenas pedidos iFood podem usar esta ação',
                ], 400);
            }

            if (! $order->store_id) {
                return response()->json([
                    'success' => false,
                    'message' => 'Pedido sem loja associada. Sincronize novamente os pedidos.',
                ], 400);
            }

            $client = new \App\Services\IfoodClient($order->tenant_id, $order->store_id);
            $result = $client->readyToPickup($order->order_uuid);

            // Atualiza status local
            $order->update(['status' => 'READY_TO_PICKUP']);

            return response()->json([
                'success' => true,
                'message' => 'Pedido marcado como pronto para retirada',
                'data' => $result,
            ]);
        } catch (\Throwable $e) {
            logger()->error('Erro ao marcar pedido como pronto', [
                'order_id' => $id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Erro ao marcar pedido como pronto: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * GET /orders/{id}/cancellation-reasons
     * Lista motivos de cancelamento disponíveis
     */
    public function cancellationReasons($id)
    {
        try {
            $order = Order::where('id', $id)
                ->where('tenant_id', auth()->user()->tenant_id)
                ->firstOrFail();

            if ($order->provider !== 'ifood') {
                return response()->json([
                    'success' => false,
                    'message' => 'Apenas pedidos iFood possuem motivos de cancelamento',
                ], 400);
            }

            if (! $order->store_id) {
                return response()->json([
                    'success' => false,
                    'message' => 'Pedido sem loja associada. Sincronize novamente os pedidos.',
                ], 400);
            }

            $client = new \App\Services\IfoodClient($order->tenant_id, $order->store_id);
            $reasons = $client->getCancellationReasons($order->order_uuid);

            return response()->json([
                'success' => true,
                'data' => $reasons,
            ]);
        } catch (\Throwable $e) {
            logger()->error('Erro ao buscar motivos de cancelamento', [
                'order_id' => $id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Erro ao buscar motivos: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * POST /orders/{id}/cancel
     * Cancela um pedido
     */
    public function cancel(Request $request, $id)
    {
        $request->validate([
            'cancellation_code' => 'required|string',
        ]);

        try {
            $order = Order::where('id', $id)
                ->where('tenant_id', auth()->user()->tenant_id)
                ->firstOrFail();

            if ($order->provider !== 'ifood') {
                return response()->json([
                    'success' => false,
                    'message' => 'Apenas pedidos iFood podem ser cancelados por esta ação',
                ], 400);
            }

            if (! $order->store_id) {
                return response()->json([
                    'success' => false,
                    'message' => 'Pedido sem loja associada. Sincronize novamente os pedidos.',
                ], 400);
            }

            $client = new \App\Services\IfoodClient($order->tenant_id, $order->store_id);
            $result = $client->cancelOrder(
                $order->order_uuid,
                $request->input('cancellation_code')
            );

            // Atualiza status local
            $order->update(['status' => 'CANCELLED']);

            return response()->json([
                'success' => true,
                'message' => 'Pedido cancelado com sucesso',
                'data' => $result,
            ]);
        } catch (\Throwable $e) {
            logger()->error('Erro ao cancelar pedido', [
                'order_id' => $id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Erro ao cancelar pedido: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * POST /orders/{id}/dispute/{disputeId}/accept
     * Aceita uma disputa de cancelamento (Handshake Platform)
     */
    public function acceptDispute($id, $disputeId)
    {
        try {
            $order = Order::where('id', $id)
                ->where('tenant_id', auth()->user()->tenant_id)
                ->firstOrFail();

            if ($order->provider !== 'ifood') {
                return response()->json([
                    'success' => false,
                    'message' => 'Apenas pedidos iFood possuem este recurso',
                ], 400);
            }

            $client = new \App\Services\IfoodClient($order->tenant_id, $order->store_id);
            $result = $client->acceptDispute($disputeId);

            // Atualiza status local
            $order->update(['status' => 'CANCELLED']);

            return response()->json([
                'success' => true,
                'message' => 'Disputa aceita. Pedido será cancelado.',
                'data' => $result,
            ]);
        } catch (\Throwable $e) {
            logger()->error('Erro ao aceitar disputa', [
                'order_id' => $id,
                'dispute_id' => $disputeId,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Erro: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * POST /orders/{id}/dispute/{disputeId}/reject
     * Rejeita uma disputa de cancelamento (Handshake Platform)
     */
    public function rejectDispute(Request $request, $id, $disputeId)
    {
        $request->validate([
            'reason' => 'required|string|max:250',
        ]);

        try {
            $order = Order::where('id', $id)
                ->where('tenant_id', auth()->user()->tenant_id)
                ->firstOrFail();

            if ($order->provider !== 'ifood') {
                return response()->json([
                    'success' => false,
                    'message' => 'Apenas pedidos iFood possuem este recurso',
                ], 400);
            }

            $client = new \App\Services\IfoodClient($order->tenant_id, $order->store_id);
            $result = $client->rejectDispute(
                $disputeId,
                $request->input('reason')
            );

            return response()->json([
                'success' => true,
                'message' => 'Disputa rejeitada. Cancelamento negado.',
                'data' => $result,
            ]);
        } catch (\Throwable $e) {
            logger()->error('Erro ao rejeitar disputa', [
                'order_id' => $id,
                'dispute_id' => $disputeId,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Erro: '.$e->getMessage(),
            ], 500);
        }
    }
}
