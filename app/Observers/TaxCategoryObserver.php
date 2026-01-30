<?php

namespace App\Observers;

use App\Jobs\RecalculateOrderCostsJob;
use App\Models\InternalProduct;
use App\Models\TaxCategory;

class TaxCategoryObserver
{
    /**
     * Handle the TaxCategory "updated" event.
     * Quando alíquota muda, recalcular todos os produtos desta categoria
     */
    public function updated(TaxCategory $category): void
    {
        // Se mudou a alíquota total, recalcular produtos
        if (!$category->isDirty('total_tax_rate')) {
            return;
        }

        // Buscar produtos desta categoria
        $productIds = InternalProduct::where('tax_category_id', $category->id)
            ->where('tenant_id', $category->tenant_id)
            ->pluck('id');

        // Recalcular pedidos de cada produto
        foreach ($productIds as $productId) {
            RecalculateOrderCostsJob::dispatch(
                $productId,
                true,
                'product'
            );
        }
    }
}
