<?php

namespace App\Http\Controllers;

use App\Models\InternalProduct;
use App\Models\OrderItem;
use App\Models\OrderItemMapping;
use App\Services\PizzaFractionService;
use Illuminate\Http\Request;

class OrderItemMappingsController extends Controller
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

        $size = $this->detectPizzaSize($orderItem->name);
        if (!$size) {
            return (float) $product->unit_cost;
        }

        $hasCosts = $product->costs()->exists();
        if ($hasCosts) {
            return $product->calculateCMV($size);
        }

        if ($product->cmv_by_size && is_array($product->cmv_by_size) && isset($product->cmv_by_size[$size])) {
            return (float) $product->cmv_by_size[$size];
        }

        return (float) $product->unit_cost;
    }
    public function __construct(
        private PizzaFractionService $pizzaFractionService
    ) {}

    /**
     * Store multiple mappings for an order item
     */
    public function store(Request $request, OrderItem $orderItem)
    {
        // Verificar permissão de tenant
        if ($orderItem->tenant_id !== tenant_id()) {
            abort(403);
        }

        $validated = $request->validate([
            'mappings' => 'required|array',
            'mappings.*.internal_product_id' => 'required|exists:internal_products,id',
            'mappings.*.quantity' => 'required|numeric|min:0.0001|max:999',
            'mappings.*.mapping_type' => 'required|in:main,option,addon',
            'mappings.*.option_type' => 'nullable|in:pizza_flavor,regular,addon,observation,drink',
            'mappings.*.auto_fraction' => 'nullable|boolean',
            'mappings.*.notes' => 'nullable|string|max:1000',
            'mappings.*.external_reference' => 'nullable|string',
            'mappings.*.external_name' => 'nullable|string',
        ]);

        // Aplicar cálculo automático de frações antes de salvar
        $mappingsData = $this->pizzaFractionService->applyAutoFractions(
            $orderItem,
            $validated['mappings']
        );

        // Detectar tamanho da pizza do produto pai (main)
        $pizzaSize = null;
        $mainMapping = collect($mappingsData)->firstWhere('mapping_type', 'main');
        if ($mainMapping) {
            $mainProduct = InternalProduct::find($mainMapping['internal_product_id']);
            if ($mainProduct && $mainProduct->size) {
                $pizzaSize = $mainProduct->size;
            }
        }
        
        // Fallback: detectar do nome se produto pai não tiver size
        if (!$pizzaSize) {
            $pizzaSize = $this->detectPizzaSize($orderItem->name);
        }

        // Buscar mappings existentes antes de deletar (para preservar os que não foram enviados)
        $existingMappings = $orderItem->mappings()->get();
        
        // Deletar apenas os mappings que estão sendo atualizados
        $updatingIds = collect($validated['mappings'])->pluck('id')->filter();
        if ($updatingIds->isNotEmpty()) {
            $orderItem->mappings()->whereIn('id', $updatingIds)->delete();
        }

        // Mesclar: mappings novos + mappings existentes que não foram atualizados
        $mappingsToRecreate = collect($mappingsData);
        
        foreach ($existingMappings as $existing) {
            $isBeingUpdated = collect($validated['mappings'])->contains('id', $existing->id);
            if (!$isBeingUpdated) {
                // Recalcular CMV dos sabores existentes com o novo tamanho
                $product = $existing->internalProduct;
                $correctCMV = null;
                
                if ($product && $product->product_category === 'sabor_pizza' && $pizzaSize) {
                    $cmv = $product->calculateCMV($pizzaSize);
                    $correctCMV = $cmv > 0 ? $cmv : (float) $product->unit_cost;
                } elseif ($product) {
                    $correctCMV = (float) $product->unit_cost;
                }
                
                // Atualizar o override do mapping existente
                $existing->update(['unit_cost_override' => $correctCMV]);
            }
        }

        // Criar novas associações com CMV correto
        foreach ($mappingsData as $mapping) {
            $product = InternalProduct::find($mapping['internal_product_id']);
            
            // Calcular CMV correto: sabores de pizza usam tamanho do produto pai
            $correctCMV = null;
            if ($product) {
                if ($product->product_category === 'sabor_pizza' && $pizzaSize) {
                    $cmv = $product->calculateCMV($pizzaSize);
                    $correctCMV = $cmv > 0 ? $cmv : (float) $product->unit_cost;
                } else {
                    $correctCMV = (float) $product->unit_cost;
                }
            }

            OrderItemMapping::create([
                'tenant_id' => tenant_id(),
                'order_item_id' => $orderItem->id,
                'internal_product_id' => $mapping['internal_product_id'],
                'quantity' => $mapping['quantity'],
                'mapping_type' => $mapping['mapping_type'],
                'option_type' => $mapping['option_type'] ?? null,
                'auto_fraction' => $mapping['auto_fraction'] ?? false,
                'notes' => $mapping['notes'] ?? null,
                'external_reference' => $mapping['external_reference'] ?? null,
                'external_name' => $mapping['external_name'] ?? null,
                'unit_cost_override' => $correctCMV,
            ]);
        }

        return back()->with('success', 'Associações atualizadas com sucesso!');
    }

    /**
     * Delete all mappings for an order item
     */
    public function destroy(OrderItem $orderItem)
    {
        // Verificar permissão de tenant
        if ($orderItem->tenant_id !== tenant_id()) {
            abort(403);
        }

        $orderItem->mappings()->delete();

        return back()->with('success', 'Associações removidas com sucesso!');
    }
}
