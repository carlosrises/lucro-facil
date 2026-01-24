<?php

namespace App\Http\Controllers;

use App\Events\ItemTriaged;
use App\Models\InternalProduct;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\ProductMapping;
use Illuminate\Http\Request;
use Inertia\Inertia;

class ItemTriageController extends Controller
{
    /**
     * Detectar tamanho da pizza a partir do nome do item
     */
    private function detectPizzaSize(string $itemName): ?string
    {
        $itemNameLower = mb_strtolower($itemName);

        if (preg_match('/\bbroto\b/', $itemNameLower)) {
            return 'broto';
        }
        if (preg_match('/\bgrande\b/', $itemNameLower)) {
            return 'grande';
        }
        if (preg_match('/\b(familia|big|don|70x35)\b/', $itemNameLower)) {
            return 'familia';
        }
        if (preg_match('/\b(media|média|m\b)/', $itemNameLower)) {
            return 'media';
        }

        return null;
    }

    /**
     * Calcular o CMV correto do produto baseado no tamanho
     */
    private function calculateCorrectCMV(InternalProduct $product, OrderItem $orderItem): float
    {
        if ($product->product_category !== 'sabor_pizza') {
            return (float) $product->unit_cost;
        }

        // Buscar o produto pai através do mapping principal
        $pizzaSize = null;
        $mainMapping = $orderItem->mappings()->where('mapping_type', 'main')->first();

        if ($mainMapping && $mainMapping->internalProduct) {
            $pizzaSize = $mainMapping->internalProduct->size;
        }

        // Fallback: detectar do nome do item se produto pai não tiver size
        if (! $pizzaSize) {
            $pizzaSize = $this->detectPizzaSize($orderItem->name);
        }

        if (! $pizzaSize) {
            return (float) $product->unit_cost;
        }

        // Calcular CMV dinamicamente pela ficha técnica
        $cmv = $product->calculateCMV($pizzaSize);

        return $cmv > 0 ? $cmv : (float) $product->unit_cost;
    }

    public function index(Request $request)
    {
        $tenantId = $request->user()->tenant_id;

        // ========================================
        // CALCULAR ESTATÍSTICAS (cards) ANTES DE FILTROS
        // Para garantir que cards não mudem ao filtrar
        // ========================================

        // Total de items principais (SKUs únicos)
        $totalMainItems = OrderItem::where('tenant_id', $tenantId)
            ->whereNotNull('sku')
            ->distinct('sku')
            ->count('sku');

        // Total de add_ons únicos (acumular de todos os chunks)
        $allUniqueAddOns = collect();
        OrderItem::where('tenant_id', $tenantId)
            ->whereNotNull('add_ons')
            ->whereRaw('JSON_LENGTH(add_ons) > 0')
            ->select('add_ons')
            ->chunk(500, function ($items) use (&$allUniqueAddOns) {
                foreach ($items as $item) {
                    if (is_array($item->add_ons)) {
                        foreach ($item->add_ons as $addOn) {
                            if (!empty($addOn['name'])) {
                                $allUniqueAddOns->push($addOn['name']);
                            }
                        }
                    }
                }
            });
        $totalAddOnsCount = $allUniqueAddOns->unique()->count();

        // Total classificados (items + add_ons com ProductMapping)
        $totalClassified = ProductMapping::where('tenant_id', $tenantId)
            ->distinct('external_item_id')
            ->count('external_item_id');

        // Classificados sem produto vinculado
        $classifiedWithoutProduct = ProductMapping::where('tenant_id', $tenantId)
            ->whereNull('internal_product_id')
            ->distinct('external_item_id')
            ->count('external_item_id');

        // ========================================
        // BUSCAR ITEMS PARA A LISTA (com filtros)
        // ========================================

        // Buscar items únicos agrupados por SKU
        $itemsQuery = OrderItem::where('order_items.tenant_id', $tenantId)
            ->selectRaw('
                order_items.sku,
                MAX(order_items.name) as name,
                COUNT(DISTINCT order_items.order_id) as orders_count,
                MAX(order_items.unit_price) as unit_price,
                MAX(order_items.created_at) as last_seen_at
            ')
            ->leftJoin('product_mappings', function ($join) use ($tenantId) {
                $join->on('order_items.sku', '=', 'product_mappings.external_item_id')
                    ->where('product_mappings.tenant_id', '=', $tenantId);
            })
            ->whereNotNull('order_items.sku')
            ->groupBy('order_items.sku');

        // Filtro de busca
        if ($request->filled('search')) {
            $search = $request->get('search');
            $itemsQuery->where(function ($q) use ($search) {
                $q->where('order_items.name', 'like', "%{$search}%")
                    ->orWhere('order_items.sku', 'like', "%{$search}%");
            });
        }

        // Filtro por status
        $status = $request->get('status', 'pending'); // pending, classified, all
        if ($status === 'pending') {
            $itemsQuery->whereNull('product_mappings.id');
        } elseif ($status === 'classified') {
            $itemsQuery->whereNotNull('product_mappings.id');
        }

        // Filtro por tipo de classificação
        if ($request->filled('item_type')) {
            $itemType = $request->get('item_type');
            $itemsQuery->where('product_mappings.item_type', $itemType);
        }

        // Filtro por vínculo com produto CMV
        $linkStatus = $request->get('link_status'); // linked, unlinked
        if ($linkStatus === 'linked') {
            $itemsQuery->whereNotNull('product_mappings.internal_product_id');
        } elseif ($linkStatus === 'unlinked') {
            $itemsQuery->whereNull('product_mappings.internal_product_id');
        }

        $items = $itemsQuery
            ->orderByDesc('orders_count')
            ->get()
            ->map(function ($item) {
                return [
                    'sku' => $item->sku,
                    'name' => $item->name,
                    'orders_count' => $item->orders_count,
                    'unit_price' => (float) $item->unit_price,
                    'last_seen_at' => $item->last_seen_at,
                    'is_addon' => false,
                ];
            });

        // Buscar também os add_ons (complementos/sabores/adicionais)
        // OTIMIZADO: Processar em chunks para evitar memory exhausted
        // e usar uma única query agregada ao invés de processar linha por linha
        $addOnsGrouped = collect();

        OrderItem::where('order_items.tenant_id', $tenantId)
            ->whereNotNull('add_ons')
            ->whereRaw('JSON_LENGTH(add_ons) > 0')
            ->select('id', 'add_ons')
            ->orderByDesc('id')
            ->chunk(500, function ($orderItems) use (&$addOnsGrouped) {
                foreach ($orderItems as $orderItem) {
                    $addOns = $orderItem->add_ons;
                    if (is_array($addOns) && count($addOns) > 0) {
                        foreach ($addOns as $addOn) {
                            $addOnName = $addOn['name'] ?? '';
                            if ($addOnName) {
                                $addOnSku = 'addon_'.md5($addOnName);
                                $addOnsGrouped->push([
                                    'sku' => $addOnSku,
                                    'name' => $addOnName,
                                ]);
                            }
                        }
                    }
                }
            });

        // Agrupar add_ons e contar
        $addOnsGrouped = $addOnsGrouped->groupBy('name')->map(function ($group) {
            $firstItem = $group->first();
            return [
                'sku' => $firstItem['sku'],
                'name' => $firstItem['name'],
                'orders_count' => $group->count(),
                'unit_price' => 0,
                'last_seen_at' => now(),
                'is_addon' => true,
            ];
        })->values();

        // OTIMIZAÇÃO: Buscar TODOS os mappings de uma vez (evitar N+1)
        $allSkus = $items->pluck('sku')->concat($addOnsGrouped->pluck('sku'))->unique();
        $mappings = ProductMapping::where('tenant_id', $tenantId)
            ->whereIn('external_item_id', $allSkus)
            ->with('internalProduct:id,name,unit_cost')
            ->get()
            ->keyBy('external_item_id');

        // Adicionar mappings aos items principais
        $items = $items->map(function ($item) use ($mappings) {
            $mapping = $mappings->get($item['sku']);
            $item['mapping'] = $mapping ? [
                'id' => $mapping->id,
                'item_type' => $mapping->item_type,
                'internal_product_id' => $mapping->internal_product_id,
                'internal_product_name' => $mapping->internalProduct?->name,
                'internal_product_cost' => $mapping->internalProduct?->unit_cost,
            ] : null;
            return $item;
        });

        // Adicionar mappings aos add_ons
        $addOnsGrouped = $addOnsGrouped->map(function ($item) use ($mappings) {
            $mapping = $mappings->get($item['sku']);
            $item['mapping'] = $mapping ? [
                'id' => $mapping->id,
                'item_type' => $mapping->item_type,
                'internal_product_id' => $mapping->internal_product_id,
                'internal_product_name' => $mapping->internalProduct?->name,
                'internal_product_cost' => $mapping->internalProduct?->unit_cost,
            ] : null;
            return $item;
        });

        // Combinar items principais com add_ons
        $allItems = $items->concat($addOnsGrouped);

        // APLICAR FILTROS DO USUÁRIO (não afeta os cards que foram calculados no início)
        // Aplicar filtro de busca nos add_ons também
        if ($request->filled('search')) {
            $search = strtolower($request->get('search'));
            $allItems = $allItems->filter(function ($item) use ($search) {
                return str_contains(strtolower($item['name']), $search) ||
                       str_contains(strtolower($item['sku']), $search);
            });
        }

        // Aplicar filtros de classificação e vínculo
        // LÓGICA: Se status "pending" (não classificados) + link status → UNIÃO (OR)
        //         Se status "classified" + link status → INTERSEÇÃO (AND)
        if ($status === 'pending') {
            if ($linkStatus === 'linked' || $linkStatus === 'unlinked' || $linkStatus === 'no_product') {
                // UNIÃO: Não classificados OU (Classificados com/sem produto vinculado)
                $allItems = $allItems->filter(function ($item) use ($linkStatus) {
                    // Sem mapping (não classificado)
                    if ($item['mapping'] === null) {
                        return true;
                    }

                    // OU com mapping e critério de vínculo
                    if ($linkStatus === 'linked') {
                        return ($item['mapping']['internal_product_id'] ?? null) !== null;
                    } else {
                        // unlinked ou no_product
                        return ($item['mapping']['internal_product_id'] ?? null) === null;
                    }
                });
            } else {
                // Apenas não classificados (sem filtro de vínculo)
                $allItems = $allItems->filter(fn ($item) => $item['mapping'] === null);
            }
        } elseif ($status === 'classified') {
            // Classificados - aplicar filtro de vínculo (INTERSEÇÃO/AND)
            $allItems = $allItems->filter(fn ($item) => $item['mapping'] !== null);

            if ($linkStatus === 'linked') {
                $allItems = $allItems->filter(fn ($item) =>
                    ($item['mapping']['internal_product_id'] ?? null) !== null
                );
            } elseif ($linkStatus === 'unlinked' || $linkStatus === 'no_product') {
                $allItems = $allItems->filter(fn ($item) =>
                    ($item['mapping']['internal_product_id'] ?? null) === null
                );
            }
        } else {
            // Nenhum status específico
            if ($linkStatus === 'linked' || $linkStatus === 'unlinked' || $linkStatus === 'no_product') {
                // Forçar apenas classificados quando link status está ativo
                $allItems = $allItems->filter(fn ($item) => $item['mapping'] !== null);

                if ($linkStatus === 'linked') {
                    $allItems = $allItems->filter(fn ($item) =>
                        ($item['mapping']['internal_product_id'] ?? null) !== null
                    );
                } else {
                    // unlinked ou no_product
                    $allItems = $allItems->filter(fn ($item) =>
                        ($item['mapping']['internal_product_id'] ?? null) === null
                    );
                }
            }
        }

        // Filtrar por tipo de item (Sabor, Bebida, etc)
        // Só aplicar se o valor não estiver vazio
        $itemType = $request->get('item_type', '');
        if ($itemType !== '' && $itemType !== null) {
            $allItems = $allItems->filter(function ($item) use ($itemType) {
                // Se o item não tiver mapping (não classificado), manter na lista
                // O filtro de tipo só se aplica aos classificados
                if ($item['mapping'] === null) {
                    return true; // Manter não classificados na lista
                }

                // Para classificados, filtrar pelo tipo
                return ($item['mapping']['item_type'] ?? null) === $itemType;
            });
        }

        // Ordenar por número de pedidos
        $allItems = $allItems->sortByDesc('orders_count')->values();

        // Buscar produtos internos para vincular
        $internalProducts = InternalProduct::where('tenant_id', $tenantId)
            ->select('id', 'name', 'unit_cost')
            ->orderBy('name')
            ->get();

        // Montar stats com os valores calculados NO INÍCIO (antes de qualquer filtro)
        $stats = [
            'total_items' => $totalMainItems + $totalAddOnsCount,
            'pending_items' => ($totalMainItems + $totalAddOnsCount) - $totalClassified,
            'classified_items' => $totalClassified,
            'classified_without_product' => $classifiedWithoutProduct,
        ];

        return Inertia::render('item-triage', [
            'items' => $allItems,
            'internalProducts' => $internalProducts,
            'stats' => $stats,
            'filters' => [
                'search' => $request->get('search', ''),
                'status' => $status,
                'item_type' => $request->get('item_type', ''),
                'link_status' => $request->get('link_status', ''),
            ],
        ]);
    }

    public function getItemDetails(Request $request, string $sku)
    {
        $tenantId = $request->user()->tenant_id;

        // Verificar se é um add-on (sku começa com "addon_")
        if (str_starts_with($sku, 'addon_')) {
            \Log::info('[getItemDetails] Buscando add-on com SKU: ' . $sku);
            $orderIds = collect();

            // 1. Buscar em order_items.sku (itens já classificados/vinculados)
            $orderIdsFromItems = OrderItem::where('order_items.tenant_id', $tenantId)
                ->where('order_items.sku', $sku)
                ->pluck('order_id');

            \Log::info('[getItemDetails] Order IDs de items.sku: ' . $orderIdsFromItems->count());
            $orderIds = $orderIds->merge($orderIdsFromItems);

            // 2. Buscar em add_ons JSON (itens ainda não classificados)
            $orderItemsWithAddOn = OrderItem::where('order_items.tenant_id', $tenantId)
                ->whereNotNull('add_ons')
                ->whereRaw('JSON_LENGTH(add_ons) > 0')
                ->get();

            foreach ($orderItemsWithAddOn as $orderItem) {
                $addOns = $orderItem->add_ons;
                if (is_array($addOns)) {
                    foreach ($addOns as $addOn) {
                        $addOnName = $addOn['name'] ?? '';
                        $addOnSku = 'addon_'.md5($addOnName);

                        if ($addOnSku === $sku) {
                            $orderIds->push($orderItem->order_id);
                        }
                    }
                }
            }

            \Log::info('[getItemDetails] Order IDs de add_ons JSON: ' . ($orderIds->count() - $orderIdsFromItems->count()));
            \Log::info('[getItemDetails] Total de ocorrências: ' . $orderIds->count());
            \Log::info('[getItemDetails] Total de pedidos únicos: ' . $orderIds->unique()->count());

            // Buscar IDs dos 10 pedidos mais recentes
            $recentOrderIds = Order::whereIn('id', $orderIds->unique())
                ->where('tenant_id', $tenantId)
                ->orderByDesc('placed_at')
                ->limit(10)
                ->pluck('id');

            // Retornar tanto ocorrências quanto pedidos únicos
            $totalOccurrences = $orderIds->count();
            $totalOrders = $orderIds->unique()->count();

            $recentOrders = Order::whereIn('id', $recentOrderIds)
                ->where('tenant_id', $tenantId)
                ->with(['items'])
                ->orderByDesc('placed_at')
                ->get()
                ->map(function ($order) {
                    return [
                        'id' => $order->id,
                        'code' => $order->code,
                        'short_reference' => $order->short_reference,
                        'placed_at' => $order->placed_at?->format('Y-m-d\TH:i:s.uP'),
                        'gross_total' => $order->gross_total,
                        'items' => $order->items->map(function ($item) {
                            return [
                                'id' => $item->id,
                                'name' => $item->name,
                                'sku' => $item->sku,
                                'qty' => $item->qty ?? $item->quantity ?? 1,
                                'unit_price' => $item->unit_price,
                                'total' => $item->total,
                                'add_ons' => $item->add_ons ?? [],
                            ];
                        })->toArray(),
                    ];
                })
                ->sortByDesc('placed_at')
                ->values();

            \Log::info('[getItemDetails] Resposta final', [
                'recent_orders_count' => $recentOrders->count(),
                'total_occurrences' => $totalOccurrences,
                'total_orders' => $totalOrders,
            ]);

            return response()->json([
                'recent_orders' => $recentOrders,
                'total_occurrences' => $totalOccurrences,
                'total_orders' => $totalOrders,
            ]);
        }

        // Buscar total de pedidos com este item
        $totalOrders = Order::where('orders.tenant_id', $tenantId)
            ->join('order_items', 'orders.id', '=', 'order_items.order_id')
            ->where('order_items.sku', $sku)
            ->distinct()
            ->count('orders.id');

        // Buscar pedidos recentes com este item (agrupar por pedido)
        $orderIdsWithDates = Order::where('orders.tenant_id', $tenantId)
            ->join('order_items', 'orders.id', '=', 'order_items.order_id')
            ->where('order_items.sku', $sku)
            ->select('orders.id', 'orders.placed_at')
            ->distinct()
            ->orderByDesc('orders.placed_at')
            ->limit(10)
            ->get();

        // \Log::info('Order IDs found:', [
        //     'sku' => $sku,
        //     'count' => $orderIdsWithDates->count(),
        //     'orders' => $orderIdsWithDates->map(fn ($o) => ['id' => $o->id, 'placed_at' => $o->placed_at])->toArray(),
        // ]);

        $orderIds = $orderIdsWithDates->pluck('id');

        $recentOrders = Order::where('tenant_id', $tenantId)
            ->whereIn('id', $orderIds)
            ->with(['items'])
            ->orderByDesc('placed_at')
            ->get()
            ->map(function ($order) {
                return [
                    'id' => $order->id,
                    'code' => $order->code,
                    'short_reference' => $order->short_reference,
                    'placed_at' => $order->placed_at?->format('Y-m-d\TH:i:s.uP'),
                    'gross_total' => $order->gross_total,
                    'items' => $order->items->map(function ($item) {
                        return [
                            'id' => $item->id,
                            'name' => $item->name,
                            'sku' => $item->sku,
                            'qty' => $item->qty ?? $item->quantity ?? 1,
                            'unit_price' => $item->unit_price,
                            'total' => $item->total,
                            'add_ons' => $item->add_ons ?? [],
                        ];
                    })->toArray(),
                ];
            })
            ->sortByDesc('placed_at')
            ->values();

        return response()->json([
            'recent_orders' => $recentOrders,
            'total_orders' => $totalOrders,
        ]);
    }

    public function classify(Request $request)
    {
        \Log::info('🎯 Triagem - Iniciando classificação', [
            'request_data' => $request->all(),
        ]);

        $validated = $request->validate([
            'items' => 'nullable|array|min:1',
            'items.*.sku' => 'required_with:items|string',
            'items.*.name' => 'required_with:items|string',
            'sku' => 'required_without:items|nullable|string',
            'name' => 'required_without:items|nullable|string',
            'item_type' => 'required|in:flavor,beverage,complement,parent_product,optional,combo,side,dessert',
            'internal_product_id' => 'nullable|exists:internal_products,id',
        ]);

        $tenantId = $request->user()->tenant_id;

        $itemsPayload = collect($validated['items'] ?? [])
            ->map(fn ($item) => [
                'sku' => $item['sku'],
                'name' => $item['name'],
            ])
            ->all();

        if (empty($itemsPayload) && $validated['sku'] !== null && $validated['name'] !== null) {
            $itemsPayload[] = [
                'sku' => $validated['sku'],
                'name' => $validated['name'],
            ];
        }

        if (empty($itemsPayload)) {
            return back()->withErrors([
                'items' => 'Nenhum item selecionado para classificação.',
            ]);
        }

        $results = [];

        foreach ($itemsPayload as $payload) {
            $results[] = $this->processItemClassification(
                tenantId: $tenantId,
                sku: $payload['sku'],
                name: $payload['name'],
                itemType: $validated['item_type'],
                internalProductId: $validated['internal_product_id']
            );
        }

        $processedCount = count($results);
        $isDetaching = $validated['internal_product_id'] === null;

        if ($processedCount === 1 && isset($results[0]['message'])) {
            $message = $results[0]['message'];
            return back()->with('success', $message);
        }

        $summaryMessage = $processedCount > 1
            ? ($isDetaching
                ? "{$processedCount} itens desassociados com sucesso!"
                : "{$processedCount} itens classificados com sucesso!")
            : ($results[0]['message'] ?? 'Item classificado com sucesso!');

        $flavorOccurrences = collect($results)
            ->sum(fn ($result) => $result['mapped_count'] ?? 0);

        if ($processedCount > 1 && $flavorOccurrences > 0) {
            $summaryMessage .= " {$flavorOccurrences} ocorrências ajustadas.";
        }

        if ($request->expectsJson() || $request->ajax()) {
            return response()->json([
                'success' => true,
                'message' => $summaryMessage,
                'processed_count' => $processedCount,
                'mapped_count' => $flavorOccurrences,
            ]);
        }

        return back()->with('success', $summaryMessage);
    }

    /**
     * API endpoint para classificação via AJAX (QuickLinkDialog)
     */
    public function classifyApi(Request $request)
    {
        try {
            $validated = $request->validate([
                'sku' => 'required|string',
                'name' => 'required|string',
                'item_type' => 'required|in:flavor,beverage,complement,parent_product,optional,combo,side,dessert',
                'internal_product_id' => 'nullable|exists:internal_products,id',
            ]);

            $tenantId = $request->user()->tenant_id;

            $result = $this->processItemClassification(
                tenantId: $tenantId,
                sku: $validated['sku'],
                name: $validated['name'],
                itemType: $validated['item_type'],
                internalProductId: $validated['internal_product_id']
            );

            return response()->json([
                'success' => true,
                'message' => $result['message'] ?? 'Item classificado com sucesso!',
                'mapped_count' => $result['mapped_count'] ?? 0,
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Dados inválidos',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            \Log::error('Erro no classifyApi', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Erro ao classificar item: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Processar classificação de um único item
     */
    private function processItemClassification(int $tenantId, string $sku, string $name, string $itemType, ?int $internalProductId): array
    {
        \Log::info('🎯 Triagem - Processando item', [
            'sku' => $sku,
            'item_type' => $itemType,
            'internal_product_id' => $internalProductId,
        ]);

        $mapping = ProductMapping::where('tenant_id', $tenantId)
            ->where('external_item_id', $sku)
            ->first();

        if ($mapping) {
            if ($internalProductId === null) {
                \Log::info('🗑️ Desassociando produto - removendo OrderItemMappings', [
                    'mapping_id' => $mapping->id,
                    'sku' => $sku,
                ]);

                if (str_starts_with($sku, 'addon_')) {
                    // CRITICAL: Deletar apenas os mappings do add-on ESPECÍFICO (por external_name)
                    // Não usar whereHas que pega todos os order_items com esse add-on no JSON
                    $deletedCount = \App\Models\OrderItemMapping::whereHas('orderItem', function ($q) use ($tenantId) {
                        $q->where('tenant_id', $tenantId);
                    })
                        ->where('mapping_type', 'addon')
                        ->where('external_name', $name) // FILTRAR pelo nome exato do add-on
                        ->delete();
                } else {
                    $deletedCount = \App\Models\OrderItemMapping::whereHas('orderItem', function ($q) use ($tenantId, $sku) {
                        $q->where('tenant_id', $tenantId)
                            ->where('sku', $sku);
                    })
                        ->where('mapping_type', 'main')
                        ->delete();
                }

                $mapping->update([
                    'item_type' => $itemType,
                    'internal_product_id' => null,
                ]);

                \Log::info('✅ Produto desassociado', [
                    'deleted_mappings' => $deletedCount ?? 0,
                ]);

                // Mesmo sem produto, processar pedidos históricos para aplicar a classificação
                // Isso garante que o item apareça nos pedidos (sem CMV)
                if (str_starts_with($sku, 'addon_')) {
                    $this->applyMappingToHistoricalOrders($mapping, $tenantId);
                }

                $this->broadcastItemTriaged($mapping, [
                    'sku' => $sku,
                    'name' => $name,
                    'item_type' => $itemType,
                    'internal_product_id' => null,
                ], $tenantId, 'classified');

                return [
                    'sku' => $sku,
                    'action' => 'detached',
                    'message' => 'Produto desassociado com sucesso!',
                ];
            }

            $mapping->update([
                'item_type' => $itemType,
                'internal_product_id' => $internalProductId,
            ]);

            if (str_starts_with($sku, 'addon_') && $itemType === 'flavor' && $internalProductId) {
                $flavorService = new \App\Services\FlavorMappingService;
                $mappedCount = $flavorService->mapFlavorToAllOccurrences($mapping, $tenantId);

                $this->broadcastItemTriaged($mapping, [
                    'sku' => $sku,
                    'name' => $name,
                    'item_type' => $itemType,
                    'internal_product_id' => $internalProductId,
                ], $tenantId, 'mapped');

                return [
                    'sku' => $sku,
                    'action' => 'flavor-updated',
                    'mapped_count' => $mappedCount,
                    'message' => "Sabor atualizado e aplicado a {$mappedCount} ocorrências!",
                ];
            }

            $this->broadcastItemTriaged($mapping, [
                'sku' => $sku,
                'name' => $name,
                'item_type' => $itemType,
                'internal_product_id' => $internalProductId,
            ], $tenantId, $internalProductId ? 'mapped' : 'classified');

            // Se for add-on, usar método específico para add-ons
            if (str_starts_with($sku, 'addon_')) {
                $this->applyMappingToHistoricalOrders($mapping, $tenantId);
            } else {
                $this->recalculateOrdersWithItem($mapping, $tenantId);
            }

            return [
                'sku' => $sku,
                'action' => 'updated',
                'message' => 'Item classificado com sucesso!',
            ];
        }

        $mapping = ProductMapping::create([
            'tenant_id' => $tenantId,
            'external_item_id' => $sku,
            'external_item_name' => $name,
            'item_type' => $itemType,
            'internal_product_id' => $internalProductId,
            'provider' => 'takeat',
        ]);

        if ($internalProductId) {
            if ($itemType === 'flavor') {
                $flavorService = new \App\Services\FlavorMappingService;
                $mappedCount = $flavorService->mapFlavorToAllOccurrences($mapping, $tenantId);

                $this->broadcastItemTriaged($mapping, [
                    'sku' => $sku,
                    'name' => $name,
                    'item_type' => $itemType,
                    'internal_product_id' => $internalProductId,
                ], $tenantId, 'mapped');

                return [
                    'sku' => $sku,
                    'action' => 'flavor-created',
                    'mapped_count' => $mappedCount,
                    'message' => "Sabor classificado e aplicado a {$mappedCount} ocorrências!",
                ];
            }

            $this->applyMappingToHistoricalOrders($mapping, $tenantId);
        }

        $this->broadcastItemTriaged($mapping, [
            'sku' => $sku,
            'name' => $name,
            'item_type' => $itemType,
            'internal_product_id' => $internalProductId,
        ], $tenantId, $internalProductId ? 'mapped' : 'classified');

        return [
            'sku' => $sku,
            'action' => 'created',
            'message' => 'Item classificado com sucesso!',
        ];
    }

    private function applyMappingToHistoricalOrders(ProductMapping $mapping, int $tenantId): void
    {
        // Se for add-on (SKU começa com addon_), buscar no campo JSON add_ons
        if (str_starts_with($mapping->external_item_id, 'addon_')) {
            \Log::info('🔍 Aplicando mapping de add-on histórico', [
                'sku' => $mapping->external_item_id,
                'name' => $mapping->external_item_name,
                'type' => $mapping->item_type,
                'has_product' => $mapping->internal_product_id ? 'sim' : 'não',
            ]);

            // Buscar todos os order_items que contêm este add-on no JSON
            $orderItems = OrderItem::where('tenant_id', $tenantId)
                ->whereNotNull('add_ons')
                ->whereRaw('JSON_LENGTH(add_ons) > 0')
                ->get();

            $mappedCount = 0;
            $updatedCount = 0;
            $deletedCount = 0;

            foreach ($orderItems as $orderItem) {
                $addOns = $orderItem->add_ons;
                if (is_array($addOns)) {
                    foreach ($addOns as $index => $addOn) {
                        $addOnName = $addOn['name'] ?? '';
                        if ($addOnName === $mapping->external_item_name) {
                            \Log::debug('🔍 Processando add-on', [
                                'order_item_id' => $orderItem->id,
                                'add_on_index' => $index,
                                'add_on_name' => $addOnName,
                                'mapping_has_product' => $mapping->internal_product_id ? 'sim' : 'não',
                            ]);

                            // Buscar mapping existente para ESTE add-on específico
                            $existingMapping = \App\Models\OrderItemMapping::where('order_item_id', $orderItem->id)
                                ->where('mapping_type', 'addon')
                                ->where('external_reference', (string) $index)
                                ->where('external_name', $addOnName)
                                ->first();

                            // Se há produto vinculado, criar/atualizar OrderItemMapping
                            if ($mapping->internal_product_id) {
                                $addOnQty = $addOn['quantity'] ?? 1;

                                if ($existingMapping) {
                                    \Log::debug('   ✏️ Atualizando mapping existente', ['mapping_id' => $existingMapping->id]);
                                    // Atualizar mapping existente
                                    $existingMapping->update([
                                        'internal_product_id' => $mapping->internal_product_id,
                                        'quantity' => $addOnQty,
                                    ]);
                                    $updatedCount++;

                                    // Se for sabor (flavor), recalcular frações do item pai
                                    if ($mapping->item_type === 'flavor') {
                                        $pizzaFractionService = new \App\Services\PizzaFractionService;
                                        $pizzaFractionService->recalculateFractions($orderItem);
                                    }
                                } else {
                                    \Log::debug('   ➕ Criando novo mapping');
                                    // Criar novo mapping
                                    \App\Models\OrderItemMapping::create([
                                        'tenant_id' => $tenantId,
                                        'order_item_id' => $orderItem->id,
                                        'internal_product_id' => $mapping->internal_product_id,
                                        'quantity' => $addOnQty,
                                        'mapping_type' => 'addon',
                                        'option_type' => 'addon',
                                        'auto_fraction' => false,
                                        'external_reference' => (string) $index,
                                        'external_name' => $addOnName,
                                    ]);
                                    $mappedCount++;

                                    // Se for sabor (flavor), recalcular frações do item pai
                                    if ($mapping->item_type === 'flavor') {
                                        $pizzaFractionService = new \App\Services\PizzaFractionService;
                                        $pizzaFractionService->recalculateFractions($orderItem);
                                    }
                                }
                            } else if ($existingMapping) {
                                // CUIDADO: Só deletar se o mapping é do tipo 'addon', NÃO deletar sabores!
                                if ($existingMapping->mapping_type === 'addon') {
                                    \Log::debug('   🗑️ Deletando mapping addon (sem produto)', ['mapping_id' => $existingMapping->id]);
                                    // Se NÃO há produto vinculado mas existe mapping, deletar
                                    // (usuário removeu a associação do produto)
                                    $existingMapping->delete();
                                    $deletedCount++;
                                } else {
                                    \Log::warning('   ⚠️ Mapping encontrado NÃO é addon, mantendo', [
                                        'mapping_id' => $existingMapping->id,
                                        'mapping_type' => $existingMapping->mapping_type,
                                    ]);
                                }
                            } else {
                                \Log::debug('   ⏭️ Sem produto e sem mapping - nada a fazer');
                            }
                            // Se não há produto E não há mapping existente, não faz nada
                            // (usuário apenas classificou sem vincular produto)
                        }
                    }
                }
            }

            \Log::info('✅ Add-on aplicado a pedidos históricos', [
                'created' => $mappedCount,
                'updated' => $updatedCount,
                'deleted' => $deletedCount,
            ]);

            // Recalcular custos dos pedidos afetados
            if ($mappedCount > 0 || $updatedCount > 0 || $deletedCount > 0) {
                $affectedOrderIds = $orderItems->pluck('order_id')->unique();
                $this->recalculateAffectedOrders($affectedOrderIds);
            }

            return;
        }

        // Para itens principais (não add-ons), buscar por SKU normal
        $orderItems = OrderItem::where('tenant_id', $tenantId)
            ->where('sku', $mapping->external_item_id)
            ->whereDoesntHave('mappings', function ($q) {
                $q->where('mapping_type', 'main');
            })
            ->get();

        foreach ($orderItems as $orderItem) {
            $product = InternalProduct::find($mapping->internal_product_id);
            $correctCMV = $product ? $this->calculateCorrectCMV($product, $orderItem) : null;

            // logger()->info('🏷️ Triagem - Associando produto', [
            //     'order_item_id' => $orderItem->id,
            //     'order_item_name' => $orderItem->name,
            //     'product_id' => $product?->id,
            //     'product_name' => $product?->name,
            //     'product_category' => $product?->product_category,
            //     'product_size' => $product?->size,
            //     'cmv_calculated' => $correctCMV,
            //     'unit_cost' => $product?->unit_cost,
            // ]);

            \App\Models\OrderItemMapping::create([
                'tenant_id' => $tenantId,
                'order_item_id' => $orderItem->id,
                'internal_product_id' => $mapping->internal_product_id,
                'quantity' => 1.0,
                'mapping_type' => 'main',
                'option_type' => 'regular',
                'auto_fraction' => false,
                'unit_cost_override' => $correctCMV,
            ]);

            // Se for parent_product (pizza completa), criar mappings dos sabores e recalcular
            if ($mapping->item_type === 'parent_product' && $product) {
                // Primeiro, criar OrderItemMappings para sabores que já têm ProductMapping
                $this->createFlavorMappingsForOrderItem($orderItem, $tenantId);

                // Depois, recalcular frações de todos os sabores
                $pizzaFractionService = new \App\Services\PizzaFractionService;
                $pizzaFractionService->recalculateFractions($orderItem);
            }
        }

        // Recalcular custos dos pedidos afetados
        if ($orderItems->isNotEmpty()) {
            $affectedOrderIds = $orderItems->pluck('order_id')->unique();
            $this->recalculateAffectedOrders($affectedOrderIds);
        }
    }

    /**
     * Criar OrderItemMappings para sabores que já têm ProductMapping mas não têm OrderItemMapping
     */
    private function createFlavorMappingsForOrderItem(OrderItem $orderItem, int $tenantId): void
    {
        if (!$orderItem->add_ons || !is_array($orderItem->add_ons)) {
            return;
        }

        foreach ($orderItem->add_ons as $index => $addOn) {
            $addOnName = $addOn['name'] ?? '';
            if (!$addOnName) {
                continue;
            }

            // Gerar SKU do add-on
            $addOnSku = 'addon_' . md5($addOnName);

            // Verificar se já tem OrderItemMapping
            $existingMapping = \App\Models\OrderItemMapping::where('order_item_id', $orderItem->id)
                ->where('mapping_type', 'addon')
                ->where('external_reference', (string) $index)
                ->first();

            if ($existingMapping) {
                continue; // Já tem mapping, pular
            }

            // Buscar ProductMapping do sabor
            $productMapping = ProductMapping::where('tenant_id', $tenantId)
                ->where('external_item_id', $addOnSku)
                ->where('item_type', 'flavor')
                ->first();

            if (!$productMapping || !$productMapping->internal_product_id) {
                continue; // Não está classificado como sabor ou sem produto vinculado
            }

            // Criar OrderItemMapping para este sabor
            $addOnQty = $addOn['quantity'] ?? 1;

            \App\Models\OrderItemMapping::create([
                'tenant_id' => $tenantId,
                'order_item_id' => $orderItem->id,
                'internal_product_id' => $productMapping->internal_product_id,
                'quantity' => $addOnQty, // Será recalculado pelo PizzaFractionService
                'mapping_type' => 'addon',
                'option_type' => 'pizza_flavor',
                'auto_fraction' => true,
                'external_reference' => (string) $index,
                'external_name' => $addOnName,
            ]);
        }
    }

    /**
     * Recalcular CMV dos pedidos que contêm um item específico
     */
    private function recalculateOrdersWithItem(ProductMapping $mapping, int $tenantId): void
    {
        // Se não há produto vinculado, não há o que recalcular
        if (! $mapping->internal_product_id) {
            return;
        }

        // Buscar todos os order_items que têm este SKU
        $orderItems = OrderItem::where('tenant_id', $tenantId)
            ->where('sku', $mapping->external_item_id)
            ->get();

        if ($orderItems->isEmpty()) {
            return;
        }

        // Atualizar OrderItemMappings existentes com o novo internal_product_id
        foreach ($orderItems as $orderItem) {
            // DELETAR todos os mappings do tipo 'main' existentes para este order_item
            \App\Models\OrderItemMapping::where('order_item_id', $orderItem->id)
                ->where('mapping_type', 'main')
                ->delete();

            // RECRIAR mapping com o produto correto
            if ($mapping->internal_product_id) {
                // Calcular CMV correto baseado no tamanho
                $product = InternalProduct::find($mapping->internal_product_id);
                $correctCMV = $product ? $this->calculateCorrectCMV($product, $orderItem) : null;

                \App\Models\OrderItemMapping::create([
                    'tenant_id' => $tenantId,
                    'order_item_id' => $orderItem->id,
                    'internal_product_id' => $mapping->internal_product_id,
                    'quantity' => 1.0,
                    'mapping_type' => 'main',
                    'option_type' => 'regular',
                    'auto_fraction' => false,
                    'unit_cost_override' => $correctCMV, // CMV calculado por tamanho
                ]);
            }

            // Se vinculou um produto pai (parent_product), recalcular frações dos sabores
            if ($mapping->item_type === 'parent_product' && $mapping->internal_product_id) {
                // Primeiro, criar OrderItemMappings para sabores que já têm ProductMapping
                $this->createFlavorMappingsForOrderItem($orderItem, $tenantId);

                // Depois, recalcular frações de todos os sabores
                $pizzaFractionService = new \App\Services\PizzaFractionService;
                $pizzaFractionService->recalculateFractions($orderItem);
            }
        }

        // Coletar IDs únicos de pedidos que precisam ser recalculados
        $orderIds = $orderItems->pluck('order_id')->unique();
        $this->recalculateAffectedOrders($orderIds);
    }

    /**
     * Recalcular custos dos pedidos afetados
     */
    private function recalculateAffectedOrders($orderIds): void
    {
        $costService = app(\App\Services\OrderCostService::class);
        foreach ($orderIds as $orderId) {
            $order = Order::find($orderId);
            if ($order) {
                $result = $costService->calculateOrderCosts($order);
                $order->update([
                    'calculated_costs' => $result,
                    'total_costs' => $result['total_costs'] ?? 0,
                    'total_commissions' => $result['total_commissions'] ?? 0,
                    'net_revenue' => $result['net_revenue'] ?? 0,
                    'costs_calculated_at' => now(),
                ]);
            }
        }
    }

    /**
     * Broadcast de evento quando item é classificado ou mapeado
     */
    private function broadcastItemTriaged(ProductMapping $mapping, array $validated, int $tenantId, string $action): void
    {
        logger()->info('🔊 Iniciando broadcast ItemTriaged', [
            'tenant_id' => $tenantId,
            'sku' => $validated['sku'],
            'name' => $validated['name'],
            'action' => $action,
        ]);

        // Buscar um order_item de exemplo para pegar informações do pedido
        $orderItem = OrderItem::where('tenant_id', $tenantId)
            ->where(function ($q) use ($validated) {
                if (str_starts_with($validated['sku'], 'addon_')) {
                    // Para add-ons, buscar por nome no JSON
                    $q->whereRaw("JSON_CONTAINS(add_ons, JSON_OBJECT('name', ?)) = 1", [$validated['name']]);
                } else {
                    // Para itens principais, buscar por SKU
                    $q->where('sku', $validated['sku']);
                }
            })
            ->with('order:id,code')
            ->first();

        if ($orderItem) {
            logger()->info('🔊 Disparando broadcast ItemTriaged', [
                'order_id' => $orderItem->order_id,
                'order_code' => $orderItem->order->code,
                'channel' => "orders.tenant.{$tenantId}",
            ]);

            broadcast(new ItemTriaged(
                tenantId: $tenantId,
                orderId: $orderItem->order_id,
                orderCode: $orderItem->order->code,
                itemId: $orderItem->id,
                itemName: $validated['name'],
                internalProductId: $validated['internal_product_id'],
                itemType: $validated['item_type'],
                action: $action
            ))->toOthers();

            logger()->info('✅ Broadcast ItemTriaged disparado com sucesso');
        } else {
            logger()->warning('⚠️ OrderItem não encontrado para broadcast', [
                'sku' => $validated['sku'],
                'name' => $validated['name'],
            ]);
        }
    }
}
