<?php

namespace App\Console\Commands;

use App\Models\Order;
use Carbon\Carbon;
use Illuminate\Console\Command;

class FixTakeatOrderTimezones extends Command
{
    protected $signature = 'orders:fix-takeat-timezones
                            {--tenant-id= : ID do tenant específico}
                            {--dry-run : Simula sem salvar no banco}';

    protected $description = 'Corrige timezone dos pedidos Takeat que foram salvos com 3h de diferença';

    public function handle(): int
    {
        $tenantId = $this->option('tenant-id');
        $isDryRun = $this->option('dry-run');

        if ($isDryRun) {
            $this->warn('🔍 Modo DRY-RUN ativado - Nenhuma alteração será salva');
        }

        // Contar total de pedidos a corrigir
        $query = Order::where('provider', 'takeat')
            ->whereRaw('TIME(placed_at) >= "00:00:00"')
            ->whereRaw('TIME(placed_at) < "03:00:00"');

        if ($tenantId) {
            $query->where('tenant_id', $tenantId);
        }

        $totalOrders = $query->count();

        $this->info("📦 Encontrados {$totalOrders} pedidos Takeat entre 00:00 e 02:59");

        if ($totalOrders === 0) {
            $this->info('✅ Nenhum pedido para corrigir!');
            return self::SUCCESS;
        }

        $fixed = 0;
        $errors = 0;
        $showDetails = $totalOrders <= 50; // Mostrar detalhes apenas se forem poucos pedidos

        // Processar em lotes de 100 para não estourar memória
        Order::where('provider', 'takeat')
            ->whereRaw('TIME(placed_at) >= "00:00:00"')
            ->whereRaw('TIME(placed_at) < "03:00:00"')
            ->when($tenantId, fn($q) => $q->where('tenant_id', $tenantId))
            ->select(['id', 'code', 'placed_at']) // Carregar apenas campos necessários
            ->chunk(100, function ($orders) use (&$fixed, &$errors, $isDryRun, $showDetails) {
                foreach ($orders as $order) {
                    try {
                        $oldDate = $order->placed_at;
                        
                        // Subtrair 3 horas
                        $newDate = Carbon::parse($oldDate)->subHours(3);

                        if ($showDetails) {
                            $this->line('');
                            $this->info("📦 Pedido #{$order->id} - {$order->code}");
                            $this->line("   ⏰ Data atual: {$oldDate->format('d/m/Y H:i:s')}");
                            $this->line("   ✅ Data corrigida: {$newDate->format('d/m/Y H:i:s')}");
                        }

                        if (!$isDryRun) {
                            $order->placed_at = $newDate;
                            $order->save();
                            if ($showDetails) {
                                $this->info('   ✅ Corrigido!');
                            }
                            $fixed++;
                        } else {
                            if ($showDetails) {
                                $this->comment('   🔍 Seria corrigido (dry-run)');
                            }
                            $fixed++;
                        }
                    } catch (\Exception $e) {
                        $this->error("   ❌ Erro ao corrigir pedido #{$order->id}: {$e->getMessage()}");
                        $errors++;
                    }
                }

                // Mostrar progresso a cada lote se houver muitos pedidos
                if (!$showDetails) {
                    $this->info("   Processados: {$fixed}...");
                }
            });

        $this->line('');
        $this->info('═══════════════════════════════════════');
        $this->info("📊 Total analisado: {$totalOrders} pedidos");
        $this->info('🔧 '.($isDryRun ? 'Seriam corrigidos' : 'Corrigidos').": {$fixed}");

        if ($errors > 0) {
            $this->error("❌ Erros: {$errors}");
        }

        $this->info('═══════════════════════════════════════');

        if ($isDryRun) {
            $this->warn('🔍 DRY-RUN: Nenhuma alteração foi salva. Execute sem --dry-run para aplicar.');
        }

        return self::SUCCESS;
    }
}
