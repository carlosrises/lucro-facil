<?php

namespace App\Console\Commands;

use App\Jobs\SyncOrdersJob;
use App\Models\Store;
use Illuminate\Console\Command;

class IfoodPollingCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'ifood:polling {--interval=30 : Intervalo em segundos entre cada polling}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Executa polling contínuo de pedidos iFood a cada 30 segundos (homologação)';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $interval = (int) $this->option('interval');

        $this->info("🔄 Iniciando polling iFood (intervalo: {$interval}s)");
        $this->info("Pressione Ctrl+C para parar");
        $this->newLine();

        while (true) {
            $startTime = microtime(true);

            // Busca apenas lojas iFood que possuem token OAuth
            $stores = Store::where('provider', 'ifood')
                ->whereHas('oauthToken')
                ->get();

            if ($stores->isEmpty()) {
                $this->warn('⚠️ Nenhuma loja iFood com token OAuth encontrada');
                sleep($interval);
                continue;
            }

            $this->info("📡 [" . now()->format('H:i:s') . "] Iniciando polling para {$stores->count()} loja(s)...");

            foreach ($stores as $store) {
                try {
                    SyncOrdersJob::dispatchSync($store->tenant_id, $store->id);
                    $this->line("  ✓ Loja {$store->display_name} (ID: {$store->id})");
                } catch (\Throwable $e) {
                    $this->error("  ✗ Erro na loja {$store->id}: {$e->getMessage()}");
                }
            }

            $executionTime = round(microtime(true) - $startTime, 2);
            $this->info("✅ Polling concluído em {$executionTime}s");

            // Calcula o tempo de sleep ajustado
            $sleepTime = max(0, $interval - $executionTime);

            if ($sleepTime > 0) {
                $this->line("💤 Aguardando {$sleepTime}s até próximo polling...");
                $this->newLine();
                sleep((int) $sleepTime);
            } else {
                $this->warn("⚠️ Execução demorou mais que {$interval}s! Iniciando próximo ciclo imediatamente.");
                $this->newLine();
            }
        }

        return self::SUCCESS;
    }
}
