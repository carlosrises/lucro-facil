<?php

namespace App\Observers;

use App\Jobs\RecalculateOrderCostsJob;
use App\Models\OrderItem;

class OrderItemObserver
{
    /**
     * Handle the OrderItem "updated" event.
     * Recalcula custos quando produto interno é vinculado/desvinculado
     */
    public function updated(OrderItem $item): void
    {
        // Se mudou o produto interno vinculado, recalcular custos do pedido
        if ($item->isDirty('internal_product_id')) {
            $this->triggerRecalculation($item);
        }
    }

    /**
     * Handle the OrderItem "created" event.
     * Recalcula quando novo item é adicionado com produto interno
     */
    public function created(OrderItem $item): void
    {
        if ($item->internal_product_id) {
            $this->triggerRecalculation($item);
        }
    }

    /**
     * Handle the OrderItem "deleted" event.
     * Recalcula quando item é removido
     */
    public function deleted(OrderItem $item): void
    {
        $this->triggerRecalculation($item);
    }

    private function triggerRecalculation(OrderItem $item): void
    {
        if (!$item->order) {
            return;
        }

        // Despachar job para recalcular custos do pedido
        RecalculateOrderCostsJob::dispatch(
            $item->order_id,
            false,
            'order'
        );
    }
}
