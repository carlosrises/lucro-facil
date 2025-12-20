<?php

namespace App\Console\Commands;

use App\Models\Order;
use App\Services\OrderCostService;
use Illuminate\Console\Command;

class RecalculateTakeatCosts extends Command
{
    protected $signature = 'orders:recalculate-takeat-costs';
    protected $description = 'Recalcular custos e comissões dos pedidos Takeat';

    public function handle(OrderCostService $costService): int
    {
        $this->info('Buscando pedidos Takeat...');

        $total = Order::where('provider', 'takeat')->count();
        $this->info("Encontrados {$total} pedidos Takeat");

        $bar = $this->output->createProgressBar($total);
        $bar->start();

        $count = 0;
        
        // Processar em chunks para não estourar memória
        Order::where('provider', 'takeat')
            ->chunk(100, function ($orders) use ($costService, &$count, $bar) {
                foreach ($orders as $order) {
                    try {
                        $costService->applyAndSaveCosts($order);
                        $count++;
                    } catch (\Exception $e) {
                        $this->error("\nErro no pedido {$order->code}: " . $e->getMessage());
                    }
                    $bar->advance();
                }
            });

        $bar->finish();
        $this->newLine();
        $this->info("✓ Recalculados {$count} pedidos com sucesso!");

        return 0;
    }
}
