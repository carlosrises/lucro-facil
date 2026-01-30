<?php

namespace App\Observers;

use App\Jobs\RecalculateOrderCostsJob;
use App\Models\Order;
use App\Models\PaymentMethodMapping;

class PaymentMethodMappingObserver
{
    /**
     * Handle the PaymentMethodMapping "updated" event.
     * Recalcula pedidos quando taxa de pagamento é vinculada/alterada
     */
    public function updated(PaymentMethodMapping $mapping): void
    {
        // Se mudou a taxa vinculada ou flags de taxa, recalcular pedidos
        if ($mapping->isDirty(['cost_commission_id', 'has_no_fee', 'payment_category'])) {
            $this->recalculateAffectedOrders($mapping);
        }
    }

    /**
     * Handle the PaymentMethodMapping "created" event.
     * Recalcula pedidos quando novo mapping é criado
     */
    public function created(PaymentMethodMapping $mapping): void
    {
        if ($mapping->cost_commission_id || $mapping->has_no_fee) {
            $this->recalculateAffectedOrders($mapping);
        }
    }

    /**
     * Handle the PaymentMethodMapping "deleted" event.
     * Recalcula pedidos quando mapping é deletado
     */
    public function deleted(PaymentMethodMapping $mapping): void
    {
        $this->recalculateAffectedOrders($mapping);
    }

    private function recalculateAffectedOrders(PaymentMethodMapping $mapping): void
    {
        // Buscar pedidos que usam este método de pagamento
        $orders = Order::where('tenant_id', $mapping->tenant_id)
            ->where('provider', $mapping->provider)
            ->whereRaw("JSON_SEARCH(
                JSON_EXTRACT(raw, '$.session.payments[*].payment_method.id'),
                'one',
                ?
            ) IS NOT NULL", [$mapping->external_payment_method_id])
            ->get();

        // Recalcular cada pedido
        foreach ($orders as $order) {
            RecalculateOrderCostsJob::dispatch(
                $order->id,
                false,
                'order'
            );
        }
    }
}
