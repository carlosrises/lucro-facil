<?php

namespace App\Services;

use App\Models\InternalProduct;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderItemMapping;
use App\Models\ProductMapping;

class FlavorMappingService
{
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

        if (!$flavorName) {
            return 0;
        }

        $mappedCount = 0;

        // Buscar todos os order_items que contêm este sabor nos add_ons
        $orderItems = OrderItem::where('tenant_id', $tenantId)
            ->whereNotNull('add_ons')
            ->whereRaw("JSON_LENGTH(add_ons) > 0")
            ->get();

        foreach ($orderItems as $orderItem) {
            $addOns = $orderItem->add_ons;
            if (!is_array($addOns)) continue;

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

                // Criar o mapeamento
                OrderItemMapping::create([
                    'tenant_id' => $tenantId,
                    'order_item_id' => $orderItem->id,
                    'internal_product_id' => $mapping->internal_product_id,
                    'quantity' => $fraction,
                    'mapping_type' => 'addon',
                    'option_type' => 'pizza_flavor',
                    'auto_fraction' => true,
                    'external_reference' => (string) $index,
                    'external_name' => $addOnName,
                ]);

                $mappedCount++;
            }
        }

        return $mappedCount;
    }

    /**
     * Calcular a fração do sabor baseado no produto pai e total de sabores
     */
    protected function calculateFraction(OrderItem $orderItem, array $addOn): float
    {
        // Buscar o produto pai (item principal) para saber quantos sabores suporta
        $parentProduct = $this->getParentProduct($orderItem);

        if (!$parentProduct || $parentProduct->product_category !== 'pizza') {
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

        if (!$productMapping) {
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
        if (!is_array($addOns)) {
            return 0;
        }

        $flavorCount = 0;

        foreach ($addOns as $index => $addOn) {
            $addOnName = $addOn['name'] ?? '';
            if (!$addOnName) continue;

            // Verificar se este add-on é um sabor (tem ProductMapping do tipo 'flavor')
            $addOnSku = 'addon_' . md5($addOnName);
            $mapping = ProductMapping::where('tenant_id', $orderItem->tenant_id)
                ->where('external_item_id', $addOnSku)
                ->where('item_type', 'flavor')
                ->first();

            if ($mapping) {
                $flavorCount++;
            }
        }

        // Se nenhum sabor foi classificado ainda, retornar 1 para evitar divisão por zero
        // Não devemos assumir que todos os add-ons são sabores
        return $flavorCount > 0 ? $flavorCount : 1;
    }

    /**
     * Extrair o nome do sabor do SKU do add-on
     * Como o SKU é gerado como 'addon_' + md5(nome), precisamos buscar o nome original
     */
    protected function extractFlavorNameFromSku(string $sku): ?string
    {
        if (!str_starts_with($sku, 'addon_')) {
            return null;
        }

        // Buscar no banco um order_item que tenha este add-on
        $orderItems = OrderItem::whereNotNull('add_ons')
            ->whereRaw("JSON_LENGTH(add_ons) > 0")
            ->get();

        foreach ($orderItems as $orderItem) {
            $addOns = $orderItem->add_ons;
            if (!is_array($addOns)) continue;

            foreach ($addOns as $addOn) {
                $addOnName = $addOn['name'] ?? '';
                $generatedSku = 'addon_' . md5($addOnName);

                if ($generatedSku === $sku) {
                    return $addOnName;
                }
            }
        }

        return null;
    }
}
