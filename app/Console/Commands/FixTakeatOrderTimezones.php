<?php

namespace App\Console\Commands;

use App\Models\Order;
use Carbon\Carbon;
use Illuminate\Console\Command;

class FixTakeatOrderTimezones extends Command
{
    protected $signature = 'orders:fix-takeat-timezones
                            {--tenant-id= : ID do tenant específico}
                            {--date= : Data específica para corrigir (Y-m-d)}
                            {--all : Corrigir TODOS os pedidos Takeat}
                            {--dry-run : Simula sem salvar no banco}
                            {--debug : Mostrar detalhes dos primeiros 10 pedidos}';

    protected $description = 'Corrige timezone dos pedidos Takeat comparando placed_at com raw.basket.start_time';

    public function handle(): int
    {
        $tenantId = $this->option('tenant-id');
        $isDryRun = $this->option('dry-run');
        $specificDate = $this->option('date');
        $fixAll = $this->option('all');
        $debug = $this->option('debug');

        if ($isDryRun) {
            $this->warn('🔍 Modo DRY-RUN ativado - Nenhuma alteração será salva');
        }

        if ($debug) {
            $this->warn('🐛 Modo DEBUG ativado - Mostrando detalhes dos primeiros 50 pedidos');
        }

        // Montar query base
        $query = Order::where('provider', 'takeat')
            ->whereNotNull('raw');

        if ($tenantId) {
            $query->where('tenant_id', $tenantId);
        }

        // Filtrar por data se especificado
        if ($specificDate && ! $fixAll) {
            try {
                $date = Carbon::parse($specificDate);
                $query->whereDate('placed_at', $date);
                $this->info("📅 Filtrando pedidos de: {$date->format('d/m/Y')}");
            } catch (\Exception $e) {
                $this->error('❌ Data inválida. Use o formato: Y-m-d (ex: 2025-12-08)');

                return self::FAILURE;
            }
        } elseif (! $fixAll) {
            // Se não especificou --all nem --date, usar apenas pedidos recentes (últimos 30 dias)
            $query->where('placed_at', '>=', now()->subDays(30));
            $this->info('📅 Filtrando pedidos dos últimos 30 dias (use --all para todos)');
        }

        $totalOrders = $query->count();

        if ($debug) {
            $this->warn('🐛 Modo DEBUG ativado - Mostrando detalhes dos primeiros 50 pedidos');
        }

        $this->info("📦 Encontrados {$totalOrders} pedidos Takeat para analisar");

        if ($totalOrders === 0) {
            $this->info('✅ Nenhum pedido para analisar!');

            return self::SUCCESS;
        }

        $fixed = 0;
        $skipped = 0;
        $errors = 0;
        $debugCount = 0;
        $showDetails = $totalOrders <= 20 || $debug; // Mostrar detalhes se debug ativo

        // Configurar barra de progresso com formato melhorado
        $bar = $this->output->createProgressBar($totalOrders);
        $bar->setFormat(
            " %current%/%max% [%bar%] %percent:3s%% \n".
            ' ⏱️  %elapsed:6s% | 🔧 Corrigidos: %message%'
        );
        $bar->setMessage('0');

        if (! $showDetails) {
            $bar->start();
        }

        // Processar em lotes de 100 para não estourar memória
        // Ordenar por placed_at DESC para pegar pedidos mais recentes primeiro
        $query->select(['id', 'code', 'placed_at', 'raw'])
            ->orderBy('placed_at', 'desc')
            ->chunk(100, function ($orders) use (&$fixed, &$skipped, &$errors, $isDryRun, $showDetails, $bar, $debug, &$debugCount) {
                foreach ($orders as $order) {
                    // Modo debug: mostrar apenas primeiros 50
                    if ($debug && $debugCount >= 50) {
                        $skipped++;
                        if (! $showDetails) {
                            $bar->advance();
                        }

                        continue;
                    }

                    try {
                        // Extrair start_time do raw
                        $rawStartTime = $order->raw['basket']['start_time']
                            ?? $order->raw['session']['start_time']
                            ?? null;

                        if (! $rawStartTime) {
                            if ($showDetails) {
                                $this->warn("   ⚠️  Pedido #{$order->id}: sem start_time no raw, pulando");
                            }
                            $skipped++;
                            if (! $showDetails) {
                                $bar->advance();
                            }
                            if ($debug) {
                                $debugCount++;
                            }

                            continue;
                        }

                        // Parse do start_time original - Takeat retorna em BRT (America/Sao_Paulo)
                        // Converter para UTC antes de salvar no banco
                        $correctDate = Carbon::parse($rawStartTime, 'America/Sao_Paulo')
                            ->setTimezone('UTC');

                        // IMPORTANTE: Pegar o valor RAW do banco (em UTC) para comparação correta
                        // Se pegarmos $order->placed_at, Laravel converte para timezone da app
                        $currentDateRaw = $order->getAttributes()['placed_at'];
                        $currentDate = Carbon::parse($currentDateRaw, 'UTC');

                        $diffInHours = abs($currentDate->diffInHours($correctDate, false));

                        // Se a diferença for significativa (>= 1 hora), precisa corrigir
                        if ($diffInHours < 1) {
                            if ($showDetails) {
                                $this->line("   ✅ Pedido #{$order->id} já está correto");
                            }
                            $skipped++;
                            if (! $showDetails) {
                                $bar->advance();
                            }
                            if ($debug) {
                                $debugCount++;
                            }

                            continue;
                        }

                        if ($showDetails) {
                            $this->line('');
                            $this->info("📦 Pedido #{$order->id} - {$order->code}");
                            $this->line("   📡 Raw start_time: {$rawStartTime}");
                            $this->line("   ⏰ Data atual (banco UTC): {$currentDate->format('d/m/Y H:i:s')}");
                            $this->line("   📡 Data correta (UTC): {$correctDate->format('d/m/Y H:i:s')}");
                            $this->line("   ⚡ Diferença: {$diffInHours}h");
                            $this->line("   🔍 CurrentRaw: {$currentDateRaw}");
                        }

                        if (! $isDryRun) {
                            $order->placed_at = $correctDate;
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

                        if ($debug) {
                            $debugCount++;
                        }
                    } catch (\Exception $e) {
                        if ($showDetails) {
                            $this->error("   ❌ Erro ao corrigir pedido #{$order->id}: {$e->getMessage()}");
                        }
                        $errors++;
                    }

                    if (! $showDetails) {
                        $bar->setMessage((string) $fixed);
                        $bar->advance();
                    }
                }
            });

        if (! $showDetails) {
            $bar->finish();
            $this->newLine();
        }

        $this->newLine();
        $this->info('═══════════════════════════════════════');
        $this->info("📊 Total analisado: {$totalOrders} pedidos");
        $this->info("✅ Já corretos: {$skipped}");
        $this->info('🔧 '.($isDryRun ? 'Seriam corrigidos' : 'Corrigidos').": {$fixed}");

        if ($errors > 0) {
            $this->error("❌ Erros: {$errors}");
        }

        $this->info('═══════════════════════════════════════');

        if ($isDryRun) {
            $this->warn('🔍 DRY-RUN: Nenhuma alteração foi salva. Execute sem --dry-run para aplicar.');
        } elseif ($fixed > 0) {
            $this->info('✅ Correção aplicada com sucesso!');
        }

        return self::SUCCESS;
    }
}
