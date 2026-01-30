<?php

namespace App\Observers;

use App\Jobs\RecalculateOrderCostsJob;
use App\Models\ProductCost;

class ProductCostObserver
{
    /**
     * Handle the ProductCost "created" event.
     * Recalcula quando ingrediente é adicionado à receita
     */
    public function created(ProductCost $productCost): void
    {
        $this->triggerRecalculation($productCost);
    }

    /**
     * Handle the ProductCost "updated" event.
     * Recalcula quando quantidade de ingrediente muda
     */
    public function updated(ProductCost $productCost): void
    {
        if ($productCost->isDirty(['qty', 'ingredient_id'])) {
            $this->triggerRecalculation($productCost);
        }
    }

    /**
     * Handle the ProductCost "deleted" event.
     * Recalcula quando ingrediente é removido da receita
     */
    public function deleted(ProductCost $productCost): void
    {
        $this->triggerRecalculation($productCost);
    }

    private function triggerRecalculation(ProductCost $productCost): void
    {
        // Recalcular pedidos que usam este produto
        RecalculateOrderCostsJob::dispatch(
            $productCost->internal_product_id,
            true, // applyToAll = recalcular todos os pedidos com este produto
            'product'
        );
    }
}
