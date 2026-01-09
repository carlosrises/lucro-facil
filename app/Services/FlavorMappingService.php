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
        // Se não for sabor de pizza, usar unit_cost normal
        if ($product->product_category !== 'sabor_pizza') {
            return (float) $product->unit_cost;
        }

        // Detectar o tamanho do item pai
        $size = $this->detectPizzaSize($orderItem->name);

        // Se não detectou tamanho, usar unit_cost genérico
        if (!$size) {
            return (float) $product->unit_cost;
        }

        // Verificar se o produto tem ficha técnica
        $hasCosts = $product->costs()->exists();

        // Se tem ficha técnica, calcular CMV pelo tamanho
        if ($hasCosts) {
            return $product->calculateCMV($size);
        }

        // Se não tem ficha técnica mas tem cmv_by_size, usar ele
        if ($product->cmv_by_size && is_array($product->cmv_by_size) && isset($product->cmv_by_size[$size])) {
            return (float) $product->cmv_by_size[$size];
        }

        // Fallback: unit_cost genérico
        return (float) $product->unit_cost;
    }
    /**
     * Aplicar mapeamento de sabor a todos os add_ons com o mesmo nome
     */
    public function mapFlavorToAllOccurrences(
        ProductMapping $mapping,
        int $tenantId
    ): int {
        if ($mapping->item_type !== 'flavor') {
            return 0;
        }

        // Extrair o nome do sabor do SKU do add-on
        $flavorName = $this->extractFlavorNameFromSku($mapping->external_item_id);

        if (! $flavorName) {
            return 0;
        }

        $mappedCount = 0;

        // Buscar todos os order_items que contêm este sabor nos add_ons
        $orderItems = OrderItem::where('tenant_id', $tenantId)
            ->whereNotNull('add_ons')
            ->whereRaw('JSON_LENGTH(add_ons) > 0')
            ->get();

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

                // Verificar se já tem mapping para este add-on específico
                $existingMapping = OrderItemMapping::where('order_item_id', $orderItem->id)
                    ->where('mapping_type', 'addon')
                    ->where('external_reference', (string) $index)
                    ->first();

                if ($existingMapping) {
                    continue;
                }

                // Calcular a fração baseado no produto pai
                $fraction = $this->calculateFraction($orderItem, $addOn);

                // Obter quantidade do add-on (quantas unidades deste add-on no pedido)
                $addOnQuantity = $addOn['quantity'] ?? $addOn['qty'] ?? 1;

                // Calcular CMV correto baseado no tamanho
                $product = InternalProduct::find($mapping->internal_product_id);
                $correctCMV = $product ? $this->calculateCorrectCMV($product, $orderItem) : 0;

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
