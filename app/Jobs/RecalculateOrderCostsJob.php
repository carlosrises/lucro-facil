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
        public ?int $tenantId = null, // Para quando o registro já foi excluído
        public ?string $provider = null, // Para quando o registro já foi excluído
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
            // Para cost_commission, tentar buscar o registro
            $costCommission = \App\Models\CostCommission::find($this->referenceId);

            // Se não encontrar mas temos tenantId (caso de exclusão), usar os dados passados
            if (!$costCommission && $this->tenantId) {
                $query = Order::where('tenant_id', $this->tenantId);

                if (!$this->applyToAll && $this->provider) {
                    $query->where(function($q) {
                        $q->where('provider', $this->provider)
                          ->orWhere(function($q2) {
                              $q2->where('provider', 'takeat')
                                 ->where('origin', $this->provider);
                          });
                    });
                }
            } elseif (!$costCommission) {
                \Log::error("CostCommission não encontrada e sem dados alternativos: {$this->referenceId}");
                return;
            } else {
                // Registro encontrado, usar seus dados
                $query = Order::where('tenant_id', $costCommission->tenant_id);

                if (!$this->applyToAll && $costCommission->provider) {
                    $query->where(function($q) use ($costCommission) {
                        $q->where('provider', $costCommission->provider)
                          ->orWhere(function($q2) use ($costCommission) {
                              $q2->where('provider', 'takeat')
                                 ->where('origin', $costCommission->provider);
                          });
                    });
                }
            }
        }

        // Processar em chunks para não sobrecarregar memória
        $query->chunk(100, function ($orders) use ($costService) {
            $costService->recalculateBatch($orders);
        });

        \Log::info("Recálculo de custos concluído - type: {$this->type}, referenceId: {$this->referenceId}");
    }
}
