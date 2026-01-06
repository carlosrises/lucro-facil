<?php

namespace App\Services;

use App\Models\OrderItem;
use App\Models\OrderItemMapping;

/**
 * Serviço para calcular automaticamente frações de pizzas
 *
 * Lógica:
 * 1. Conta quantos mappings são do tipo 'pizza_flavor'
 * 2. Divide 1 pelo número de sabores (ex: 2 sabores = 0.5 cada)
 * 3. Atualiza automaticamente a quantidade de cada sabor
 * 4. Mantém outros tipos (addon, drink, etc) com quantidade original
 */
class PizzaFractionService
{
    /**
     * Recalcular frações de pizza para um OrderItem
     *
     * @param OrderItem $orderItem
     * @return array ['updated' => int, 'pizza_flavors' => int, 'fraction' => float]
     */
    public function recalculateFractions(OrderItem $orderItem): array
    {
        $mappings = $orderItem->mappings()->get();

        // Contar sabores de pizza com auto_fraction ativado
        $pizzaFlavors = $mappings->where('option_type', OrderItemMapping::OPTION_TYPE_PIZZA_FLAVOR)
                                  ->where('auto_fraction', true);

        $flavorCount = $pizzaFlavors->count();

        // Se não houver sabores ou só 1, não faz nada
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

        // Atualizar cada sabor com a fração calculada
        $updated = 0;
        foreach ($pizzaFlavors as $mapping) {
            // Só atualiza se a quantidade estiver diferente
            if ((float) $mapping->quantity !== $fraction) {
                $mapping->quantity = $fraction;
                $mapping->save();
                $updated++;
            }
        }

        return [
            'updated' => $updated,
            'pizza_flavors' => $flavorCount,
            'fraction' => $fraction,
        ];
    }

    /**
     * Calcular fração esperada com base no número de sabores
     *
     * @param int $flavorCount
     * @return float
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
     * @param OrderItem $orderItem
     * @param array $newMappings Array com os novos mappings a serem criados
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

        // Atualizar quantidade de cada pizza_flavor com auto_fraction
        return collect($newMappings)->map(function ($mapping) use ($fraction) {
            if (
                ($mapping['option_type'] ?? null) === OrderItemMapping::OPTION_TYPE_PIZZA_FLAVOR &&
                ($mapping['auto_fraction'] ?? false) === true
            ) {
                $mapping['quantity'] = $fraction;
            }

            return $mapping;
        })->toArray();
    }

    /**
     * Verificar se um OrderItem tem pizzas com sabores múltiplos
     *
     * @param OrderItem $orderItem
     * @return bool
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
     * @param OrderItem $orderItem
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
