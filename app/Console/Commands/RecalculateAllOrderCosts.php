<?php

namespace App\Console\Commands;

use App\Models\CostCommission;
use App\Models\Order;
use App\Services\OrderCostService;
use Illuminate\Console\Command;

class RecalculateAllOrderCosts extends Command
{
    protected $signature = 'orders:recalculate-all-costs
                            {--tenant= : ID do tenant para filtrar pedidos}
                            {--provider= : Filtrar por provider específico}
                            {--debug : Mostrar informações de debug}
                            {--force-clean : Limpar calculated_costs antes de recalcular}';

    protected $description = 'Recalcular custos e comissões de TODOS os pedidos do zero (iFood, 99Food, Takeat, etc)';

    public function handle(OrderCostService $costService): int
    {
        $tenantId = $this->option('tenant');
        $provider = $this->option('provider');
        $debug = $this->option('debug');
        $forceClean = $this->option('force-clean');

        $this->info('🔍 Buscando pedidos...');

        if ($tenantId) {
            $this->line("   Tenant: {$tenantId}");
        }

        if ($provider) {
            $this->line("   Provider: {$provider}");
        }

        // Mostrar taxas ativas que serão aplicadas
        if ($debug) {
            $this->showActiveTaxes($tenantId, $provider);
        }

        $query = Order::query();

        if ($tenantId) {
            $query->where('tenant_id', $tenantId);
        }

        if ($provider) {
            $query->where('provider', $provider);
        }

        $total = $query->count();
        $this->info("📊 Encontrados {$total} pedidos");

        if ($total === 0) {
            $this->warn('Nenhum pedido encontrado para recalcular.');

            return 0;
        }

        // Confirmar se quer continuar
        if (! $this->confirm("Deseja recalcular {$total} pedidos?", true)) {
            $this->info('Operação cancelada.');

            return 0;
        }

        if ($forceClean) {
            $this->warn('⚠️  Modo force-clean ativado: calculated_costs será limpo antes de recalcular');
        }

        $bar = $this->output->createProgressBar($total);
        $bar->start();

        $count = 0;
        $errors = 0;

        // Processar em chunks para não estourar memória
        $query->chunk(100, function ($orders) use ($costService, &$count, &$errors, $bar, $debug, $forceClean) {
            foreach ($orders as $order) {
                try {
                    // Se forceClean, limpar calculated_costs antes
                    if ($forceClean) {
                        $order->update([
                            'calculated_costs' => null,
                            'total_costs' => 0,
                            'total_commissions' => 0,
                            'net_revenue' => 0,
                            'costs_calculated_at' => null,
                        ]);
                    }

                    if ($debug) {
                        $this->newLine();
                        $this->line("🔧 Recalculando pedido {$order->code} (provider: {$order->provider}, origin: {$order->origin})");
                    }

                    $costService->applyAndSaveCosts($order);
                    $count++;

                    if ($debug) {
                        $order->refresh();
                        $this->showOrderCosts($order);
                    }
                } catch (\Exception $e) {
                    $errors++;
                    $this->error("\n❌ Erro no pedido {$order->code}: ".$e->getMessage());
                    if ($debug) {
                        $this->error($e->getTraceAsString());
                    }
                }
                $bar->advance();
            }
        });

        $bar->finish();
        $this->newLine(2);
        $this->info("✅ Recalculados {$count} pedidos com sucesso!");

        if ($errors > 0) {
            $this->warn("⚠️  {$errors} pedidos com erro");
        }

        return 0;
    }

    /**
     * Mostrar taxas ativas que serão aplicadas
     */
    private function showActiveTaxes(?int $tenantId, ?string $provider): void
    {
        $this->newLine();
        $this->info('📋 Taxas ativas que serão aplicadas:');

        $query = CostCommission::active();

        if ($tenantId) {
            $query->where('tenant_id', $tenantId);
        }

        if ($provider) {
            $query->where(function ($q) use ($provider) {
                $q->whereNull('provider')
                    ->orWhere('provider', $provider);
            });
        }

        $taxes = $query->orderBy('category')->orderBy('name')->get();

        if ($taxes->isEmpty()) {
            $this->warn('  Nenhuma taxa ativa encontrada!');

            return;
        }

        $grouped = $taxes->groupBy('category');

        foreach ($grouped as $category => $items) {
            $this->line("\n  {$category}:");
            foreach ($items as $tax) {
                $value = $tax->type === 'percentage' ? "{$tax->value}%" : "R$ {$tax->value}";
                $providerLabel = $tax->provider ?: 'todos';
                $active = $tax->active ? '✓' : '✗';
                $this->line("    {$active} {$tax->name} ({$value}) - provider: {$providerLabel}");
            }
        }

        $this->newLine();
    }

    /**
     * Mostrar custos calculados de um pedido
     */
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
                    $this->line("    • {$item['name']}: R$ {$item['calculated_value']}");
                }
            }
        }

        $this->line("  💰 Total custos: R$ {$order->total_costs}");
        $this->line("  💰 Total comissões: R$ {$order->total_commissions}");
        $this->line("  💵 Receita líquida: R$ {$order->net_revenue}");
    }
}
