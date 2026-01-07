<?php

namespace App\Console\Commands;

use App\Models\Order;
use App\Services\OrderCostService;
use Illuminate\Console\Command;

class RecalculateAllCosts extends Command
{
    protected $signature = 'orders:recalculate-all-costs';

    protected $description = 'Recalcular custos e comissões de todos os pedidos';

    public function handle(OrderCostService $costService): int
    {
        $this->info('Buscando todos os pedidos...');

        $orders = Order::all();
        $total = $orders->count();

        $this->info("Encontrados {$total} pedidos");

        $bar = $this->output->createProgressBar($total);
        $bar->start();

        $count = 0;
        foreach ($orders as $order) {
            try {
                $costService->applyAndSaveCosts($order);
                $count++;
            } catch (\Exception $e) {
                $this->error("\nErro no pedido {$order->code}: ".$e->getMessage());
            }
            $bar->advance();
        }

        $bar->finish();
        $this->newLine();
        $this->info("✓ Recalculados {$count} pedidos com sucesso!");

        return 0;
    }
}
