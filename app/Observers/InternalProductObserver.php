<?php

namespace App\Observers;

use App\Jobs\RecalculateOrderCostsJob;
use App\Models\InternalProduct;
use App\Models\ProductCost;

class InternalProductObserver
{
    /**
     * Handle the InternalProduct "updated" event.
     * Recalcula pedidos quando unit_cost ou tax_category mudam
     */
    public function updated(InternalProduct $product): void
    {
        // Se mudou o custo unitário ou categoria fiscal, recalcular pedidos
        if ($product->isDirty(['unit_cost', 'tax_category_id'])) {
            RecalculateOrderCostsJob::dispatch(
                $product->id,
                true, // applyToAll = recalcular todos os pedidos com este produto
                'product'
            );
        }

        // Se este produto é usado como insumo em outros produtos, recalculá-los também
        if ($product->isDirty('unit_cost') && $product->is_ingredient) {
            $parentProductIds = ProductCost::where('ingredient_id', $product->id)
                ->pluck('internal_product_id')
                ->unique();

            foreach ($parentProductIds as $parentId) {
                RecalculateOrderCostsJob::dispatch(
                    $parentId,
                    true,
                    'product'
                );
            }
        }
    }
}
