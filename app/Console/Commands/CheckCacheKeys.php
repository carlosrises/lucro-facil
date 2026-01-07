<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class CheckCacheKeys extends Command
{
    protected $signature = 'cache:check-recalculation';
    protected $description = 'Check recalculation cache keys';

    public function handle()
    {
        $this->info('=== Verificando Cache de Recalculação ===');
        $this->newLine();

        // Obter o prefixo do cache
        $prefix = config('cache.prefix');
        $this->info("Prefixo do cache: {$prefix}");
        $this->newLine();

        // Buscar todas as chaves que começam com recalculate_progress (com prefixo)
        $pattern = $prefix . 'recalculate_progress_%';
        $keys = DB::table('cache')
            ->where('key', 'like', $pattern)
            ->get(['key', 'value', 'expiration']);

        if ($keys->isEmpty()) {
            $this->warn('Nenhuma chave de recalculação encontrada no cache');
            $this->info("Padrão buscado: {$pattern}");

            // Mostrar todas as chaves disponíveis para debug
            $allKeys = DB::table('cache')->limit(10)->pluck('key');
            if ($allKeys->isNotEmpty()) {
                $this->newLine();
                $this->info('Chaves encontradas no cache (primeiras 10):');
                foreach ($allKeys as $key) {
                    $this->line("  - {$key}");
                }
            }

            return 0;
        }

        $this->info("Encontradas {$keys->count()} chaves:");
        $this->newLine();

        foreach ($keys as $cacheEntry) {
            // Remover o prefixo para exibição
            $displayKey = str_replace($prefix, '', $cacheEntry->key);
            $this->info("Key: {$displayKey}");

            // Decodificar o valor (Laravel database driver usa serialize direto)
            try {
                $value = unserialize($cacheEntry->value);

                $this->line("Status: " . ($value['status'] ?? 'N/A'));
                $this->line("Total: " . ($value['total'] ?? 0));
                $this->line("Processed: " . ($value['processed'] ?? 0));
                $this->line("Percentage: " . ($value['percentage'] ?? 0) . "%");
                $this->line("Expires: " . date('Y-m-d H:i:s', $cacheEntry->expiration));
            } catch (\Exception $e) {
                $this->error("Erro ao decodificar: " . $e->getMessage());
            }

            $this->newLine();
        }

        return 0;
    }
}
