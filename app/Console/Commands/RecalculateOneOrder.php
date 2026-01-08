<?php

namespace App\Console\Commands;

use App\Models\Order;
use App\Services\OrderCostService;
use Illuminate\Console\Command;

class RecalculateOneOrder extends Command
{
    protected $signature = 'orders:recalculate-one {code : Código do pedido}';

    protected $description = 'Recalcular custos de UM pedido específico com debug detalhado';

    public function handle(OrderCostService $costService): int
    {
        $code = $this->argument('code');

        $this->info("🔍 Buscando pedido: {$code}");

        $order = Order::where('code', $code)->first();

        if (! $order) {
            $this->error("❌ Pedido {$code} não encontrado");

            return 1;
        }

        $this->info("✅ Pedido encontrado: ID {$order->id}, Provider: {$order->provider}, Origin: {$order->origin}");
        $this->newLine();

        // Mostrar calculated_costs ANTES
        $this->warn('📋 ANTES do recálculo:');
        $this->showOrderCosts($order);
        $this->newLine();

        // Recalcular
        $this->info('🔧 Recalculando custos...');

        try {
            $costService->applyAndSaveCosts($order);
            $this->info('✅ Recálculo concluído!');
        } catch (\Exception $e) {
            $this->error("❌ Erro ao recalcular: {$e->getMessage()}");
            $this->error($e->getTraceAsString());

            return 1;
        }

        $this->newLine();

        // Recarregar pedido do banco
        $order->refresh();

        // Mostrar calculated_costs DEPOIS
        $this->info('📋 DEPOIS do recálculo:');
        $this->showOrderCosts($order);

        return 0;
    }

    private function showOrderCosts(Order $order): void
    {
        $costs = $order->calculated_costs;

        if (empty($costs)) {
            $this->line('  Sem custos calculados');

            return;
        }

        $categories = ['costs', 'commissions', 'taxes', 'payment_methods'];

        foreach ($categories as $category) {
            if (! empty($costs[$category])) {
                $this->line("  {$category}:");
                foreach ($costs[$category] as $item) {
                    $id = $item['id'] ?? 'sem-id';
                    $name = $item['name'] ?? 'Sem nome';
                    $value = $item['calculated_value'] ?? 0;
                    $this->line("    • [{$id}] {$name}: R$ {$value}");
                }
            }
        }

        $this->line("\n  Totais:");
        $this->line("    • Custos: R$ {$order->total_costs}");
        $this->line("    • Comissões: R$ {$order->total_commissions}");
        $this->line("    • Receita líquida: R$ {$order->net_revenue}");
    }
}
