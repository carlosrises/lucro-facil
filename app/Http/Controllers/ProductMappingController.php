<?php

namespace App\Http\Controllers;

use App\Models\InternalProduct;
use App\Models\OrderItem;
use App\Models\OrderItemMapping;
use App\Models\ProductMapping;
use Illuminate\Http\Request;
use Inertia\Inertia;

class ProductMappingController extends Controller
{
    public function index(Request $request)
    {
        $tenantId = $request->user()->tenant_id;

        // Buscar produtos internos
        $internalProducts = InternalProduct::where('tenant_id', $tenantId)
            ->select('id', 'name', 'unit_cost')
            ->orderBy('name')
            ->get();

        // Buscar itens externos únicos (produtos dos pedidos que ainda não foram mapeados ou todos)
        $query = OrderItem::where('tenant_id', $tenantId)
            ->selectRaw('DISTINCT sku, name, MAX(unit_price) as unit_price')
            ->groupBy('sku', 'name')
            ->orderBy('name');

        // Filtro de busca
        if ($request->filled('search')) {
            $search = $request->get('search');
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('sku', 'like', "%{$search}%");
            });
        }

        // Filtro por status de mapeamento
        $mappingStatus = $request->get('mapping_status', 'all');

        $externalItems = $query->get()->map(function ($item) use ($tenantId, $mappingStatus) {
            // Buscar mapeamento existente
            $mapping = ProductMapping::where('tenant_id', $tenantId)
                ->where('external_item_id', $item->sku)
                ->with('internalProduct:id,name,unit_cost')
                ->first();

            return [
                'sku' => $item->sku,
                'name' => $item->name,
                'unit_price' => $item->unit_price,
                'mapped' => $mapping !== null,
                'mapping' => $mapping ? [
                    'id' => $mapping->id,
                    'internal_product_id' => $mapping->internal_product_id,
                    'internal_product_name' => $mapping->internalProduct->name,
                    'internal_product_cost' => $mapping->internalProduct->unit_cost,
                ] : null,
            ];
        });

        // Aplicar filtro de status de mapeamento
        if ($mappingStatus === 'mapped') {
            $externalItems = $externalItems->filter(fn($item) => $item['mapped']);
        } elseif ($mappingStatus === 'unmapped') {
            $externalItems = $externalItems->filter(fn($item) => !$item['mapped']);
        }

        return Inertia::render('product-mappings', [
            'externalItems' => $externalItems->values(),
            'internalProducts' => $internalProducts,
            'filters' => [
                'search' => $request->get('search', ''),
                'mapping_status' => $mappingStatus,
            ],
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'external_item_id' => 'required|string',
            'external_item_name' => 'required|string',
            'internal_product_id' => 'required|exists:internal_products,id',
            'provider' => 'nullable|string',
        ]);

        $tenantId = $request->user()->tenant_id;

        // Verificar se o produto interno pertence ao tenant
        $internalProduct = InternalProduct::where('id', $validated['internal_product_id'])
            ->where('tenant_id', $tenantId)
            ->firstOrFail();

        // Verificar se já existe mapeamento para este external_item_id
        $existingMapping = ProductMapping::where('tenant_id', $tenantId)
            ->where('external_item_id', $validated['external_item_id'])
            ->first();

        if ($existingMapping) {
            return back()->withErrors(['error' => 'Este produto externo já está associado a outro produto interno. Remova a associação existente primeiro.']);
        }

        // Criar novo mapeamento
        $mapping = ProductMapping::create([
            'tenant_id' => $tenantId,
            'external_item_id' => $validated['external_item_id'],
            'external_item_name' => $validated['external_item_name'],
            'internal_product_id' => $validated['internal_product_id'],
            'provider' => $validated['provider'] ?? 'ifood',
        ]);

        // Aplicar retroativamente a todos os pedidos históricos
        $this->applyMappingToHistoricalOrders($mapping, $tenantId);

        return back()->with('success', 'Mapeamento criado e aplicado aos pedidos históricos com sucesso!');
    }

    public function destroy(Request $request, ProductMapping $productMapping)
    {
        // Verificar se pertence ao tenant
        if ($productMapping->tenant_id !== $request->user()->tenant_id) {
            abort(403, 'Acesso negado.');
        }

        $productMapping->delete();

        return back()->with('success', 'Mapeamento removido com sucesso!');
    }

    public function destroyBySku(Request $request, $sku)
    {
        $tenantId = $request->user()->tenant_id;

        $productMapping = ProductMapping::where('tenant_id', $tenantId)
            ->where('external_item_id', $sku)
            ->firstOrFail();

        $productMapping->delete();

        return back()->with('success', 'Mapeamento removido com sucesso!');
    }

    /**
     * Aplicar mapeamento retroativamente a todos os pedidos históricos
     */
    private function applyMappingToHistoricalOrders(ProductMapping $mapping, int $tenantId): void
    {
        // Buscar todos os OrderItems que têm o SKU mapeado e ainda não têm mapping principal
        $orderItems = OrderItem::where('tenant_id', $tenantId)
            ->where('sku', $mapping->external_item_id)
            ->whereDoesntHave('mappings', function ($q) {
                $q->where('mapping_type', 'main');
            })
            ->get();

        $mappedCount = 0;

        foreach ($orderItems as $orderItem) {
            // Criar OrderItemMapping principal
            OrderItemMapping::create([
                'tenant_id' => $tenantId,
                'order_item_id' => $orderItem->id,
                'internal_product_id' => $mapping->internal_product_id,
                'quantity' => 1.0,
                'mapping_type' => 'main',
                'option_type' => 'regular',
                'auto_fraction' => false,
            ]);

            // Auto-mapear complementos (add_ons) se houverem
            $addOns = $orderItem->add_ons ?? [];
            foreach ($addOns as $index => $addOn) {
                $addonName = $addOn['name'] ?? '';
                $addonQty = $addOn['quantity'] ?? 1;

                // Tentar encontrar mapeamento para o complemento
                $addonMapping = ProductMapping::where('tenant_id', $tenantId)
                    ->where(function ($q) use ($addonName) {
                        $q->where('external_item_name', 'LIKE', "%{$addonName}%");
                    })
                    ->first();

                if ($addonMapping) {
                    // Verificar se já existe mapping para este complemento
                    $existingAddonMapping = OrderItemMapping::where('order_item_id', $orderItem->id)
                        ->where('mapping_type', 'addon')
                        ->where('external_reference', (string) $index)
                        ->first();

                    if (!$existingAddonMapping) {
                        // Detectar se é sabor de pizza
                        $isPizzaFlavor = stripos($addOn['name'] ?? '', 'pizza') !== false
                            || stripos($mapping->external_item_name ?? '', 'pizza') !== false;

                        OrderItemMapping::create([
                            'tenant_id' => $tenantId,
                            'order_item_id' => $orderItem->id,
                            'internal_product_id' => $addonMapping->internal_product_id,
                            'quantity' => $addonQty,
                            'mapping_type' => 'addon',
                            'option_type' => $isPizzaFlavor ? 'pizza_flavor' : 'addon',
                            'auto_fraction' => $isPizzaFlavor,
                            'external_reference' => (string) $index,
                            'external_name' => $addonName,
                        ]);
                    }
                }
            }

            $mappedCount++;
        }

        logger()->info('✅ Mapeamento aplicado retroativamente', [
            'tenant_id' => $tenantId,
            'mapping_id' => $mapping->id,
            'external_item_id' => $mapping->external_item_id,
            'internal_product_id' => $mapping->internal_product_id,
            'order_items_mapped' => $mappedCount,
        ]);
    }
}
