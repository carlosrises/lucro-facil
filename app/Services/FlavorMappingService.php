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

        // PRIMEIRO: Buscar o produto pai através do mapping principal
        $pizzaSize = null;
        $mainMapping = $orderItem->mappings()->where('mapping_type', 'main')->first();

        if ($mainMapping && $mainMapping->internalProduct) {
            $pizzaSize = $mainMapping->internalProduct->size;
        }

        // FALLBACK: Detectar o tamanho do nome do item pai
        if (! $pizzaSize) {
            $pizzaSize = $this->detectPizzaSize($orderItem->name);
        }

        // Se não detectou tamanho, usar unit_cost genérico
        if (! $pizzaSize) {
            return (float) $product->unit_cost;
        }

        // Calcular CMV dinamicamente pela ficha técnica
        $cmv = $product->calculateCMV($pizzaSize);

        return $cmv > 0 ? $cmv : (float) $product->unit_cost;
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

                // Calcular CMV correto baseado no tamanho
                $product = InternalProduct::find($mapping->internal_product_id);
                $correctCMV = $product ? $this->calculateCorrectCMV($product, $orderItem) : 0;

                if ($existingMapping) {
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

                // Criar o mapeamento com CMV correto
                // IMPORTANTE: Aqui criamos com a fração simples * quantidade
                // mas depois recalculateAllFlavorsForOrderItem vai ajustar considerando TODOS os sabores
                OrderItemMapping::create([
                    'tenant_id' => $tenantId,
                    'order_item_id' => $orderItem->id,
                    'internal_product_id' => $mapping->internal_product_id,
                    'quantity' => $fraction, // Fração será recalculada considerando todos os sabores
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
     * Cria mappings para sabores classificados que ainda não têm, e atualiza frações de todos
     */
    protected function recalculateAllFlavorsForOrderItem(OrderItem $orderItem): void
    {        // Buscar todos os add-ons que são sabores (têm ProductMapping tipo 'flavor')
        $addOns = $orderItem->add_ons;
        if (! is_array($addOns) || empty($addOns)) {
            return;
        }

        $classifiedFlavors = [];

        foreach ($addOns as $index => $addOn) {
            $addOnName = $addOn['name'] ?? '';
            if (! $addOnName) {
                continue;
            }

            // Verificar se este add-on tem ProductMapping do tipo 'flavor'
            $addOnSku = 'addon_'.md5($addOnName);
            $productMapping = ProductMapping::where('tenant_id', $orderItem->tenant_id)
                ->where('external_item_id', $addOnSku)
                ->where('item_type', 'flavor')
                ->first();

            if ($productMapping && $productMapping->internal_product_id) {
                $classifiedFlavors[] = [
                    'index' => $index,
                    'name' => $addOnName,
                    'product_mapping' => $productMapping,
                    'quantity' => $addOn['quantity'] ?? $addOn['qty'] ?? 1,
                ];
            }
        }

        if (empty($classifiedFlavors)) {
            return;
        }

        // Somar as quantidades de todos os sabores (2x Portuguesa + 1x Calabresa = 3 sabores)
        $totalFlavorQuantity = array_sum(array_column($classifiedFlavors, 'quantity'));

        if ($totalFlavorQuantity === 0) {
            return;
        }

        // Para cada sabor classificado, criar ou atualizar OrderItemMapping
        foreach ($classifiedFlavors as $flavor) {
            // Calcular a fração baseada na quantidade deste sabor / total de sabores
            // Ex: 2x Portuguesa de 3 sabores = 2/3
            $flavorFraction = $flavor['quantity'] / $totalFlavorQuantity;

            $existingMapping = OrderItemMapping::where('order_item_id', $orderItem->id)
                ->where('mapping_type', 'addon')
                ->where('external_reference', (string) $flavor['index'])
                ->first();

            // Calcular CMV correto baseado no tamanho
            $product = InternalProduct::find($flavor['product_mapping']->internal_product_id);
            $correctCMV = $product ? $this->calculateCorrectCMV($product, $orderItem) : null;

            if ($existingMapping) {
                // Atualizar mapping existente
                $existingMapping->update([
                    'quantity' => $flavorFraction,
                    'unit_cost_override' => $correctCMV,
                ]);
            } else {
                // Criar novo mapping
                OrderItemMapping::create([
                    'tenant_id' => $orderItem->tenant_id,
                    'order_item_id' => $orderItem->id,
                    'internal_product_id' => $flavor['product_mapping']->internal_product_id,
                    'quantity' => $flavorFraction,
                    'mapping_type' => 'addon',
                    'option_type' => 'pizza_flavor',
                    'auto_fraction' => true,
                    'external_reference' => (string) $flavor['index'],
                    'external_name' => $flavor['name'],
                    'unit_cost_override' => $correctCMV,
                ]);
            }
        }
    }

    /**
     * Calcular a fração do sabor baseado no produto pai e total de sabores
     */
    protected function calculateFraction(OrderItem $orderItem, array $addOn): float
    {
        // Verificar se este add-on específico é um sabor
        $addOnName = $addOn['name'] ?? '';
        $addOnSku = 'addon_'.md5($addOnName);

        $mapping = ProductMapping::where('tenant_id', $orderItem->tenant_id)
            ->where('external_item_id', $addOnSku)
            ->first();

        // Se não é sabor de pizza (item_type='flavor'), retorna 100%
        if (! $mapping || $mapping->item_type !== 'flavor') {
            return 1.0;
        }

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
                // Somar a quantidade do add-on (2x = 2 sabores)
                $addOnQty = $addOn['quantity'] ?? $addOn['qty'] ?? 1;
                $flavorCount += $addOnQty;
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
