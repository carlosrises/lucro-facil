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
            ->map(function ($item) use ($tenantId) {
                // Buscar mapping existente
                $mapping = ProductMapping::where('tenant_id', $tenantId)
                    ->where('external_item_id', $item->sku)
                    ->with('internalProduct:id,name,unit_cost')
                    ->first();

                return [
                    'sku' => $item->sku,
                    'name' => $item->name,
                    'orders_count' => $item->orders_count,
                    'unit_price' => (float) $item->unit_price,
                    'last_seen_at' => $item->last_seen_at,
                    'is_addon' => false,
                    'mapping' => $mapping ? [
                        'id' => $mapping->id,
                        'item_type' => $mapping->item_type,
                        'internal_product_id' => $mapping->internal_product_id,
                        'internal_product_name' => $mapping->internalProduct?->name,
                        'internal_product_cost' => $mapping->internalProduct?->unit_cost,
                    ] : null,
                ];
            });

        // Buscar também os add_ons (complementos/sabores/adicionais)
        $addOnsQuery = OrderItem::where('order_items.tenant_id', $tenantId)
            ->whereNotNull('add_ons')
            ->whereRaw('JSON_LENGTH(add_ons) > 0')
            ->select('id', 'order_id', 'add_ons')
            ->get();

        $addOnsCollection = collect();

        foreach ($addOnsQuery as $orderItem) {
            $addOns = $orderItem->add_ons;
            if (is_array($addOns) && count($addOns) > 0) {
                foreach ($addOns as $index => $addOn) {
                    $addOnName = $addOn['name'] ?? '';
                    if (! $addOnName) {
                        continue;
                    }

                    // Criar um "SKU" único para o add_on baseado no nome
                    $addOnSku = 'addon_'.md5($addOnName);

                    $addOnsCollection->push([
                        'sku' => $addOnSku,
                        'name' => $addOnName,
                        'is_addon' => true,
                    ]);
                }
            }
        }

        // Agrupar add_ons por nome e contar
        $addOnsGrouped = $addOnsCollection->groupBy('name')->map(function ($group) use ($tenantId) {
            $firstItem = $group->first();
            $addOnSku = $firstItem['sku'];

            // Buscar mapping existente para o add_on
            $mapping = ProductMapping::where('tenant_id', $tenantId)
                ->where('external_item_id', $addOnSku)
                ->with('internalProduct:id,name,unit_cost')
                ->first();

            return [
                'sku' => $addOnSku,
                'name' => $firstItem['name'],
                'orders_count' => $group->count(),
                'unit_price' => 0,
                'last_seen_at' => now(),
                'is_addon' => true,
                'mapping' => $mapping ? [
                    'id' => $mapping->id,
                    'item_type' => $mapping->item_type,
                    'internal_product_id' => $mapping->internal_product_id,
                    'internal_product_name' => $mapping->internalProduct?->name,
                    'internal_product_cost' => $mapping->internalProduct?->unit_cost,
                ] : null,
            ];
        })->values();

        // Combinar items principais com add_ons
        $allItems = $items->concat($addOnsGrouped);

        // Aplicar filtro de busca nos add_ons também
        if ($request->filled('search')) {
            $search = strtolower($request->get('search'));
            $allItems = $allItems->filter(function ($item) use ($search) {
                return str_contains(strtolower($item['name']), $search) ||
                       str_contains(strtolower($item['sku']), $search);
            });
        }

        // Aplicar filtros de classificação nos add_ons também
        if ($status === 'pending') {
            $allItems = $allItems->filter(fn ($item) => $item['mapping'] === null);
        } elseif ($status === 'classified') {
            $allItems = $allItems->filter(fn ($item) => $item['mapping'] !== null);
        }

        if ($request->filled('item_type')) {
            $itemType = $request->get('item_type');
            $allItems = $allItems->filter(function ($item) use ($itemType) {
                // Só filtra se o item tiver mapping (foi classificado)
                if ($item['mapping'] === null) {
                    return false;
                }

                return ($item['mapping']['item_type'] ?? null) === $itemType;
            });
        }

        if ($linkStatus === 'linked') {
            $allItems = $allItems->filter(fn ($item) => ($item['mapping']['internal_product_id'] ?? null) !== null);
        } elseif ($linkStatus === 'unlinked') {
            $allItems = $allItems->filter(fn ($item) => ($item['mapping']['internal_product_id'] ?? null) === null);
        } elseif ($linkStatus === 'no_product') {
            // Classificados mas sem produto interno vinculado
            $allItems = $allItems->filter(fn ($item) => $item['mapping'] !== null &&
                ($item['mapping']['internal_product_id'] ?? null) === null
            );
        }

        // Ordenar por número de pedidos
        $allItems = $allItems->sortByDesc('orders_count')->values();

        // Buscar produtos internos para vincular
        $internalProducts = InternalProduct::where('tenant_id', $tenantId)
            ->select('id', 'name', 'unit_cost')
            ->orderBy('name')
            ->get();

        // Estatísticas (incluindo add-ons)
        $totalMainItems = OrderItem::where('tenant_id', $tenantId)
            ->distinct('sku')
            ->count('sku');

        // Contar add-ons únicos
        $allAddOns = OrderItem::where('tenant_id', $tenantId)
            ->whereNotNull('add_ons')
            ->whereRaw('JSON_LENGTH(add_ons) > 0')
            ->get()
            ->pluck('add_ons')
            ->flatten(1)
            ->pluck('name')
            ->unique()
            ->count();

        // Contar itens únicos classificados (distinct por external_item_id)
        // Um item pode ter múltiplos mappings (main + flavor), mas deve contar como 1 item classificado
        $totalClassifiedMappings = ProductMapping::where('tenant_id', $tenantId)
            ->distinct('external_item_id')
            ->count('external_item_id');

        // Itens classificados mas sem produto interno vinculado (também distinct)
        $classifiedWithoutProduct = ProductMapping::where('tenant_id', $tenantId)
            ->whereNull('internal_product_id')
            ->distinct('external_item_id')
            ->count('external_item_id');

        $stats = [
            'total_items' => $totalMainItems + $allAddOns,
            'pending_items' => ($totalMainItems + $allAddOns) - $totalClassifiedMappings,
            'classified_items' => $totalClassifiedMappings,
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
            // Buscar pedidos que contêm este add-on no campo JSON
            // Precisamos decodificar o SKU para obter o nome original do add-on
            // Como geramos o SKU com md5, precisamos buscar pelo nome nos JSONs

            // Buscar todos os order_items com add_ons
            $orderItemsWithAddOn = OrderItem::where('order_items.tenant_id', $tenantId)
                ->whereNotNull('add_ons')
                ->whereRaw('JSON_LENGTH(add_ons) > 0')
                ->get();

            $matchingOrders = collect();
            $orderIds = collect();

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

            // Buscar IDs dos 10 pedidos mais recentes
            $recentOrderIds = Order::whereIn('id', $orderIds->unique())
                ->where('tenant_id', $tenantId)
                ->orderByDesc('placed_at')
                ->limit(10)
                ->pluck('id');

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
                        'placed_at' => $order->placed_at,
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

        \Log::info('Order IDs found:', [
            'sku' => $sku,
            'count' => $orderIdsWithDates->count(),
            'orders' => $orderIdsWithDates->map(fn ($o) => ['id' => $o->id, 'placed_at' => $o->placed_at])->toArray(),
        ]);

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
                    'placed_at' => $order->placed_at,
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
            return back()->with('success', $results[0]['message']);
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

        return back()->with('success', $summaryMessage);
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
                    $deletedCount = \App\Models\OrderItemMapping::whereHas('orderItem', function ($q) use ($tenantId) {
                        $q->where('tenant_id', $tenantId);
                    })
                        ->where('mapping_type', 'addon')
                        ->whereHas('orderItem', function ($q) use ($name) {
                            $q->whereRaw("JSON_CONTAINS(add_ons, JSON_OBJECT('name', ?)) = 1", [$name]);
                        })
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

            $this->recalculateOrdersWithItem($mapping, $tenantId);

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
            // Buscar mappings do tipo 'main' para este order_item
            $itemMappings = \App\Models\OrderItemMapping::where('order_item_id', $orderItem->id)
                ->where('mapping_type', 'main')
                ->get();

            if ($itemMappings->isNotEmpty()) {
                // Atualizar mappings existentes
                foreach ($itemMappings as $itemMapping) {
                    // Calcular CMV correto baseado no tamanho
                    $product = InternalProduct::find($mapping->internal_product_id);
                    $correctCMV = $product ? $this->calculateCorrectCMV($product, $orderItem) : null;

                    $itemMapping->update([
                        'internal_product_id' => $mapping->internal_product_id,
                        'unit_cost_override' => $correctCMV, // CMV calculado por tamanho
                    ]);
                }
            } elseif ($mapping->internal_product_id) {
                // Criar novo mapping se não existir e há produto vinculado
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

            // NOVO: Se vinculou um produto pai (parent_product), recalcular frações dos sabores
            if ($mapping->item_type === 'parent_product' && $mapping->internal_product_id) {
                $pizzaFractionService = new \App\Services\PizzaFractionService;
                $pizzaFractionService->recalculateFractions($orderItem);
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
