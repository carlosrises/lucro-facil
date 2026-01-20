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
                'items' => function ($query) {
                    // Selecionar apenas campos que existem na tabela order_items
                    $query->select('id', 'order_id', 'sku', 'name', 'qty', 'unit_price', 'total', 'add_ons', 'tenant_id', 'created_at', 'updated_at');
                },
                'items.internalProduct.taxCategory',
                'items.productMapping' => function ($query) {
                    $query->where('product_mappings.tenant_id', tenant_id());
                },
                'items.mappings.internalProduct',
                'items.mappings.orderItem', // Necessário para o accessor product_mapping funcionar
                'sale',
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

                // Converter datas do horário de Brasília para UTC para filtrar corretamente
                $startDateUtc = \Carbon\Carbon::parse($startDate.' 00:00:00', 'America/Sao_Paulo')->setTimezone('UTC')->toDateTimeString();
                $endDateUtc = \Carbon\Carbon::parse($endDate.' 23:59:59', 'America/Sao_Paulo')->setTimezone('UTC')->toDateTimeString();

                return $q->whereBetween('placed_at', [$startDateUtc, $endDateUtc]);
            })
            ->when($request->input('unmapped_only'), function ($q) {
                // Filtrar apenas pedidos com itens não mapeados
                $q->whereHas('items', function ($query) {
                    $query->whereDoesntHave('internalProduct');
                });
            })
            ->when($request->input('no_payment_method'), function ($q) {
                // Filtrar pedidos com método mas sem taxa aplicada
                $q->where(function ($query) {
                    $query->whereRaw("JSON_LENGTH(JSON_EXTRACT(calculated_costs, '$.payment_methods')) = 0 OR JSON_EXTRACT(calculated_costs, '$.payment_methods') IS NULL");
                })
                // Excluir pedidos Takeat sem pagamento (não têm como ter taxa)
                ->where(function ($query) {
                    $query->where('provider', '!=', 'takeat')
                        ->orWhereRaw("JSON_LENGTH(JSON_EXTRACT(raw, '$.session.payments')) > 0");
                });
            })
            ->when($request->input('no_payment_info'), function ($q) {
                // Filtrar pedidos Takeat sem informação de pagamento
                $q->where('provider', 'takeat')
                    ->whereRaw("JSON_LENGTH(JSON_EXTRACT(raw, '$.session.payments')) = 0 OR JSON_EXTRACT(raw, '$.session.payments') IS NULL");
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

        // Carregar ProductMappings dos add-ons (classificações da Triagem)
        // Coletar todos os SKUs de add-ons
        $addOnSkus = [];
        foreach ($orders->items() as $order) {
            foreach ($order->items as $item) {
                if (!empty($item->add_ons) && is_array($item->add_ons)) {
                    foreach ($item->add_ons as $addOn) {
                        $addOnName = is_array($addOn) ? ($addOn['name'] ?? '') : $addOn;
                        if ($addOnName) {
                            $addOnSkus[] = 'addon_' . md5($addOnName);
                        }
                    }
                }
            }
        }

        // Buscar todos ProductMappings de uma vez (evitar N+1)
        $productMappingsMap = [];
        if (!empty($addOnSkus)) {
            $productMappingsMap = \App\Models\ProductMapping::whereIn('external_item_id', array_unique($addOnSkus))
                ->where('tenant_id', tenant_id())
                ->with('internalProduct')
                ->get()
                ->keyBy('external_item_id');
        }

        // Enriquecer order_items com product_mappings dos add-ons
        foreach ($orders->items() as $order) {
            foreach ($order->items as $item) {
                if (!empty($item->add_ons) && is_array($item->add_ons)) {
                    // Criar array temporário com ProductMappings
                    $addOnMappings = [];
                    foreach ($item->add_ons as $index => $addOn) {
                        $addOnName = is_array($addOn) ? ($addOn['name'] ?? '') : $addOn;
                        $sku = 'addon_' . md5($addOnName);

                        if (isset($productMappingsMap[$sku])) {
                            $addOnMappings[$index] = $productMappingsMap[$sku];
                        }
                    }

                    // Adicionar ao item para acesso no frontend
                    $item->add_ons_product_mappings = $addOnMappings;
                }
            }
        }

        // TEMPORARIAMENTE DESABILITADO - Enriquecer add-ons causa timeout
        /*
        // Enriquecer add-ons com seus ProductMappings e unit_cost_override dos OrderItemMappings
        foreach ($orders->items() as $order) {
            foreach ($order->items as $item) {
                if (! empty($item->add_ons) && is_array($item->add_ons)) {
                    $addOnsWithMappings = [];
                    foreach ($item->add_ons as $index => $addOn) {
                        $addOnName = is_array($addOn) ? ($addOn['name'] ?? '') : $addOn;
                        $addOnQuantity = is_array($addOn) ? ($addOn['quantity'] ?? $addOn['qty'] ?? 1) : 1;
                        $addOnSku = 'addon_'.md5($addOnName);

                        // Buscar ProductMapping do add-on
                        $mapping = \App\Models\ProductMapping::where('external_item_id', $addOnSku)
                            ->where('tenant_id', tenant_id())
                            ->with('internalProduct:id,name,unit_cost,product_category')
                            ->first();

                        // CRÍTICO: Buscar OrderItemMapping do add-on para obter unit_cost_override e quantity (fração)
                        $orderItemMapping = \App\Models\OrderItemMapping::where('order_item_id', $item->id)
                            ->where('mapping_type', 'addon')
                            ->where('external_reference', (string) $index)
                            ->first();

                        // Usar unit_cost_override do OrderItemMapping se existir, senão fallback para unit_cost do produto
                        $unitCost = null;
                        $mappingQuantity = null;
                        if ($orderItemMapping && $orderItemMapping->unit_cost_override !== null) {
                            $unitCost = (float) $orderItemMapping->unit_cost_override;
                            $mappingQuantity = (float) $orderItemMapping->quantity; // Fração do sabor (ex: 0.25 para 1/4)
                        } elseif ($mapping && $mapping->internalProduct) {
                            $unitCost = (float) $mapping->internalProduct->unit_cost;
                            $mappingQuantity = 1.0; // Sem fração
                        }

                        $addOnsWithMappings[] = [
                            'name' => $addOnName,
                            'sku' => $addOnSku,
                            'external_code' => $addOnSku,
                            'quantity' => $addOnQuantity, // Quantidade do add-on (ex: 2 para "2x Don Rafaello")
                            'unit_cost_override' => $unitCost, // CMV unitário do OrderItemMapping
                            'mapping_quantity' => $mappingQuantity, // Fração do sabor (0.25 = 1/4)
                            'product_mapping' => $mapping ? [
                                'id' => $mapping->id,
                                'item_type' => $mapping->item_type,
                                'internal_product_id' => $mapping->internal_product_id,
                                'internal_product' => $mapping->internalProduct ? [
                                    'id' => $mapping->internalProduct->id,
                                    'name' => $mapping->internalProduct->name,
                                    'unit_cost' => $mapping->internalProduct->unit_cost,
                                    'product_category' => $mapping->internalProduct->product_category,
                                ] : null,
                            ] : null,
                        ];
                    }
                    $item->add_ons_enriched = $addOnsWithMappings;
                }
            }
        }
        */

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
        // IMPORTANTE: Aplicar MESMO filtro de data da query principal
        $startDate = $request->input('start_date', now()->startOfMonth()->format('Y-m-d'));
        $endDate = $request->input('end_date', now()->endOfMonth()->format('Y-m-d'));
        $startDateUtc = \Carbon\Carbon::parse($startDate.' 00:00:00', 'America/Sao_Paulo')->setTimezone('UTC')->toDateTimeString();
        $endDateUtc = \Carbon\Carbon::parse($endDate.' 23:59:59', 'America/Sao_Paulo')->setTimezone('UTC')->toDateTimeString();

        $noPaymentMethodCount = Order::where('tenant_id', tenant_id())
            ->whereBetween('placed_at', [$startDateUtc, $endDateUtc])
            ->where(function ($query) {
                // Com método mas sem taxa aplicada
                $query->whereRaw("JSON_LENGTH(JSON_EXTRACT(calculated_costs, '$.payment_methods')) = 0 OR JSON_EXTRACT(calculated_costs, '$.payment_methods') IS NULL");
            })
            // Excluir pedidos Takeat sem pagamento (não têm como ter taxa)
            ->where(function ($query) {
                $query->where('provider', '!=', 'takeat')
                    ->orWhereRaw("JSON_LENGTH(JSON_EXTRACT(raw, '$.session.payments')) > 0");
            })
            ->count();

        // Contador de pedidos sem informação de pagamento (apenas Takeat)
        $noPaymentInfoCount = Order::where('tenant_id', tenant_id())
            ->whereBetween('placed_at', [$startDateUtc, $endDateUtc])
            ->where('provider', 'takeat')
            ->whereRaw("JSON_LENGTH(JSON_EXTRACT(raw, '$.session.payments')) = 0 OR JSON_EXTRACT(raw, '$.session.payments') IS NULL")
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

        // Calcular indicadores do período (apenas pedidos não cancelados)
        $indicators = $this->calculatePeriodIndicators($request);

        return Inertia::render('orders', [
            'orders' => $orders,
            'indicators' => $indicators,
            'filters' => [
                'search' => $request->input('search'),
                'status' => $request->input('status'),
                'store_id' => $request->input('store_id'),
                'provider' => $request->input('provider'),
                'payment_method' => $request->input('payment_method'),
                'order_type' => $request->input('order_type'),
                'start_date' => $request->input('start_date', now()->startOfMonth()->format('Y-m-d')),
                'end_date' => $request->input('end_date', now()->endOfMonth()->format('Y-m-d')),
                'unmapped_only' => $request->input('unmapped_only'),
                'no_payment_method' => $request->input('no_payment_method'),
                'no_payment_info' => $request->input('no_payment_info'),
                'per_page' => $perPage,
            ],
            'stores' => $stores,
            'providerOptions' => $providerOptions,
            'unmappedProductsCount' => $unmappedProductsCount,
            'noPaymentMethodCount' => $noPaymentMethodCount,
            'noPaymentInfoCount' => $noPaymentInfoCount,
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

    /**
     * Vincular uma taxa de pagamento existente a um pedido (VÍNCULO MANUAL - sem restrições)
     * Suporta vínculo individual OU em massa (todos os pedidos com mesmo método de pagamento)
     */
    public function linkPaymentFee($id, Request $request)
    {
        $order = Order::where('tenant_id', tenant_id())->findOrFail($id);

        $validated = $request->validate([
            'payment_method' => 'required|string',
            'cost_commission_id' => 'required|exists:cost_commissions,id',
            'apply_to_all' => 'nullable|boolean', // Nova opção: aplicar a todos os pedidos
        ]);

        $linkService = app(\App\Services\PaymentFeeLinkService::class);

        // IMPORTANTE: Normalizar o método antes de vincular
        // O frontend envia o método "bruto" (ex: "others"), mas precisamos do normalizado (ex: "CREDIT_CARD")
        $rawMethod = $validated['payment_method'];
        $normalizedMethod = $linkService->normalizePaymentMethodForOrder($order, $rawMethod);

        // Se apply_to_all = true, aplicar para TODOS os pedidos do tenant com este método de pagamento
        if ($validated['apply_to_all'] ?? false) {
            $affectedCount = $linkService->bulkLinkPaymentFeeByMethod(
                tenant_id(),
                $normalizedMethod,
                $validated['cost_commission_id']
            );

            return redirect()->back()->with('success', "Taxa vinculada a {$affectedCount} pedido(s) com sucesso!");
        }

        // Vínculo individual (comportamento padrão)
        $success = $linkService->manuallyLinkPaymentFee(
            $order,
            $normalizedMethod,
            $validated['cost_commission_id']
        );

        if (!$success) {
            return redirect()->back()->with('error', 'Erro: Taxa não encontrada ou não pertence a este tenant.');
        }

        // Recalcular custos do pedido com o novo vínculo
        $service = app(\App\Services\OrderCostService::class);
        $result = $service->calculateCosts($order);

        $order->update([
            'calculated_costs' => $result,
            'total_costs' => $result['total_costs'] ?? 0,
            'total_commissions' => $result['total_commissions'] ?? 0,
            'net_revenue' => $result['net_revenue'] ?? 0,
            'costs_calculated_at' => now(),
        ]);

        return redirect()->back()->with('success', 'Taxa vinculada manualmente com sucesso!');
    }

    /**
     * Listar TODAS as taxas de pagamento para vínculo MANUAL (sem filtros restritivos)
     */
    public function availablePaymentFees($id, Request $request)
    {
        try {
            $order = Order::where('tenant_id', tenant_id())->findOrFail($id);

            $linkService = app(\App\Services\PaymentFeeLinkService::class);

            // Para vínculo manual, listar TODAS as taxas sem filtros
            $fees = $linkService->listAllPaymentFeesForManualLink(tenant_id());

            // Se foi passado paymentMethod e paymentType, adicionar informações de compatibilidade
            $paymentMethod = $request->query('payment_method');
            $paymentType = $request->query('payment_type', 'offline');

            if ($paymentMethod) {
                $fees = $fees->map(function ($fee) use ($linkService, $paymentMethod, $paymentType, $order) {
                    $compatibility = $linkService->checkFeeCompatibility(
                        $fee,
                        $paymentMethod,
                        $paymentType,
                        $order
                    );

                    return array_merge($fee->toArray(), [
                        'compatibility' => $compatibility,
                    ]);
                });
            }

            return response()->json($fees);
        } catch (\Exception $e) {
            \Log::error('Erro ao carregar taxas de pagamento disponíveis', [
                'order_id' => $id,
                'tenant_id' => tenant_id(),
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'error' => 'Erro ao carregar taxas de pagamento',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Calcular indicadores do período (Subtotal, Ticket Médio, CMV, Total Líquido)
     */
    private function calculatePeriodIndicators(Request $request): array
    {
        // Construir query base com os mesmos filtros da listagem
        $query = Order::query()
            ->where('tenant_id', tenant_id())
            ->where('status', '!=', 'CANCELLED') // Excluir cancelados dos indicadores
            ->when($request->input('store_id'), fn ($q, $storeId) => $q->where('store_id', $storeId))
            ->when($request->input('provider'), function ($q, $providerFilter) {
                if (str_contains($providerFilter, ':')) {
                    [$provider, $origin] = explode(':', $providerFilter, 2);
                    $q->where('provider', $provider)->where('origin', $origin);
                } else {
                    $q->where('provider', $providerFilter);
                }
            })
            ->when(true, function ($q) use ($request) {
                $startDate = $request->input('start_date', now()->startOfMonth()->format('Y-m-d'));
                $endDate = $request->input('end_date', now()->endOfMonth()->format('Y-m-d'));

                $startDateUtc = \Carbon\Carbon::parse($startDate.' 00:00:00', 'America/Sao_Paulo')->setTimezone('UTC')->toDateTimeString();
                $endDateUtc = \Carbon\Carbon::parse($endDate.' 23:59:59', 'America/Sao_Paulo')->setTimezone('UTC')->toDateTimeString();

                return $q->whereBetween('placed_at', [$startDateUtc, $endDateUtc]);
            })
            ->when($request->input('order_type'), function ($q, $orderType) {
                $normalizedType = strtoupper($orderType);
                $q->where(function ($query) use ($normalizedType) {
                    $query->where(function ($q) use ($normalizedType) {
                        $q->where('provider', 'takeat')
                            ->whereRaw("UPPER(JSON_UNQUOTE(JSON_EXTRACT(raw, '$.session.table.table_type'))) = ?", [$normalizedType]);
                    })
                        ->orWhereRaw("UPPER(JSON_UNQUOTE(JSON_EXTRACT(raw, '$.orderType'))) = ?", [$normalizedType]);
                });
            });

        // Usar agregações SQL para melhor performance
        $aggregates = $query->selectRaw('
            COUNT(*) as order_count,
            COALESCE(SUM(gross_total), 0) as total_gross,
            COALESCE(SUM(total_costs), 0) as total_cmv,
            COALESCE(SUM(net_revenue), 0) as total_net_revenue
        ')->first();

        $orderCount = (int) $aggregates->order_count;
        $subtotal = (float) $aggregates->total_gross;
        $cmv = (float) $aggregates->total_cmv;
        $netRevenue = (float) $aggregates->total_net_revenue;

        // Calcular ticket médio
        $averageTicket = $orderCount > 0 ? $subtotal / $orderCount : 0;

        return [
            'subtotal' => $subtotal,
            'averageTicket' => $averageTicket,
            'cmv' => $cmv,
            'netRevenue' => $netRevenue,
            'orderCount' => $orderCount,
        ];
    }

    /**
     * Retorna um pedido específico para API (usado no WebSocket)
     */
    public function show(int $id)
    {
        $order = Order::with([
            'items.internalProduct.taxCategory',
            'items.productMapping',
            'items.mappings.internalProduct',
            'sale',
        ])
            ->where('tenant_id', tenant_id())
            ->findOrFail($id);

        return response()->json($order);
    }
}
