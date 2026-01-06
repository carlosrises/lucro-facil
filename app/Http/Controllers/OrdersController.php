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
                'id', 'order_uuid', 'code', 'short_reference', 'status', 'provider', 'origin',
                'store_id', 'placed_at', 'gross_total', 'discount_total',
                'delivery_fee', 'tip', 'net_total', 'raw', 'tenant_id',
                'calculated_costs', 'total_costs', 'total_commissions', 'net_revenue', 'costs_calculated_at',
            ])
            ->with([
                'items.internalProduct.taxCategory',
                'items.mappings.internalProduct.taxCategory', // Novo: carregar múltiplas associações
                'items.productMapping' => function ($query) {
                    $query->where('product_mappings.tenant_id', tenant_id());
                }, // Carregar classificação do item
                'sale'
            ])
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
            ->when($request->input('provider'), function ($q, $providerFilter) {
                // Formato: "provider" ou "provider:origin"
                if (str_contains($providerFilter, ':')) {
                    [$provider, $origin] = explode(':', $providerFilter, 2);
                    $q->where('provider', $provider)->where('origin', $origin);
                } else {
                    $q->where('provider', $providerFilter);
                }
            })
            ->when(true, function ($q) use ($request) {
                // Sempre aplicar filtro de data (mês atual por padrão)
                $startDate = $request->input('start_date', now()->startOfMonth()->format('Y-m-d'));
                $endDate = $request->input('end_date', now()->endOfMonth()->format('Y-m-d'));

                // Converter datas do horário de Brasília para UTC
                $startDateUtc = \Carbon\Carbon::parse($startDate . ' 00:00:00', 'America/Sao_Paulo')->setTimezone('UTC')->toDateTimeString();
                $endDateUtc = \Carbon\Carbon::parse($endDate . ' 23:59:59', 'America/Sao_Paulo')->setTimezone('UTC')->toDateTimeString();

                return $q->whereBetween('placed_at', [$startDateUtc, $endDateUtc]);
            })
            ->when($request->input('unmapped_only'), function ($q) {
                // Filtrar apenas pedidos com itens não mapeados
                $q->whereHas('items', function ($query) {
                    $query->whereDoesntHave('internalProduct');
                });
            })
            ->when($request->input('no_payment_method'), function ($q) {
                // Filtrar pedidos sem taxa de pagamento vinculada
                // Inclui tanto pedidos sem método quanto pedidos com método mas sem taxa aplicada
                $q->where(function ($query) {
                    // 1. Pedidos sem método de pagamento (Takeat: session.payments vazio)
                    $query->where(function ($q) {
                        $q->where('provider', 'takeat')
                            ->whereRaw("JSON_LENGTH(JSON_EXTRACT(raw, '$.session.payments')) = 0 OR JSON_EXTRACT(raw, '$.session.payments') IS NULL");
                    })
                    // 2. OU pedidos com método mas sem taxa aplicada (calculated_costs->payment_methods vazio/null)
                    ->orWhere(function ($q) {
                        $q->whereRaw("JSON_LENGTH(JSON_EXTRACT(calculated_costs, '$.payment_methods')) = 0 OR JSON_EXTRACT(calculated_costs, '$.payment_methods') IS NULL");
                    });
                });
            })
            ->when($request->input('order_type'), function ($q, $orderType) {
                // Filtrar por tipo de pedido
                $q->where(function ($query) use ($orderType) {
                    // Normalizar o tipo para uppercase
                    $normalizedType = strtoupper($orderType);

                    // Para Takeat: verificar session.table.table_type
                    $query->where(function ($q) use ($normalizedType) {
                        $q->where('provider', 'takeat')
                            ->whereRaw("UPPER(JSON_UNQUOTE(JSON_EXTRACT(raw, '$.session.table.table_type'))) = ?", [$normalizedType]);
                    })
                    // Para outros providers (iFood, etc): verificar orderType
                    ->orWhereRaw("UPPER(JSON_UNQUOTE(JSON_EXTRACT(raw, '$.orderType'))) = ?", [$normalizedType]);
                });
            })
            ->when($request->input('search'), function ($q, $search) {
                // Buscar por ID, código do pedido ou short_reference
                $q->where(function ($query) use ($search) {
                    $query->where('id', 'like', "%{$search}%")
                        ->orWhere('code', 'like', "%{$search}%")
                        ->orWhere('short_reference', 'like', "%{$search}%");
                });
            })
            ->when($request->input('payment_method'), function ($q, $paymentMethod) {
                // Filtrar por meio de pagamento (suporta múltiplos valores separados por vírgula)
                $methods = is_array($paymentMethod) ? $paymentMethod : explode(',', $paymentMethod);
                $q->where(function ($query) use ($methods) {
                    foreach ($methods as $method) {
                        $method = trim(strtoupper($method));
                        // Para Takeat: verificar session.payments[].payment_method.method
                        $query->orWhereRaw("JSON_SEARCH(JSON_EXTRACT(raw, '$.session.payments[*].payment_method.method'), 'one', ?) IS NOT NULL", [$method]);
                    }
                });
            })
            ->orderByDesc('placed_at')
            ->orderByDesc('id');

        $perPage = (int) $request->input('per_page', 10);

        $orders = $query->paginate($perPage)->withQueryString();

        // Enriquecer add-ons com seus ProductMappings
        foreach ($orders->items() as $order) {
            foreach ($order->items as $item) {
                if (!empty($item->add_ons) && is_array($item->add_ons)) {
                    $addOnsWithMappings = [];
                    foreach ($item->add_ons as $addOn) {
                        $addOnName = is_array($addOn) ? ($addOn['name'] ?? '') : $addOn;
                        $addOnSku = 'addon_' . md5($addOnName);

                        // Buscar ProductMapping do add-on
                        $mapping = \App\Models\ProductMapping::where('external_item_id', $addOnSku)
                            ->where('tenant_id', tenant_id())
                            ->with('internalProduct:id,name,unit_cost,product_category')
                            ->first();

                        $addOnsWithMappings[] = [
                            'name' => $addOnName,
                            'sku' => $addOnSku,
                            'external_code' => $addOnSku,
                            'product_mapping' => $mapping ? [
                                'id' => $mapping->id,
                                'item_type' => $mapping->item_type,
                                'internal_product_id' => $mapping->internal_product_id,
                                'internal_product' => $mapping->internalProduct ? [
                                    'id' => $mapping->internalProduct->id,
                                    'name' => $mapping->internalProduct->name,
                                    'unit_cost' => $mapping->internalProduct->unit_cost,
                                    'product_category' => $mapping->internalProduct->product_category,
                                    // Se for sabor de pizza, incluir CMVs por tamanho
                                    'cmv_by_size' => $mapping->internalProduct->product_category === 'sabor_pizza' ? [
                                        'broto' => $mapping->internalProduct->calculateCMV('broto'),
                                        'media' => $mapping->internalProduct->calculateCMV('media'),
                                        'grande' => $mapping->internalProduct->calculateCMV('grande'),
                                        'familia' => $mapping->internalProduct->calculateCMV('familia'),
                                    ] : null,
                                ] : null,
                            ] : null,
                        ];
                    }
                    $item->add_ons_enriched = $addOnsWithMappings;
                }
            }
        }

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
                    ->where('tenant_id', tenant_id())
                    ->whereNotNull('internal_product_id'); // Apenas mappings com produto interno vinculado
            })
            ->distinct('sku')
            ->count('sku');

        // Contar pedidos sem taxa de pagamento vinculada
        // Inclui pedidos sem método OU com método mas sem taxa aplicada
        $noPaymentMethodCount = Order::where('tenant_id', tenant_id())
            ->where(function ($query) {
                // 1. Sem método de pagamento
                $query->where(function ($q) {
                    $q->where('provider', 'takeat')
                        ->whereRaw("JSON_LENGTH(JSON_EXTRACT(raw, '$.session.payments')) = 0 OR JSON_EXTRACT(raw, '$.session.payments') IS NULL");
                })
                // 2. OU com método mas sem taxa aplicada
                ->orWhere(function ($q) {
                    $q->whereRaw("JSON_LENGTH(JSON_EXTRACT(calculated_costs, '$.payment_methods')) = 0 OR JSON_EXTRACT(calculated_costs, '$.payment_methods') IS NULL");
                });
            })
            ->count();

        // Buscar produtos internos para associação
        $internalProducts = \App\Models\InternalProduct::query()
            ->where('tenant_id', tenant_id())
            ->select('id', 'name', 'sku', 'unit_cost')
            ->orderBy('name')
            ->get();

        // Buscar configurações de margem do tenant
        $tenant = \App\Models\Tenant::find(tenant_id());

        // Buscar combinações de provider+origin disponíveis nos pedidos
        $providerOptions = Order::where('tenant_id', tenant_id())
            ->select('provider', 'origin')
            ->distinct()
            ->orderBy('provider')
            ->orderBy('origin')
            ->get()
            ->map(function ($order) {
                // Mapear labels amigáveis
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

                $providerLabel = $providerLabels[$order->provider] ?? ucfirst($order->provider);

                // Se for Takeat com origin diferente de 'takeat', criar combinação
                if ($order->provider === 'takeat' && $order->origin && $order->origin !== 'takeat') {
                    $originLabel = $originLabels[$order->origin] ?? ucfirst($order->origin);
                    return [
                        'value' => "takeat:{$order->origin}",
                        'label' => "{$originLabel} (Takeat)",
                    ];
                }

                // Para outros providers ou Takeat próprio
                return [
                    'value' => $order->provider,
                    'label' => $providerLabel,
                ];
            })
            ->unique('value')
            ->values();

        return Inertia::render('orders', [
            'orders' => $orders,
            'filters' => [
                'status' => $request->input('status'),
                'store_id' => $request->input('store_id'),
                'provider' => $request->input('provider'),
                'order_type' => $request->input('order_type'),
                'start_date' => $request->input('start_date', now()->startOfMonth()->format('Y-m-d')),
                'end_date' => $request->input('end_date', now()->endOfMonth()->format('Y-m-d')),
                'unmapped_only' => $request->input('unmapped_only'),
                'no_payment_method' => $request->input('no_payment_method'),
                'per_page' => $perPage,
            ],
            'stores' => $stores,
            'providerOptions' => $providerOptions,
            'unmappedProductsCount' => $unmappedProductsCount,
            'noPaymentMethodCount' => $noPaymentMethodCount,
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

    /**
     * Recalcular custos e comissões de um pedido específico
     */
    public function recalculateCosts($id)
    {
        $order = Order::where('tenant_id', tenant_id())->findOrFail($id);

        $service = app(\App\Services\OrderCostService::class);
        $result = $service->calculateCosts($order);

        $order->update([
            'calculated_costs' => $result,
            'total_costs' => $result['total_costs'] ?? 0,
            'total_commissions' => $result['total_commissions'] ?? 0,
            'net_revenue' => $result['net_revenue'] ?? 0,
            'costs_calculated_at' => now(),
        ]);

        return back();
    }
}
