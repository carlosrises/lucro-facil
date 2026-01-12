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
        public bool $onlySpecificCommission = false, // Recalcular apenas esta comissão específica
        public bool $isDeleting = false, // Flag para indicar que está removendo a comissão
    ) {}

    /**
     * Execute the job.
     */
    public function handle(OrderCostService $costService): void
    {
        $cacheKey = $this->getCacheKey();

        // Limpar qualquer cache antigo antes de iniciar
        \Cache::forget($cacheKey);

        // Inicializar progresso no cache com status 'processing'
        \Cache::put($cacheKey, [
            'status' => 'processing',
            'total' => 0,
            'processed' => 0,
            'percentage' => 0,
            'started_at' => now()->toISOString(),
        ], now()->addHours(2));

        // Se type for 'product', buscar pedidos que têm itens com esse produto
        if ($this->type === 'product') {
            $query = Order::whereHas('items', function ($q) {
                $q->where('internal_product_id', $this->referenceId);
            });
        } else {
            // Para cost_commission, tentar buscar o registro
            $costCommission = \App\Models\CostCommission::find($this->referenceId);

            // Se não encontrar mas temos tenantId (caso de exclusão), usar os dados passados
            if (! $costCommission && $this->tenantId) {
                // Para exclusão, buscar apenas pedidos que TÊM essa comissão no calculated_costs
                if ($this->isDeleting) {
                    $query = Order::where('tenant_id', $this->tenantId)
                        ->whereNotNull('calculated_costs')
                        ->whereRaw("JSON_SEARCH(calculated_costs, 'one', ?, NULL, '$**.id') IS NOT NULL", [$this->referenceId]);
                } else {
                    $query = Order::where('tenant_id', $this->tenantId);

                    if (! $this->applyToAll && $this->provider) {
                        // Se provider for takeat-{origin}, precisamos separar
                        if (str_starts_with($this->provider, 'takeat-')) {
                            $origin = str_replace('takeat-', '', $this->provider);
                            $query->where('provider', 'takeat')->where('origin', $origin);
                        } else {
                            $query->where(function ($q) {
                                $q->where('provider', $this->provider)
                                    ->orWhere(function ($q2) {
                                        $q2->where('provider', 'takeat')
                                            ->where('origin', $this->provider);
                                    });
                            });
                        }
                    }
                }
            } elseif (! $costCommission) {
                \Log::error("CostCommission não encontrada e sem dados alternativos: {$this->referenceId}");
                \Cache::put($cacheKey, [
                    'status' => 'error',
                    'message' => 'Registro não encontrado',
                ], now()->addHours(2));

                return;
            } else {
                // Registro encontrado, usar seus dados
                $query = Order::where('tenant_id', $costCommission->tenant_id);

                // FILTRO ESPECIAL: Para taxas de pagamento, recalcular APENAS pedidos com aquele método
                if ($costCommission->category === 'payment_method' && $costCommission->condition_values) {
                    // condition_values contém os métodos normalizados (ex: ['CASH', 'CREDIT_CARD'])
                    // Precisamos buscar pedidos cujos pagamentos, após normalização, correspondam a esses métodos

                    // Para otimizar, vamos buscar TODAS as keywords que normalizam para os métodos desejados
                    $linkService = app(\App\Services\PaymentFeeLinkService::class);
                    $targetMethods = $costCommission->condition_values;

                    // Mapeamento reverso: quais keywords normalizam para cada método alvo
                    $keywordsToSearch = [];
                    $keywordMap = [
                        'CASH' => ['dinheiro', 'money', 'cash'],
                        'CREDIT_CARD' => ['others'], // "others" + nome contendo "crédito"
                        'DEBIT_CARD' => ['stone_debit', 'neemo_débito'],
                        'PIX' => ['others', 'pix_auto'], // "others" + nome contendo "pix"
                        'VOUCHER' => ['alelo_refeicao', 'sodexo_refeicao', 'ticket'],
                        'ONLINE' => ['99food_pagamento_online', 'online_ifood', 'ifood_online'],
                        'CASHBACK' => ['clube'],
                    ];

                    foreach ($targetMethods as $method) {
                        if (isset($keywordMap[$method])) {
                            $keywordsToSearch = array_merge($keywordsToSearch, $keywordMap[$method]);
                        }
                    }

                    if (!empty($keywordsToSearch)) {
                        $query->where(function ($q) use ($keywordsToSearch) {
                            foreach ($keywordsToSearch as $keyword) {
                                // Para Takeat: verificar raw->session->payments->payment_method->keyword
                                $q->orWhere(function ($subQ) use ($keyword) {
                                    $subQ->where('provider', 'takeat')
                                        ->whereRaw("JSON_SEARCH(raw, 'one', ?, NULL, '$.session.payments[*].payment_method.keyword') IS NOT NULL", [$keyword]);
                                });
                            }
                        });
                    }
                }

                if (! $this->applyToAll && $costCommission->provider) {
                    // Se provider for takeat-{origin}, precisamos separar
                    if (str_starts_with($costCommission->provider, 'takeat-')) {
                        $origin = str_replace('takeat-', '', $costCommission->provider);
                        $query->where('provider', 'takeat')->where('origin', $origin);
                    } else {
                        $query->where(function ($q) use ($costCommission) {
                            $q->where('provider', $costCommission->provider)
                                ->orWhere(function ($q2) use ($costCommission) {
                                    $q2->where('provider', 'takeat')
                                        ->where('origin', $costCommission->provider);
                                });
                        });
                    }
                }
            }
        }

        // Contar total de pedidos
        $total = $query->count();

        \Cache::put($cacheKey, [
            'status' => 'processing',
            'total' => $total,
            'processed' => 0,
            'percentage' => 0,
            'started_at' => now()->toISOString(),
        ], now()->addHours(2));

        // Se não houver pedidos, finalizar
        if ($total === 0) {
            \Cache::put($cacheKey, [
                'status' => 'completed',
                'total' => 0,
                'processed' => 0,
                'percentage' => 100,
                'completed_at' => now()->toISOString(),
            ], now()->addHours(2));

            return;
        }

        // Processar em chunks para não sobrecarregar memória
        $processed = 0;
        $commissionId = $this->onlySpecificCommission ? $this->referenceId : null;
        $query->chunk(100, function ($orders) use ($costService, $cacheKey, &$processed, $total, $commissionId) {
            $costService->recalculateBatch($orders, $commissionId, $this->isDeleting);
            $processed += $orders->count();

            // Atualizar progresso no cache
            \Cache::put($cacheKey, [
                'status' => 'processing',
                'total' => $total,
                'processed' => $processed,
                'percentage' => round(($processed / $total) * 100, 1),
                'started_at' => \Cache::get($cacheKey)['started_at'] ?? now()->toISOString(),
            ], now()->addHours(2));
        });

        // Marcar como concluído
        \Cache::put($cacheKey, [
            'status' => 'completed',
            'total' => $total,
            'processed' => $processed,
            'percentage' => 100,
            'started_at' => \Cache::get($cacheKey)['started_at'] ?? now()->toISOString(),
            'completed_at' => now()->toISOString(),
        ], now()->addHours(2));

        \Log::info("Recálculo de custos concluído - type: {$this->type}, referenceId: {$this->referenceId}, total: {$total}");
    }

    /**
     * Get cache key for tracking progress
     */
    private function getCacheKey(): string
    {
        $tenantId = $this->tenantId ?? (\App\Models\CostCommission::find($this->referenceId)?->tenant_id ?? 'unknown');

        return "recalculate_progress_{$tenantId}_{$this->type}_{$this->referenceId}";
    }
}
