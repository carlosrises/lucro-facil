<?php

namespace App\Console\Commands;

use App\Models\Order;
use App\Services\OrderCostService;
use Illuminate\Console\Command;

class RecalculateTakeatOrders extends Command
{
    protected $signature = 'orders:recalculate-takeat {--limit= : Limitar quantidade de pedidos}';

    protected $description = 'Recalcula todos os pedidos do Takeat para aplicar a nova lógica de PaymentMethodMapping';

    public function handle(OrderCostService $orderCostService): int
    {
        $this->info('🔄 Iniciando recálculo de pedidos Takeat...');

        $query = Order::where('provider', 'takeat')
            ->whereNotNull('calculated_costs')
            ->orderBy('id', 'desc');

        if ($limit = $this->option('limit')) {
            $query->limit((int) $limit);
        }

        $totalOrders = $query->count();
        $this->info("📊 Total de pedidos a recalcular: {$totalOrders}");

        $bar = $this->output->createProgressBar($totalOrders);
        $bar->start();

        $processedCount = 0;
        $errorCount = 0;

        $query->chunk(100, function ($orders) use ($orderCostService, $bar, &$processedCount, &$errorCount) {
            foreach ($orders as $order) {
                try {
                    // Recalcular custos (usará a nova lógica de PaymentMethodMapping)
                    $result = $orderCostService->calculateCosts($order);
                    $order->update([
                        'calculated_costs' => $result,
                        'total_costs' => $result['total_costs'] ?? 0,
                        'total_commissions' => $result['total_commissions'] ?? 0,
                        'net_revenue' => $result['net_revenue'] ?? 0,
                        'costs_calculated_at' => now(),
                    ]);

                    $processedCount++;
                } catch (\Exception $e) {
                    $errorCount++;
                    $this->newLine();
                    $this->error("❌ Erro no pedido {$order->id}: {$e->getMessage()}");
                }

                $bar->advance();
            }
        });

        $bar->finish();
        $this->newLine(2);

        $this->info("✅ Recálculo concluído!");
        $this->table(
            ['Métrica', 'Valor'],
            [
                ['Total processados', $processedCount],
                ['Erros', $errorCount],
                ['Sucesso', $processedCount - $errorCount],
            ]
        );

        return self::SUCCESS;
    }
}
