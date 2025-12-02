<?php

namespace App\Jobs;

use App\Models\Order;
use App\Services\OrderCostService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class RecalculateOrderCostsJob implements ShouldQueue
{
    use Queueable;

    /**
     * Create a new job instance.
     */
    public function __construct(
        public int $referenceId,
        public bool $applyToAll = false,
        public ?string $type = 'cost_commission', // 'cost_commission' ou 'product'
    ) {}

    /**
     * Execute the job.
     */
    public function handle(OrderCostService $costService): void
    {
        // Se type for 'product', buscar pedidos que têm itens com esse produto
        if ($this->type === 'product') {
            $query = Order::whereHas('items', function ($q) {
                $q->where('internal_product_id', $this->referenceId);
            });
        } else {
            // Para cost_commission, buscar pela taxa específica
            $costCommission = \App\Models\CostCommission::find($this->referenceId);

            if (!$costCommission) {
                \Log::error("CostCommission não encontrada: {$this->referenceId}");
                return;
            }

            $query = Order::where('tenant_id', $costCommission->tenant_id);

            // Se não for para aplicar a todos, filtrar apenas pedidos relevantes
            if (!$this->applyToAll && $costCommission->provider) {
                $query->where('provider', $costCommission->provider);
            }
        }

        // Processar em chunks para não sobrecarregar memória
        $query->chunk(100, function ($orders) use ($costService) {
            $costService->recalculateBatch($orders);
        });

        \Log::info("Recálculo de custos concluído - type: {$this->type}, referenceId: {$this->referenceId}");
    }
}
