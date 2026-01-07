<?php

namespace App\Console\Commands;

use App\Models\CostCommission;
use App\Models\Order;
use Illuminate\Console\Command;

class DebugRecalculation extends Command
{
    protected $signature = 'debug:recalculation {commissionId}';
    protected $description = 'Debug recalculation query for a commission';

    public function handle()
    {
        $commissionId = $this->argument('commissionId');
        $costCommission = CostCommission::find($commissionId);

        if (!$costCommission) {
            $this->error("Comissão ID {$commissionId} não encontrada");
            return 1;
        }

        $this->info("=== Dados da Comissão ===");
        $this->info("ID: {$costCommission->id}");
        $this->info("Nome: {$costCommission->name}");
        $this->info("Provider: {$costCommission->provider}");
        $this->info("Applies to: {$costCommission->applies_to}");
        $this->info("Delivery by: {$costCommission->delivery_by}");
        $this->info("Tenant ID: {$costCommission->tenant_id}");
        $this->newLine();

        // Replicar a query do job
        $query = Order::where('tenant_id', $costCommission->tenant_id);

        $this->info("=== Query Base ===");
        $this->info("Tenant {$costCommission->tenant_id}: " . $query->count() . " pedidos");
        $this->newLine();

        // Aplicar filtro de provider
        if ($costCommission->provider) {
            $queryWithProvider = clone $query;
            $queryWithProvider->where(function ($q) use ($costCommission) {
                $q->where('provider', $costCommission->provider)
                    ->orWhere(function ($q2) use ($costCommission) {
                        $q2->where('provider', 'takeat')
                            ->where('origin', $costCommission->provider);
                    });
            });

            $this->info("=== Com Filtro de Provider ===");
            $this->info("Provider direto ('{$costCommission->provider}'): " .
                Order::where('tenant_id', $costCommission->tenant_id)
                    ->where('provider', $costCommission->provider)
                    ->count() . " pedidos");

            $this->info("Takeat com origin ('{$costCommission->provider}'): " .
                Order::where('tenant_id', $costCommission->tenant_id)
                    ->where('provider', 'takeat')
                    ->where('origin', $costCommission->provider)
                    ->count() . " pedidos");

            $this->info("Total com filtro OR: " . $queryWithProvider->count() . " pedidos");
            $this->newLine();
        }

        // Mostrar alguns pedidos de exemplo
        $this->info("=== Pedidos Takeat-iFood no tenant ===");
        $count = Order::where('tenant_id', $costCommission->tenant_id)
            ->where('provider', 'takeat')
            ->where('origin', 'ifood')
            ->count();

        $this->info("Total de pedidos takeat-ifood: {$count}");

        if ($count > 0) {
            $orders = Order::where('tenant_id', $costCommission->tenant_id)
                ->where('provider', 'takeat')
                ->where('origin', 'ifood')
                ->limit(5)
                ->get();

            foreach ($orders as $order) {
                $deliveryBy = 'N/A';
                if (isset($order->raw['session']['delivery_by'])) {
                    $deliveryBy = $order->raw['session']['delivery_by'];
                }
                $this->info("  Order {$order->id}: provider={$order->provider}, origin={$order->origin}, delivery_by={$deliveryBy}");
            }
        }

        return 0;
    }
}
