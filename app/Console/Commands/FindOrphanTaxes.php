<?php

namespace App\Console\Commands;

use App\Models\CostCommission;
use App\Models\Order;
use App\Services\OrderCostService;
use Illuminate\Console\Command;

class FindOrphanTaxes extends Command
{
    protected $signature = 'orders:find-orphan-taxes 
                            {--tenant= : ID do tenant para filtrar pedidos}
                            {--fix : Recalcular automaticamente pedidos com taxas órfãs}
                            {--include-inactive : Incluir taxas inativas (active=false) como órfãs}';

    protected $description = 'Encontrar pedidos com taxas no calculated_costs que não existem mais ou estão inativas';

    public function handle(OrderCostService $costService): int
    {
        $tenantId = $this->option('tenant');
        $fix = $this->option('fix');
        $includeInactive = $this->option('include-inactive');

        $this->info('🔍 Buscando pedidos com calculated_costs...');

        // Buscar todos os IDs de taxas ativas
        $activeTaxIds = CostCommission::active()->pluck('id')->toArray();
        $this->info("📋 Taxas ativas no banco: ".count($activeTaxIds));

        if ($includeInactive) {
            $inactiveTaxIds = CostCommission::where('active', false)->pluck('id')->toArray();
            $this->warn("⚠️  Taxas inativas no banco: ".count($inactiveTaxIds)." (serão tratadas como órfãs)");
        }

        if ($includeInactive) {
            $inactiveTaxIds = CostCommission::where('active', false)->pluck('id')->toArray();
            $this->warn("⚠️  Taxas inativas no banco: ".count($inactiveTaxIds)." (serão tratadas como órfãs)");
        }

        // Buscar pedidos com calculated_costs
        $query = Order::whereNotNull('calculated_costs');

        if ($tenantId) {
            $query->where('tenant_id', $tenantId);
        }

        $total = $query->count();
        $this->info("📊 Analisando {$total} pedidos...");

        $ordersWithOrphans = [];
        $orphanTaxIds = [];

        $bar = $this->output->createProgressBar($total);
        $bar->start();

        $query->chunk(100, function ($orders) use ($activeTaxIds, $includeInactive, &$ordersWithOrphans, &$orphanTaxIds, $bar) {
            foreach ($orders as $order) {
                $costs = $order->calculated_costs;
                $categories = ['costs', 'commissions', 'taxes', 'payment_methods'];
                $hasOrphan = false;

                foreach ($categories as $category) {
                    if (! empty($costs[$category])) {
                        foreach ($costs[$category] as $item) {
                            $taxId = $item['id'] ?? null;

                            // Se tem ID e não está ativo (ou não existe mais)
                            $isOrphan = false;
                            if ($taxId) {
                                if (! in_array($taxId, $activeTaxIds)) {
                                    // Não está ativo - pode estar inativo ou deletado
                                    $taxExists = CostCommission::where('id', $taxId)->exists();
                                    
                                    if (! $taxExists) {
                                        $isOrphan = true; // Deletada
                                    } elseif ($includeInactive) {
                                        $isOrphan = true; // Inativa
                                    }
                                }
                            }

                            if ($isOrphan) {
                                $hasOrphan = true;
                                $orphanTaxIds[$taxId] = ($orphanTaxIds[$taxId] ?? 0) + 1;

                                if (! isset($ordersWithOrphans[$order->id])) {
                                    $ordersWithOrphans[$order->id] = [
                                        'order' => $order,
                                        'orphans' => [],
                                    ];
                                }

                                $ordersWithOrphans[$order->id]['orphans'][] = [
                                    'category' => $category,
                                    'id' => $taxId,
                                    'name' => $item['name'] ?? 'Sem nome',
                                    'value' => $item['calculated_value'] ?? 0,
                                ];
                            }
                        }
                    }
                }

                $bar->advance();
            }
        });

        $bar->finish();
        $this->newLine(2);

        // Mostrar resultados
        if (empty($ordersWithOrphans)) {
            $this->info('✅ Nenhum pedido com taxas órfãs encontrado!');

            return 0;
        }

        $this->warn('⚠️  Encontrados '.count($ordersWithOrphans).' pedidos com taxas órfãs:');
        $this->newLine();

        // Mostrar taxas órfãs
        $this->info('📋 Taxas órfãs (ID: quantidade de pedidos):');
        foreach ($orphanTaxIds as $taxId => $count) {
            $this->line("  • ID {$taxId}: {$count} pedidos");
        }
        $this->newLine();

        // Agrupar por provider para análise
        $byProvider = collect($ordersWithOrphans)->groupBy(fn ($item) => $item['order']->provider);

        $this->info('📊 Pedidos agrupados por provider:');
        foreach ($byProvider as $provider => $items) {
            $this->line("  • {$provider}: ".count($items).' pedidos');
        }
        $this->newLine();

        // Mostrar alguns exemplos
        $this->info('📝 Exemplos de pedidos afetados:');
        $examples = array_slice($ordersWithOrphans, 0, 5);

        foreach ($examples as $item) {
            $order = $item['order'];
            $this->line("  Pedido {$order->code} ({$order->provider}):");
            foreach ($item['orphans'] as $orphan) {
                $this->line("    • [{$orphan['category']}] ID {$orphan['id']}: {$orphan['name']} (R$ {$orphan['value']})");
            }
        }

        if (count($ordersWithOrphans) > 5) {
            $this->line('  ... e mais '.(count($ordersWithOrphans) - 5).' pedidos');
        }

        $this->newLine();

        // Oferecer correção
        if ($fix || $this->confirm('Deseja recalcular estes pedidos para remover as taxas órfãs?', false)) {
            $this->info('🔧 Recalculando pedidos...');
            $bar = $this->output->createProgressBar(count($ordersWithOrphans));
            $bar->start();

            $fixed = 0;
            $errors = 0;

            foreach ($ordersWithOrphans as $item) {
                try {
                    $costService->applyAndSaveCosts($item['order']);
                    $fixed++;
                } catch (\Exception $e) {
                    $errors++;
                    $this->error("\n❌ Erro no pedido {$item['order']->code}: ".$e->getMessage());
                }
                $bar->advance();
            }

            $bar->finish();
            $this->newLine(2);
            $this->info("✅ Recalculados {$fixed} pedidos com sucesso!");

            if ($errors > 0) {
                $this->warn("⚠️  {$errors} pedidos com erro");
            }
        }

        return 0;
    }
}
