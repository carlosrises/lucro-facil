<?php

namespace App\Observers;

use App\Jobs\RecalculateOrderCostsJob;
use App\Models\Ingredient;
use App\Models\ProductCost;

class IngredientObserver
{
    /**
     * Handle the Ingredient "updated" event.
     * Quando o preço de um insumo muda, recalcular todos os produtos que o usam
     */
    public function updated(Ingredient $ingredient): void
    {
        // Só recalcular se o preço unitário mudou
        if (!$ingredient->isDirty('unit_price')) {
            return;
        }

        // Buscar produtos que usam este insumo
        $productIds = ProductCost::where('ingredient_id', $ingredient->id)
            ->pluck('internal_product_id')
            ->unique();

        // Para cada produto, despachar job de recálculo
        foreach ($productIds as $productId) {
            RecalculateOrderCostsJob::dispatch(
                $productId,
                true, // applyToAll = recalcular todos os pedidos com este produto
                'product'
            );
        }
    }
}
