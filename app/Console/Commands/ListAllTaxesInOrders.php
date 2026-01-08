<?php

namespace App\Console\Commands;

use App\Models\Order;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class ListAllTaxesInOrders extends Command
{
    protected $signature = 'orders:list-all-taxes {--tenant= : ID do tenant}';

    protected $description = 'Listar TODAS as taxas que aparecem em calculated_costs dos pedidos';

    public function handle(): int
    {
        $tenantId = $this->option('tenant');

        $this->info('🔍 Analisando todos os pedidos com calculated_costs...');

        $query = Order::whereNotNull('calculated_costs');

        if ($tenantId) {
            $query->where('tenant_id', $tenantId);
        }

        $total = $query->count();
        $this->info("📊 Analisando {$total} pedidos...");

        $allTaxes = [];
        $categories = ['costs', 'commissions', 'taxes', 'payment_methods'];

        $bar = $this->output->createProgressBar($total);
        $bar->start();

        $query->chunk(100, function ($orders) use (&$allTaxes, $categories, $bar) {
            foreach ($orders as $order) {
                $costs = $order->calculated_costs;

                foreach ($categories as $category) {
                    if (! empty($costs[$category])) {
                        foreach ($costs[$category] as $item) {
                            $taxId = $item['id'] ?? null;
                            $taxName = $item['name'] ?? 'Sem nome';

                            if ($taxId) {
                                if (! isset($allTaxes[$taxId])) {
                                    $allTaxes[$taxId] = [
                                        'id' => $taxId,
                                        'name' => $taxName,
                                        'category' => $category,
                                        'count' => 0,
                                        'exists_in_db' => null,
                                    ];
                                }
                                $allTaxes[$taxId]['count']++;
                            }
                        }
                    }
                }

                $bar->advance();
            }
        });

        $bar->finish();
        $this->newLine(2);

        // Verificar quais existem no banco
        $this->info('🔍 Verificando existência no banco de dados...');

        $taxIds = array_keys($allTaxes);
        $existingIds = DB::table('cost_commissions')
            ->whereIn('id', $taxIds)
            ->pluck('id')
            ->toArray();

        foreach ($allTaxes as $taxId => &$taxData) {
            $taxData['exists_in_db'] = in_array($taxId, $existingIds);
        }

        // Separar entre existentes e órfãs
        $existing = array_filter($allTaxes, fn ($tax) => $tax['exists_in_db']);
        $orphans = array_filter($allTaxes, fn ($tax) => ! $tax['exists_in_db']);

        $this->newLine();
        $this->info('📋 Resumo:');
        $this->line('  Total de taxas únicas encontradas: '.count($allTaxes));
        $this->line('  Taxas que existem no banco: '.count($existing));
        $this->error('  Taxas ÓRFÃS (não existem mais): '.count($orphans));

        if (! empty($orphans)) {
            $this->newLine();
            $this->error('⚠️  TAXAS ÓRFÃS ENCONTRADAS:');
            $this->table(
                ['ID', 'Nome', 'Categoria', 'Quantidade de Pedidos'],
                array_map(fn ($tax) => [
                    $tax['id'],
                    $tax['name'],
                    $tax['category'],
                    $tax['count'],
                ], array_values($orphans))
            );

            $this->newLine();
            $this->line('Para recalcular e remover essas taxas órfãs, execute:');
            $this->line('php artisan orders:find-orphan-taxes --fix'.($tenantId ? " --tenant={$tenantId}" : ''));
        }

        if (! empty($existing)) {
            $this->newLine();
            $this->info('✅ TAXAS ATIVAS EM USO:');
            $this->table(
                ['ID', 'Nome', 'Categoria', 'Quantidade de Pedidos'],
                array_map(fn ($tax) => [
                    $tax['id'],
                    $tax['name'],
                    $tax['category'],
                    $tax['count'],
                ], array_values($existing))
            );
        }

        return 0;
    }
}
