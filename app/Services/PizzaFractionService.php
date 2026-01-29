<?php

namespace App\Services;

use App\Models\InternalProduct;
use App\Models\OrderItem;
use App\Models\OrderItemMapping;

/**
 * Serviço para calcular automaticamente frações de pizzas
 *
 * Lógica:
 * 1. Conta quantos mappings são do tipo 'pizza_flavor'
 * 2. Divide 1 pelo número de sabores (ex: 2 sabores = 0.5 cada)
 * 3. Atualiza automaticamente a quantidade de cada sabor
 * 4. Recalcula o CMV baseado no tamanho da pizza pai
 * 5. Mantém outros tipos (addon, drink, etc) com quantidade original
 */
class PizzaFractionService
{
    /**
     * Recalcular frações de pizza para um OrderItem
     *
     * @return array ['updated' => int, 'pizza_flavors' => int, 'fraction' => float]
     */
    public function recalculateFractions(OrderItem $orderItem): array
    {
        $mappings = $orderItem->mappings()->get();

        // Contar sabores CLASSIFICADOS (com ProductMapping tipo 'flavor') nos add_ons
        // NÃO apenas os que já têm OrderItemMapping
        $flavorCount = $this->countClassifiedFlavors($orderItem);

        // Se não houver sabores classificados, não faz nada
        if ($flavorCount <= 0) {
            return [
                'updated' => 0,
                'pizza_flavors' => 0,
                'fraction' => 0,
            ];
        }

        // Buscar apenas os sabores que TÊM OrderItemMapping (para atualizar)
        $pizzaFlavors = $mappings->where('option_type', OrderItemMapping::OPTION_TYPE_PIZZA_FLAVOR)
            ->where('auto_fraction', true);

        // Sempre dividir pela quantidade real de sabores escolhidos
        // NÃO usar max_flavors, pois uma pizza de 4 sabores pode ter apenas 2 escolhidos
        $fraction = $this->calculateFraction($flavorCount);

        // Contador de atualizações (inicializado antes dos dois loops)
        $updated = 0;

        // Primeiro, corrigir não-sabores para quantity = 1.0
        $nonFlavors = $mappings->whereNotIn('option_type', [
            OrderItemMapping::OPTION_TYPE_PIZZA_FLAVOR,
            null
        ]);

        foreach ($nonFlavors as $mapping) {
            if (abs((float) $mapping->quantity - 1.0) > 0.0001) {
                $mapping->quantity = 1.0;
                $mapping->save();
                $updated++;
            }
        }

        // Depois, atualizar cada sabor com a fração calculada
        foreach ($pizzaFlavors as $mapping) {
            // Buscar a quantidade original do add-on no OrderItem
            $addOns = $orderItem->add_ons;
            $addOnQuantity = 1;

            if (is_array($addOns) && $mapping->external_reference !== null) {
                $index = (int) $mapping->external_reference;
                if (isset($addOns[$index])) {
                    $addOn = $addOns[$index];
                    $addOnQuantity = $addOn['quantity'] ?? $addOn['qty'] ?? 1;
                }
            }

            // Quantidade final = fração × quantidade do add-on
            $newQuantity = $fraction * $addOnQuantity;

            // Recalcular CMV baseado no tamanho da pizza pai
            $product = $mapping->internalProduct;
            $newCMV = $product ? $this->calculateCorrectCMV($product, $orderItem) : $mapping->unit_cost_override;

            // Atualizar se houver mudança
            $quantityChanged = abs((float) $mapping->quantity - $newQuantity) > 0.0001;
            $cmvChanged = $newCMV !== null && abs((float) $mapping->unit_cost_override - $newCMV) > 0.01;

            if ($quantityChanged || $cmvChanged) {
                $mapping->quantity = $newQuantity;
                if ($newCMV !== null) {
                    $mapping->unit_cost_override = $newCMV;
                }
                $mapping->save();
                $updated++;            }
        }

        return [
            'updated' => $updated,
            'pizza_flavors' => $flavorCount,
            'fraction' => $fraction,
        ];
    }

    /**
     * Calcular o CMV correto do produto baseado no tamanho da pizza pai
     */
    protected function calculateCorrectCMV(InternalProduct $product, OrderItem $orderItem): ?float
    {
        // Se não for sabor de pizza, usar unit_cost normal
        if ($product->product_category !== 'sabor_pizza') {
            return (float) $product->unit_cost;
        }

        // Buscar o produto pai através do mapping principal
        $pizzaSize = null;
        $mainMapping = $orderItem->mappings()->where('mapping_type', 'main')->first();

        if ($mainMapping && $mainMapping->internalProduct) {
            $pizzaSize = $mainMapping->internalProduct->size;        }

        // FALLBACK: Detectar o tamanho do nome do item pai
        if (!$pizzaSize) {
            $pizzaSize = $this->detectPizzaSize($orderItem->name);        }

        // Se não detectou tamanho, usar unit_cost genérico
        if (!$pizzaSize) {
            return (float) $product->unit_cost;
        }

        // Calcular CMV dinamicamente pela ficha técnica
        $cmv = $product->calculateCMV($pizzaSize);        return $cmv > 0 ? $cmv : (float) $product->unit_cost;
    }

    /**
     * Detectar tamanho da pizza a partir do nome do item
     */
    protected function detectPizzaSize(string $itemName): ?string
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
     * Calcular fração esperada com base no número de sabores
     */
    public function calculateFraction(int $flavorCount): float
    {
        if ($flavorCount <= 0) {
            return 0;
        }

        return 1 / $flavorCount;
    }

    /**
     * Atualizar fração de todos os sabores ao adicionar/remover um sabor
     *
     * @param  array  $newMappings  Array com os novos mappings a serem criados
     * @return array Mappings atualizados com frações calculadas
     */
    public function applyAutoFractions(OrderItem $orderItem, array $newMappings): array
    {
        // Somar quantidade total de sabores (considera 2x = 2 sabores)
        $pizzaFlavorCount = collect($newMappings)
            ->where('option_type', OrderItemMapping::OPTION_TYPE_PIZZA_FLAVOR)
            ->where('auto_fraction', true)
            ->sum('quantity');

        if ($pizzaFlavorCount === 0) {
            return $newMappings;
        }

        // Sempre dividir pela quantidade real de sabores escolhidos
        // NÃO usar max_flavors, pois uma pizza de 4 sabores pode ter apenas 2 escolhidos
        $fraction = $this->calculateFraction($pizzaFlavorCount);

        // Atualizar quantidade de cada item baseado no tipo
        return collect($newMappings)->map(function ($mapping) use ($fraction) {
            $optionType = $mapping['option_type'] ?? null;

            // Sabores de pizza com auto_fraction = fração calculada
            if ($optionType === OrderItemMapping::OPTION_TYPE_PIZZA_FLAVOR &&
                ($mapping['auto_fraction'] ?? false) === true) {
                $mapping['quantity'] = $fraction;
            }
            // Todos os outros tipos (drink, addon, regular, observation) = 100%
            elseif ($optionType !== null && $optionType !== OrderItemMapping::OPTION_TYPE_PIZZA_FLAVOR) {
                $mapping['quantity'] = 1.0;
            }

            return $mapping;
        })->toArray();
    }

    /**
     * Contar sabores CLASSIFICADOS (com ProductMapping tipo 'flavor') nos add_ons
     * Conta mesmo os que não têm produto vinculado, pois estão classificados como sabor
     */
    private function countClassifiedFlavors(OrderItem $orderItem): int
    {
        $addOns = $orderItem->add_ons;
        if (!is_array($addOns) || empty($addOns)) {
            return 0;
        }

        $classifiedFlavorsCount = 0;

        foreach ($addOns as $addOn) {
            $addOnName = $addOn['name'] ?? '';
            if (!$addOnName) {
                continue;
            }

            // Gerar SKU do add-on
            $addOnSku = 'addon_' . md5($addOnName);

            // Buscar ProductMapping do tipo 'flavor' (mesmo sem produto vinculado)
            $productMapping = \App\Models\ProductMapping::where('tenant_id', $orderItem->tenant_id)
                ->where('external_item_id', $addOnSku)
                ->where('item_type', 'flavor')
                ->first();

            if ($productMapping) {
                // Contar a quantidade deste add-on (ex: 2x Portuguesa)
                $quantity = $addOn['quantity'] ?? $addOn['qty'] ?? 1;
                $classifiedFlavorsCount += $quantity;
            }
        }

        return $classifiedFlavorsCount;
    }

    /**
     * Verificar se um OrderItem tem pizzas com sabores múltiplos
     */
    public function hasPizzaFlavors(OrderItem $orderItem): bool
    {
        return $orderItem->mappings()
            ->where('option_type', OrderItemMapping::OPTION_TYPE_PIZZA_FLAVOR)
            ->exists();
    }

    /**
     * Obter resumo dos sabores de pizza
     *
     * @return array ['count' => int, 'fraction' => float, 'flavors' => Collection]
     */
    public function getPizzaFlavorsSummary(OrderItem $orderItem): array
    {
        $flavors = $orderItem->mappings()
            ->where('option_type', OrderItemMapping::OPTION_TYPE_PIZZA_FLAVOR)
            ->with('internalProduct')
            ->get();

        $count = $flavors->count();
        $fraction = $count > 0 ? (1 / $count) : 0;

        return [
            'count' => $count,
            'fraction' => $fraction,
            'flavors' => $flavors,
        ];
    }
}
