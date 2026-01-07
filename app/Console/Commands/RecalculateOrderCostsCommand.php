<?php

namespace App\Console\Commands;

use App\Jobs\RecalculateOrderCostsJob;
use App\Models\CostCommission;
use Illuminate\Console\Command;

class RecalculateOrderCostsCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'orders:recalculate-costs {cost_commission_id?} {--all} {--tenant=}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Recalcular custos e comissões dos pedidos';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $costCommissionId = $this->argument('cost_commission_id');
        $applyToAll = $this->option('all');
        $tenantId = $this->option('tenant');

        // Se não passou ID nem tenant, tentar pegar qualquer custo para descobrir o tenant
        if (! $costCommissionId && ! $tenantId) {
            $cost = CostCommission::first();

            if (! $cost) {
                $this->error('Nenhum custo/comissão encontrado!');
                $this->warn('Use --tenant=ID para recalcular pedidos de um tenant específico');

                return 1;
            }

            $tenantId = $cost->tenant_id;
            $this->info("Usando tenant do primeiro custo encontrado: {$tenantId}");
        }

        // Se passou tenant mas não ID, recalcular todos os pedidos do tenant
        if ($tenantId && ! $costCommissionId) {
            $this->info("Recalculando TODOS os pedidos do tenant {$tenantId}...");

            $service = app(\App\Services\OrderCostService::class);
            $count = 0;

            \App\Models\Order::where('tenant_id', $tenantId)
                ->chunk(100, function ($orders) use ($service, &$count) {
                    $service->recalculateBatch($orders);
                    $count += $orders->count();
                    $this->info("Processados {$count} pedidos...");
                });

            $this->info("Recálculo concluído! Total: {$count} pedidos");

            return 0;
        }

        // Se passou ID, usar a lógica antiga
        $cost = CostCommission::find($costCommissionId);

        if (! $cost) {
            $this->error("Custo/comissão ID {$costCommissionId} não encontrado!");

            return 1;
        }

        $this->info("Recalculando para: {$cost->name}");

        // Despachar o job
        RecalculateOrderCostsJob::dispatch(
            $cost->id,
            $applyToAll,
            'cost_commission',
            $cost->tenant_id,
            $cost->provider
        );

        $this->info('Job despachado com sucesso!');
        $this->info("Tenant: {$cost->tenant_id}, Provider: {$cost->provider}");

        if ($applyToAll) {
            $this->warn('Modo: Aplicar a TODOS os pedidos (sem filtro de provider)');
        } else {
            $this->info('Modo: Filtrar por provider');
        }

        return 0;
    }
}
