<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\ProductMapping;
use App\Models\InternalProduct;
use Illuminate\Http\Request;
use Inertia\Inertia;

class ItemTriageController extends Controller
{
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
            ->whereRaw("JSON_LENGTH(add_ons) > 0")
            ->select('id', 'order_id', 'add_ons')
            ->get();

        $addOnsCollection = collect();

        foreach ($addOnsQuery as $orderItem) {
            $addOns = $orderItem->add_ons;
            if (is_array($addOns) && count($addOns) > 0) {
                foreach ($addOns as $index => $addOn) {
                    $addOnName = $addOn['name'] ?? '';
                    if (!$addOnName) continue;

                    // Criar um "SKU" único para o add_on baseado no nome
                    $addOnSku = 'addon_' . md5($addOnName);

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
            $allItems = $allItems->filter(fn($item) => $item['mapping'] === null);
        } elseif ($status === 'classified') {
            $allItems = $allItems->filter(fn($item) => $item['mapping'] !== null);
        }

        if ($request->filled('item_type')) {
            $itemType = $request->get('item_type');
            $allItems = $allItems->filter(fn($item) => $item['mapping']['item_type'] ?? null === $itemType);
        }

        if ($linkStatus === 'linked') {
            $allItems = $allItems->filter(fn($item) => ($item['mapping']['internal_product_id'] ?? null) !== null);
        } elseif ($linkStatus === 'unlinked') {
            $allItems = $allItems->filter(fn($item) => ($item['mapping']['internal_product_id'] ?? null) === null);
        } elseif ($linkStatus === 'no_product') {
            // Classificados mas sem produto interno vinculado
            $allItems = $allItems->filter(fn($item) => 
                $item['mapping'] !== null && 
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
            ->whereRaw("JSON_LENGTH(add_ons) > 0")
            ->get()
            ->pluck('add_ons')
            ->flatten(1)
            ->pluck('name')
            ->unique()
            ->count();

        $totalClassifiedMappings = ProductMapping::where('tenant_id', $tenantId)->count();
        
        // Itens classificados mas sem produto interno vinculado
        $classifiedWithoutProduct = ProductMapping::where('tenant_id', $tenantId)
            ->whereNull('internal_product_id')
            ->count();

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
                ->whereRaw("JSON_LENGTH(add_ons) > 0")
                ->get();

            $matchingOrders = collect();
            $orderIds = collect();

            foreach ($orderItemsWithAddOn as $orderItem) {
                $addOns = $orderItem->add_ons;
                if (is_array($addOns)) {
                    foreach ($addOns as $addOn) {
                        $addOnName = $addOn['name'] ?? '';
                        $addOnSku = 'addon_' . md5($addOnName);

                        if ($addOnSku === $sku) {
                            $orderIds->push($orderItem->order_id);
                        }
                    }
                }
            }

            $orderIds = $orderIds->unique()->take(10);

            $recentOrders = Order::whereIn('id', $orderIds)
                ->where('tenant_id', $tenantId)
                ->with(['items'])
                ->orderByDesc('placed_at')
                ->get()
                ->map(function($order) {
                    return [
                        'id' => $order->id,
                        'code' => $order->code,
                        'short_reference' => $order->short_reference,
                        'placed_at' => $order->placed_at,
                        'gross_total' => $order->gross_total,
                        'items' => $order->items->map(function($item) {
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
                'total_orders' => $orderIds->count(),
            ]);
        }

        // Buscar total de pedidos com este item
        $totalOrders = Order::where('orders.tenant_id', $tenantId)
            ->join('order_items', 'orders.id', '=', 'order_items.order_id')
            ->where('order_items.sku', $sku)
            ->distinct()
            ->count('orders.id');

        // Buscar pedidos recentes com este item (agrupar por pedido)
        $orderIds = Order::where('orders.tenant_id', $tenantId)
            ->join('order_items', 'orders.id', '=', 'order_items.order_id')
            ->where('order_items.sku', $sku)
            ->select('orders.id', 'orders.placed_at')
            ->distinct()
            ->orderByDesc('orders.placed_at')
            ->limit(10)
            ->pluck('orders.id');

        \Log::info('Order IDs found:', ['sku' => $sku, 'count' => $orderIds->count(), 'ids' => $orderIds->toArray()]);

        $recentOrders = Order::where('tenant_id', $tenantId)
            ->whereIn('id', $orderIds)
            ->with(['items'])
            ->orderByDesc('placed_at')
            ->get()
            ->map(function($order) {
                return [
                    'id' => $order->id,
                    'code' => $order->code,
                    'short_reference' => $order->short_reference,
                    'placed_at' => $order->placed_at,
                    'gross_total' => $order->gross_total,
                    'items' => $order->items->map(function($item) {
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
        $validated = $request->validate([
            'sku' => 'required|string',
            'name' => 'required|string',
            'item_type' => 'required|in:flavor,beverage,complement,parent_product,optional,combo,side,dessert',
            'internal_product_id' => 'nullable|exists:internal_products,id',
        ]);

        $tenantId = $request->user()->tenant_id;

        // Verificar se já existe mapping
        $mapping = ProductMapping::where('tenant_id', $tenantId)
            ->where('external_item_id', $validated['sku'])
            ->first();

        if ($mapping) {
            // Atualizar mapping existente
            $mapping->update([
                'item_type' => $validated['item_type'],
                'internal_product_id' => $validated['internal_product_id'],
            ]);
        } else {
            // Criar novo mapping
            $mapping = ProductMapping::create([
                'tenant_id' => $tenantId,
                'external_item_id' => $validated['sku'],
                'external_item_name' => $validated['name'],
                'item_type' => $validated['item_type'],
                'internal_product_id' => $validated['internal_product_id'],
                'provider' => 'takeat', // Default
            ]);

            // Aplicar aos pedidos históricos se houver produto vinculado
            if ($validated['internal_product_id']) {
                // Se for sabor de pizza, usar serviço inteligente de fracionamento
                if ($validated['item_type'] === 'flavor') {
                    $flavorService = new \App\Services\FlavorMappingService();
                    $mappedCount = $flavorService->mapFlavorToAllOccurrences($mapping, $tenantId);

                    return back()->with('success', "Sabor classificado e aplicado a {$mappedCount} ocorrências!");
                }

                $this->applyMappingToHistoricalOrders($mapping, $tenantId);
            }
        }

        return back()->with('success', 'Item classificado com sucesso!');
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
            \App\Models\OrderItemMapping::create([
                'tenant_id' => $tenantId,
                'order_item_id' => $orderItem->id,
                'internal_product_id' => $mapping->internal_product_id,
                'quantity' => 1.0,
                'mapping_type' => 'main',
                'option_type' => 'regular',
                'auto_fraction' => false,
            ]);
        }
    }
}
