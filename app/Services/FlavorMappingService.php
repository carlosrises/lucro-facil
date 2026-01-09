<?php

namespace App\Services;

use App\Models\InternalProduct;
use App\Models\OrderItem;
use App\Models\OrderItemMapping;
use App\Models\ProductMapping;

class FlavorMappingService
{
    /**
     * Detectar tamanho da pizza a partir do nome do item
     */
    protected function detectPizzaSize(string $itemName): ?string
    {
        $itemNameLower = mb_strtolower($itemName);

        // Broto
        if (preg_match('/\bbroto\b/', $itemNameLower)) {
            return 'broto';
        }

        // Grande
        if (preg_match('/\bgrande\b/', $itemNameLower)) {
            return 'grande';
        }

        // Família (incluindo variações como big, don, 70x35, etc)
        if (preg_match('/\b(familia|big|don|70x35)\b/', $itemNameLower)) {
            return 'familia';
        }

        // Média (deve vir por último pois é o mais genérico)
        if (preg_match('/\b(media|média|m\b)/', $itemNameLower)) {
            return 'media';
        }

        return null;
    }

    /**
     * Calcular o CMV correto do produto baseado no tamanho
     */
    protected function calculateCorrectCMV(InternalProduct $product, OrderItem $orderItem): float
    {
        \Log::info('💰 FlavorMappingService - calculateCorrectCMV', [
            'product_id' => $product->id,
            'product_name' => $product->name,
            'product_category' => $product->product_category,
            'order_item_id' => $orderItem->id,
            'order_item_name' => $orderItem->name,
        ]);

        // Se não for sabor de pizza, usar unit_cost normal
        if ($product->product_category !== 'sabor_pizza') {
            \Log::info('💰 Não é sabor_pizza, usando unit_cost', [
                'unit_cost' => $product->unit_cost,
            ]);
            return (float) $product->unit_cost;
        }

        // PRIMEIRO: Buscar o produto pai através do mapping principal
        $pizzaSize = null;
        $mainMapping = $orderItem->mappings()->where('mapping_type', 'main')->first();

        \Log::info('🔍 Buscando produto pai', [
            'has_main_mapping' => $mainMapping !== null,
            'main_product_id' => $mainMapping?->internal_product_id,
        ]);

        if ($mainMapping && $mainMapping->internalProduct) {
            $pizzaSize = $mainMapping->internalProduct->size;

            \Log::info('🍕 FlavorMappingService - Tamanho do produto pai via mapping', [
                'main_product_id' => $mainMapping->internalProduct->id,
                'main_product_name' => $mainMapping->internalProduct->name,
                'main_product_size' => $pizzaSize,
            ]);
        }

        // FALLBACK: Detectar o tamanho do nome do item pai
        if (!$pizzaSize) {
            $pizzaSize = $this->detectPizzaSize($orderItem->name);

            \Log::info('🍕 FlavorMappingService - Tamanho detectado do nome (fallback)', [
                'order_item_name' => $orderItem->name,
                'detected_size' => $pizzaSize,
            ]);
        }

        // Se não detectou tamanho, usar unit_cost genérico
        if (!$pizzaSize) {
            \Log::info('⚠️ Tamanho não detectado, usando unit_cost', [
                'unit_cost' => $product->unit_cost,
            ]);
            return (float) $product->unit_cost;
        }

        // Calcular CMV dinamicamente pela ficha técnica
        $cmv = $product->calculateCMV($pizzaSize);

        \Log::info('💰 FlavorMappingService - CMV calculado', [
            'product_name' => $product->name,
            'size' => $pizzaSize,
            'cmv_calculated' => $cmv,
            'unit_cost' => $product->unit_cost,
            'has_costs' => $product->costs()->exists(),
        ]);

        return $cmv > 0 ? $cmv : (float) $product->unit_cost;
    }
    /**
     * Aplicar mapeamento de sabor a todos os add_ons com o mesmo nome
     */
    public function mapFlavorToAllOccurrences(
        ProductMapping $mapping,
        int $tenantId
    ): int {
        \Log::info('🍕 FlavorMappingService - Iniciando mapFlavorToAllOccurrences', [
            'mapping_id' => $mapping->id,
            'external_item_id' => $mapping->external_item_id,
            'internal_product_id' => $mapping->internal_product_id,
        ]);

        if ($mapping->item_type !== 'flavor') {
            \Log::info('⚠️ Não é flavor, abortando');
            return 0;
        }

        // Extrair o nome do sabor do SKU do add-on
        $flavorName = $this->extractFlavorNameFromSku($mapping->external_item_id);

        \Log::info('🍕 Nome do sabor extraído', [
            'flavor_name' => $flavorName,
        ]);

        if (! $flavorName) {
            \Log::info('⚠️ Nome do sabor não extraído, abortando');
            return 0;
        }

        $mappedCount = 0;

        // Buscar todos os order_items que contêm este sabor nos add_ons
        $orderItems = OrderItem::where('tenant_id', $tenantId)
            ->whereNotNull('add_ons')
            ->whereRaw('JSON_LENGTH(add_ons) > 0')
            ->get();

        \Log::info('🔍 OrderItems com add_ons encontrados', [
            'count' => $orderItems->count(),
        ]);

        foreach ($orderItems as $orderItem) {
            $addOns = $orderItem->add_ons;
            if (! is_array($addOns)) {
                continue;
            }

            foreach ($addOns as $index => $addOn) {
                $addOnName = $addOn['name'] ?? '';

                // Verificar se é o sabor que estamos mapeando
                if (strtolower(trim($addOnName)) !== strtolower(trim($flavorName))) {
                    continue;
                }

                \Log::info('🎯 Add-on encontrado', [
                    'order_item_id' => $orderItem->id,
                    'order_item_name' => $orderItem->name,
                    'add_on_name' => $addOnName,
                    'add_on_index' => $index,
                ]);

                // Verificar se já tem mapping para este add-on específico
                $existingMapping = OrderItemMapping::where('order_item_id', $orderItem->id)
                    ->where('mapping_type', 'addon')
                    ->where('external_reference', (string) $index)
                    ->first();

                // Calcular CMV correto baseado no tamanho
                $product = InternalProduct::find($mapping->internal_product_id);
                $correctCMV = $product ? $this->calculateCorrectCMV($product, $orderItem) : 0;

                \Log::info('💰 CMV calculado', [
                    'product_id' => $product?->id,
                    'product_name' => $product?->name,
                    'cmv_calculated' => $correctCMV,
                ]);

                if ($existingMapping) {
                    \Log::info('🔄 Atualizando mapping existente', [
                        'mapping_id' => $existingMapping->id,
                        'old_internal_product_id' => $existingMapping->internal_product_id,
                        'new_internal_product_id' => $mapping->internal_product_id,
                        'old_unit_cost_override' => $existingMapping->unit_cost_override,
                        'new_unit_cost_override' => $correctCMV,
                    ]);

                    // ATUALIZAR mapping existente com novo produto e CMV
                    $existingMapping->update([
                        'internal_product_id' => $mapping->internal_product_id,
                        'unit_cost_override' => $correctCMV,
                    ]);

                    $mappedCount++;
                    continue;
                }

                // Calcular a fração baseado no produto pai
                $fraction = $this->calculateFraction($orderItem, $addOn);

                // Obter quantidade do add-on (quantas unidades deste add-on no pedido)
                $addOnQuantity = $addOn['quantity'] ?? $addOn['qty'] ?? 1;

                \Log::info('✨ Criando novo mapping', [
                    'order_item_id' => $orderItem->id,
                    'fraction' => $fraction,
                    'add_on_quantity' => $addOnQuantity,
                    'unit_cost_override' => $correctCMV,
                ]);

                // Criar o mapeamento com CMV correto
                OrderItemMapping::create([
                    'tenant_id' => $tenantId,
                    'order_item_id' => $orderItem->id,
                    'internal_product_id' => $mapping->internal_product_id,
                    'quantity' => $fraction * $addOnQuantity, // Fração x Quantidade do add-on
                    'mapping_type' => 'addon',
                    'option_type' => 'pizza_flavor',
                    'auto_fraction' => true,
                    'external_reference' => (string) $index,
                    'external_name' => $addOnName,
                    'unit_cost_override' => $correctCMV, // CMV calculado por tamanho
                ]);

                $mappedCount++;

                // NOVO: Recalcular frações de todos os sabores deste order_item
                $this->recalculateAllFlavorsForOrderItem($orderItem);
            }
        }

        \Log::info('✅ FlavorMappingService - Concluído', [
            'mapped_count' => $mappedCount,
        ]);

        return $mappedCount;
    }

    /**
     * Recalcular frações de TODOS os sabores de um order_item
     * Isso é chamado quando um novo sabor é adicionado
     * IMPORTANTE: Só recalcula sabores que JÁ foram classificados (têm ProductMapping tipo 'flavor')
     */
    protected function recalculateAllFlavorsForOrderItem(OrderItem $orderItem): void
    {
        // Buscar TODOS os mappings de sabores deste order_item
        $flavorMappings = OrderItemMapping::where('order_item_id', $orderItem->id)
            ->where('mapping_type', 'addon')
            ->where('option_type', 'pizza_flavor')
            ->where('auto_fraction', true)
            ->get();

        if ($flavorMappings->isEmpty()) {
            return;
        }

        // Filtrar apenas sabores que foram classificados (têm ProductMapping tipo 'flavor')
        $classifiedFlavors = $flavorMappings->filter(function ($mapping) use ($orderItem) {
            // Buscar o add-on para pegar o nome
            $addOns = $orderItem->add_ons;
            if (!is_array($addOns) || !isset($addOns[$mapping->external_reference])) {
                return false;
            }

            $addOn = $addOns[$mapping->external_reference];
            $addOnName = $addOn['name'] ?? '';
            if (!$addOnName) {
                return false;
            }

            // Verificar se este add-on tem ProductMapping do tipo 'flavor'
            $addOnSku = 'addon_'.md5($addOnName);
            $productMapping = ProductMapping::where('tenant_id', $orderItem->tenant_id)
                ->where('external_item_id', $addOnSku)
                ->where('item_type', 'flavor')
                ->first();

            return $productMapping !== null;
        });

        if ($classifiedFlavors->isEmpty()) {
            return;
        }

        $totalFlavors = $classifiedFlavors->count();
        $newFraction = 1.0 / $totalFlavors;

        // Atualizar fração de cada sabor classificado, mantendo a quantidade do add-on
        foreach ($classifiedFlavors as $mapping) {
            // Buscar o add-on original para pegar a quantidade
            $addOns = $orderItem->add_ons;
            $addOnQuantity = 1;

            if (is_array($addOns) && isset($addOns[$mapping->external_reference])) {
                $addOn = $addOns[$mapping->external_reference];
                $addOnQuantity = $addOn['quantity'] ?? $addOn['qty'] ?? 1;
            }

            // Atualizar: nova fração x quantidade do add-on
            $mapping->update(['quantity' => $newFraction * $addOnQuantity]);
        }
    }

    /**
     * Calcular a fração do sabor baseado no produto pai e total de sabores
     */
    protected function calculateFraction(OrderItem $orderItem, array $addOn): float
    {
        // Buscar o produto pai (item principal) para saber quantos sabores suporta
        $parentProduct = $this->getParentProduct($orderItem);

        if (! $parentProduct || $parentProduct->product_category !== 'pizza') {
            // Se não é pizza ou não tem produto pai, retorna 100%
            return 1.0;
        }

        $maxFlavors = $parentProduct->max_flavors ?? 1;

        // Contar quantos sabores vieram neste pedido
        $totalFlavors = $this->countFlavorsInOrderItem($orderItem);

        if ($totalFlavors === 0) {
            return 1.0;
        }

        // Calcular a fração: 100% / número de sabores
        // Ex: 4 sabores = 0.25 (25% cada)
        // Ex: 1 sabor = 1.0 (100%)
        return 1.0 / $totalFlavors;
    }

    /**
     * Buscar o produto interno vinculado ao item principal (produto pai)
     */
    protected function getParentProduct(OrderItem $orderItem): ?InternalProduct
    {
        // Buscar o ProductMapping do item principal
        $productMapping = ProductMapping::where('tenant_id', $orderItem->tenant_id)
            ->where('external_item_id', $orderItem->sku)
            ->where('item_type', 'parent_product')
            ->first();

        if (! $productMapping) {
            return null;
        }

        return $productMapping->internalProduct;
    }

    /**
     * Contar quantos sabores (flavors) existem nos add_ons deste item
     */
    protected function countFlavorsInOrderItem(OrderItem $orderItem): int
    {
        $addOns = $orderItem->add_ons;
        if (! is_array($addOns)) {
            return 0;
        }

        $flavorCount = 0;

        foreach ($addOns as $index => $addOn) {
            $addOnName = $addOn['name'] ?? '';
            if (! $addOnName) {
                continue;
            }

            // Verificar se este add-on é um sabor (tem ProductMapping do tipo 'flavor')
            $addOnSku = 'addon_'.md5($addOnName);
            $mapping = ProductMapping::where('tenant_id', $orderItem->tenant_id)
                ->where('external_item_id', $addOnSku)
                ->where('item_type', 'flavor')
                ->first();

            if ($mapping) {
                $flavorCount++;
            }
        }

        // Se nenhum sabor foi classificado ainda, retornar 1 para evitar divisão por zero
        return $flavorCount > 0 ? $flavorCount : 1;
    }

    /**
     * Extrair o nome do sabor do SKU do add-on
     * Como o SKU é gerado como 'addon_' + md5(nome), precisamos buscar o nome original
     */
    protected function extractFlavorNameFromSku(string $sku): ?string
    {
        if (! str_starts_with($sku, 'addon_')) {
            return null;
        }

        // Buscar no banco um order_item que tenha este add-on
        $orderItems = OrderItem::whereNotNull('add_ons')
            ->whereRaw('JSON_LENGTH(add_ons) > 0')
            ->get();

        foreach ($orderItems as $orderItem) {
            $addOns = $orderItem->add_ons;
            if (! is_array($addOns)) {
                continue;
            }

            foreach ($addOns as $addOn) {
                $addOnName = $addOn['name'] ?? '';
                $generatedSku = 'addon_'.md5($addOnName);

                if ($generatedSku === $sku) {
                    return $addOnName;
                }
            }
        }

        return null;
    }
}
