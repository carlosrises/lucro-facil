<?php

namespace App\Http\Controllers;

use App\Enums\IfoodOrderStatus;
use App\Models\Order;
use App\Models\Store;
use App\Services\FinancialAggregationService;
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
            // Carregar items + mappings (sale carregado apenas ao expandir, por lazy loading)
            ->with([
                'items:id,order_id,sku,name,qty,unit_price,total,add_ons,tenant_id',
                'items.mappings:id,order_item_id,internal_product_id,unit_cost_override,quantity,mapping_type,external_reference',
                'items.mappings.internalProduct:id,name,unit_cost',
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
        $storeProviders = Store::where('tenant_id', tenant_id())
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
        $takeatOrigins = Order::where('tenant_id', tenant_id())
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

        // Combinar e ordenar
        $providerOptions = $storeProviders
            ->merge($takeatOrigins)
            ->unique('value')
            ->sortBy('label')
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
                'margin_excellent' => (float) ($tenant->margin_excellent ?? 30.00),
                'margin_good_min' => (float) ($tenant->margin_good_min ?? 21.00),
                'margin_good_max' => (float) ($tenant->margin_good_max ?? 29.00),
                'margin_poor' => (float) ($tenant->margin_poor ?? 20.00),
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
    /**
     * Retorna um pedido específico para API (usado no WebSocket)
     */
    public function show(string $id)
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
            'payment_method' => 'required', // Aceitar string ou integer
            'payment_method_name' => 'nullable|string',
            'cost_commission_id' => 'nullable|exists:cost_commissions,id',
            'has_no_fee' => 'nullable|boolean',
            'payment_category' => 'nullable|in:payment,subsidy,cashback',
            'apply_to_all' => 'nullable|boolean',
        ]);

        // Converter payment_method para string
        $validated['payment_method'] = (string) $validated['payment_method'];

        // Se não tem taxa, marcar como has_no_fee
        $hasNoFee = $validated['has_no_fee'] ?? false;
        $paymentCategory = $validated['payment_category'] ?? 'payment';

        // Se não for "sem taxa" e não for subsídio/cashback, cost_commission_id é obrigatório
        if (! $hasNoFee && $paymentCategory === 'payment' && empty($validated['cost_commission_id'])) {
            return redirect()->back()->with('error', 'Taxa de pagamento é obrigatória.');
        }

        // Para pedidos Takeat, usar a lógica da Triagem (PaymentMethodMapping)
        if ($order->provider === 'takeat') {
            // Pegar o external_payment_method_id do pagamento no raw
            $payments = $order->raw['session']['payments'] ?? [];
            $externalPaymentMethodId = null;

            foreach ($payments as $payment) {
                $paymentMethodId = (string) ($payment['payment_method']['id'] ?? '');
                $paymentMethodName = (string) ($payment['payment_method']['name'] ?? '');

                // Comparar tanto por ID quanto por nome
                if ($paymentMethodId === $validated['payment_method'] ||
                    $paymentMethodName === $validated['payment_method']) {
                    $externalPaymentMethodId = $paymentMethodId;
                    break;
                }
            }

            if (! $externalPaymentMethodId) {
                return redirect()->back()->with('error', 'Método de pagamento não encontrado no pedido.');
            }

            // Criar ou atualizar mapping (igual à Triagem)
            $mapping = \App\Models\PaymentMethodMapping::updateOrCreate(
                [
                    'tenant_id' => tenant_id(),
                    'external_payment_method_id' => $externalPaymentMethodId,
                    'provider' => 'takeat',
                ],
                [
                    'payment_method_name' => $validated['payment_method_name'] ?? $validated['payment_method'],
                    'payment_method_keyword' => null, // Pode adicionar depois se necessário
                    'cost_commission_id' => $validated['cost_commission_id'],
                    'has_no_fee' => $hasNoFee,
                    'payment_category' => $paymentCategory,
                    'recalculating_since' => now(),
                ]
            );

            // Disparar job para recalcular pedidos em background (igual à Triagem)
            \App\Jobs\RecalculatePaymentMethodOrders::dispatch(
                tenant_id(),
                $externalPaymentMethodId
            );

            return back()->with('success', 'Taxa vinculada com sucesso! Pedidos sendo recalculados em segundo plano.');
        }

        // Para outros providers (iFood, etc), manter lógica antiga
        $linkService = app(\App\Services\PaymentFeeLinkService::class);
        $normalizedMethod = $linkService->normalizePaymentMethodForOrder($order, $validated['payment_method']);

        if ($validated['apply_to_all'] ?? false) {
            $affectedCount = $linkService->bulkLinkPaymentFeeByMethod(
                tenant_id(),
                $normalizedMethod,
                $validated['cost_commission_id']
            );

            return redirect()->back()->with('success', "Taxa vinculada a {$affectedCount} pedidos com sucesso.");
        }

        return redirect()->back()->with('success', 'Vínculo criado e recálculo iniciado.');
    }

    public function apiLinkPaymentFee($id, Request $request)
    {
        $order = Order::where('tenant_id', tenant_id())->findOrFail($id);

        $validated = $request->validate([
            'payment_method' => 'required',
            'payment_method_name' => 'nullable|string',
            'cost_commission_id' => 'nullable|exists:cost_commissions,id',
            'has_no_fee' => 'nullable|boolean',
            'payment_category' => 'nullable|in:payment,subsidy,discount',
            'apply_to_all' => 'nullable|boolean',
        ]);

        // Converter payment_method para string
        $validated['payment_method'] = (string) $validated['payment_method'];

        // Se não tem taxa, marcar como has_no_fee
        $hasNoFee = $validated['has_no_fee'] ?? false;
        $paymentCategory = $validated['payment_category'] ?? 'payment';

        // Se não for "sem taxa" e não for subsídio/cashback, cost_commission_id é obrigatório
        if (! $hasNoFee && $paymentCategory === 'payment' && empty($validated['cost_commission_id'])) {
            return response()->json([
                'success' => false,
                'message' => 'Taxa de pagamento é obrigatória.',
            ], 422);
        }

        // Para pedidos Takeat, usar a lógica da Triagem (PaymentMethodMapping)
        if ($order->provider === 'takeat') {
            // Pegar o external_payment_method_id do pagamento no raw
            $payments = $order->raw['session']['payments'] ?? [];
            $externalPaymentMethodId = null;

            foreach ($payments as $payment) {
                $paymentMethodId = (string) ($payment['payment_method']['id'] ?? '');
                $paymentMethodName = (string) ($payment['payment_method']['name'] ?? '');

                // Comparar tanto por ID quanto por nome
                if ($paymentMethodId === $validated['payment_method'] ||
                    $paymentMethodName === $validated['payment_method']) {
                    $externalPaymentMethodId = $paymentMethodId;
                    break;
                }
            }

            if (! $externalPaymentMethodId) {
                return response()->json([
                    'success' => false,
                    'message' => 'Método de pagamento não encontrado no pedido.',
                ], 422);
            }

            // Criar ou atualizar mapping (igual à Triagem)
            $mapping = \App\Models\PaymentMethodMapping::updateOrCreate(
                [
                    'tenant_id' => tenant_id(),
                    'external_payment_method_id' => $externalPaymentMethodId,
                    'provider' => 'takeat',
                ],
                [
                    'payment_method_name' => $validated['payment_method_name'] ?? $validated['payment_method'],
                    'payment_method_keyword' => null,
                    'cost_commission_id' => $validated['cost_commission_id'],
                    'has_no_fee' => $hasNoFee,
                    'payment_category' => $paymentCategory,
                    'recalculating_since' => now(),
                ]
            );

            // Disparar job para recalcular pedidos em background
            \App\Jobs\RecalculatePaymentMethodOrders::dispatch(
                tenant_id(),
                $externalPaymentMethodId
            );

            return response()->json([
                'success' => true,
                'message' => 'Vínculo criado e recálculo iniciado. Você receberá uma notificação quando o processo terminar.',
            ], 200);
        }

        // Para outros providers (iFood, etc), manter lógica antiga
        $linkService = app(\App\Services\PaymentFeeLinkService::class);
        $normalizedMethod = $linkService->normalizePaymentMethodForOrder($order, $validated['payment_method']);

        if ($validated['apply_to_all'] ?? false) {
            $affectedCount = $linkService->bulkLinkPaymentFeeByMethod(
                tenant_id(),
                $normalizedMethod,
                $validated['cost_commission_id']
            );

            return response()->json([
                'success' => true,
                'message' => "Taxa vinculada a {$affectedCount} pedidos com sucesso.",
            ], 200);
        }

        return response()->json([
            'success' => true,
            'message' => 'Vínculo criado com sucesso.',
        ], 200);
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
     * Calcular indicadores do período filtrado
     * IMPORTANTE: Deve usar EXATAMENTE os mesmos filtros da listagem principal
     */
    private function calculatePeriodIndicators(Request $request): array
    {
        $financialAggregation = app(FinancialAggregationService::class);

        // Construir query base com os MESMOS filtros da listagem principal
        $baseQuery = Order::query()
            ->where('tenant_id', tenant_id())
            // Filtro de status (igual linha 42-48 da listagem)
            ->when($request->input('status'), function ($q, $status) {
                if ($status !== 'all') {
                    $q->where('status', $status);
                }
            }, function ($q) {
                // Se não tem filtro de status, excluir apenas cancelados (padrão)
                $q->whereNotIn('status', ['CANCELLED', 'CANCELLATION_REQUESTED']);
            })
            // Filtro de loja
            ->when($request->input('store_id'), fn ($q, $storeId) => $q->where('store_id', $storeId))
            // Filtro de provider (múltiplos)
            ->when($request->input('provider'), function ($q, $providerFilter) {
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
            })
            // Filtro de tipo de pedido
            ->when($request->input('order_type'), function ($q, $orderType) {
                $normalizedType = strtoupper($orderType);
                $q->where(function ($query) use ($normalizedType) {
                    $query->where(function ($q) use ($normalizedType) {
                        $q->where('provider', 'takeat')
                            ->whereRaw("UPPER(JSON_UNQUOTE(JSON_EXTRACT(raw, '$.session.table.table_type'))) = ?", [$normalizedType]);
                    })
                        ->orWhereRaw("UPPER(JSON_UNQUOTE(JSON_EXTRACT(raw, '$.orderType'))) = ?", [$normalizedType]);
                });
            })
            // Filtro de produtos não mapeados
            ->when($request->input('unmapped_only'), function ($q) {
                $q->whereHas('items', function ($query) {
                    $query->whereDoesntHave('internalProduct');
                });
            })
            // Filtro de sem taxa de pagamento
            ->when($request->input('no_payment_method'), function ($q) {
                $q->where(function ($query) {
                    $query->whereRaw("JSON_LENGTH(JSON_EXTRACT(calculated_costs, '$.payment_methods')) = 0 OR JSON_EXTRACT(calculated_costs, '$.payment_methods') IS NULL");
                })
                    ->where(function ($query) {
                        $query->where('provider', '!=', 'takeat')
                            ->orWhereRaw("JSON_LENGTH(JSON_EXTRACT(raw, '$.session.payments')) > 0");
                    });
            })
            // Filtro de sem informação de pagamento
            ->when($request->input('no_payment_info'), function ($q) {
                $q->where('provider', 'takeat')
                    ->whereRaw("JSON_LENGTH(JSON_EXTRACT(raw, '$.session.payments')) = 0 OR JSON_EXTRACT(raw, '$.session.payments') IS NULL");
            })
            // Filtro de busca
            ->when($request->input('search'), function ($q, $search) {
                $q->where(function ($query) use ($search) {
                    $query->where('id', 'like', "%{$search}%")
                        ->orWhere('code', 'like', "%{$search}%")
                        ->orWhere('short_reference', 'like', "%{$search}%");
                });
            })
            // Filtro de método de pagamento
            ->when($request->input('payment_method'), function ($q, $paymentMethod) {
                $methods = is_array($paymentMethod) ? $paymentMethod : explode(',', $paymentMethod);
                $q->where(function ($query) use ($methods) {
                    foreach ($methods as $method) {
                        $method = trim(strtoupper($method));
                        $query->orWhereRaw("JSON_SEARCH(JSON_EXTRACT(raw, '$.session.payments[*].payment_method.method'), 'one', ?) IS NOT NULL", [$method]);
                    }
                });
            });

        // Obter datas do filtro (sempre aplicado)
        $startDate = $request->input('start_date', now()->startOfMonth()->format('Y-m-d'));
        $endDate = $request->input('end_date', now()->endOfMonth()->format('Y-m-d'));

        $startDateUtc = \Carbon\Carbon::parse($startDate.' 00:00:00', 'America/Sao_Paulo')->setTimezone('UTC')->toDateTimeString();
        $endDateUtc = \Carbon\Carbon::parse($endDate.' 23:59:59', 'America/Sao_Paulo')->setTimezone('UTC')->toDateTimeString();

        // Calcular totais usando o serviço (otimizado com chunks)
        $totals = $financialAggregation->calculatePeriodTotals(
            $baseQuery,
            tenant_id(),
            $startDateUtc,
            $endDateUtc
        );

        // Calcular ticket médio
        $orderCount = $totals['total_orders'];
        $subtotal = $totals['total_revenue'];
        $averageTicket = $orderCount > 0 ? $subtotal / $orderCount : 0;

        // Calcular Lucro Bruto (MC) = Subtotal - CMV - Impostos - Custos - Comissões - Taxas de Pagamento
        $netRevenue = $subtotal
            - $totals['total_cmv']
            - $totals['total_taxes']
            - $totals['total_recalculated_costs']
            - $totals['total_recalculated_commissions']
            - $totals['total_recalculated_payment_fees'];

        return [
            'subtotal' => $subtotal,
            'averageTicket' => $averageTicket,
            'cmv' => $totals['total_cmv'],
            'netRevenue' => $netRevenue,
            'orderCount' => $orderCount,
        ];
    }
}
