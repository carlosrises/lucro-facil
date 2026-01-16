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

        // Contar sabores de pizza com auto_fraction ativado
        $pizzaFlavors = $mappings->where('option_type', OrderItemMapping::OPTION_TYPE_PIZZA_FLAVOR)
            ->where('auto_fraction', true);

        $flavorCount = $pizzaFlavors->count();

        // Se não houver sabores ou só 0, não faz nada
        if ($flavorCount <= 0) {
            return [
                'updated' => 0,
                'pizza_flavors' => 0,
                'fraction' => 0,
            ];
        }

        // Sempre dividir pela quantidade real de sabores escolhidos
        // NÃO usar max_flavors, pois uma pizza de 4 sabores pode ter apenas 2 escolhidos
        $fraction = $this->calculateFraction($flavorCount);

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

                \Log::info('🔄 Não-sabor corrigido para 100%', [
                    'mapping_id' => $mapping->id,
                    'option_type' => $mapping->option_type,
                    'external_name' => $mapping->external_name,
                    'old_quantity' => $mapping->getOriginal('quantity'),
                ]);
            }
        }

        // Depois, atualizar cada sabor com a fração calculada
        $updated = 0;
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
                $updated++;

                \Log::info('🔄 Fração e CMV atualizados', [
                    'mapping_id' => $mapping->id,
                    'product_name' => $product?->name,
                    'fraction' => $fraction,
                    'addon_quantity' => $addOnQuantity,
                    'new_quantity' => $newQuantity,
                    'old_cmv' => $mapping->getOriginal('unit_cost_override'),
                    'new_cmv' => $newCMV,
                ]);
            }
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
            $pizzaSize = $mainMapping->internalProduct->size;

            \Log::info('🍕 PizzaFractionService - Tamanho do produto pai', [
                'main_product_id' => $mainMapping->internalProduct->id,
                'main_product_name' => $mainMapping->internalProduct->name,
                'main_product_size' => $pizzaSize,
            ]);
        }

        // FALLBACK: Detectar o tamanho do nome do item pai
        if (!$pizzaSize) {
            $pizzaSize = $this->detectPizzaSize($orderItem->name);

            \Log::info('🍕 PizzaFractionService - Tamanho detectado do nome (fallback)', [
                'order_item_name' => $orderItem->name,
                'detected_size' => $pizzaSize,
            ]);
        }

        // Se não detectou tamanho, usar unit_cost genérico
        if (!$pizzaSize) {
            return (float) $product->unit_cost;
        }

        // Calcular CMV dinamicamente pela ficha técnica
        $cmv = $product->calculateCMV($pizzaSize);

        \Log::info('💰 PizzaFractionService - CMV calculado', [
            'product_name' => $product->name,
            'size' => $pizzaSize,
            'cmv_calculated' => $cmv,
            'unit_cost' => $product->unit_cost,
        ]);

        return $cmv > 0 ? $cmv : (float) $product->unit_cost;
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
        // Contar quantos são pizza_flavor com auto_fraction
        $pizzaFlavorCount = collect($newMappings)
            ->where('option_type', OrderItemMapping::OPTION_TYPE_PIZZA_FLAVOR)
            ->where('auto_fraction', true)
            ->count();

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
