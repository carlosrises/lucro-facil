<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class RecalculationStatusController extends Controller
{
    /**
     * Verifica se há recálculos ativos para o tenant do usuário
     */
    public function check(Request $request)
    {
        $tenantId = $request->user()->tenant_id;

        // Buscar todas as chaves de progresso do tenant
        // Formato: recalculate_progress_{tenant}_cost_commission_{id}
        $cacheKeys = $this->getCacheKeysForTenant($tenantId);

        $activeRecalculations = [];
        $seenKeys = []; // Para rastrear tipo+id únicos

        foreach ($cacheKeys as $key) {
            // Obter valor usando Cache::get() que já faz o unserialize automaticamente
            // Remove o prefixo antes de buscar com Cache::get()
            $prefix = config('cache.prefix');
            $keyWithoutPrefix = str_replace($prefix, '', $key);

            $progress = Cache::get($keyWithoutPrefix);

            if ($progress && isset($progress['status'])) {
                // Extrair tipo e ID da chave (usando key sem prefixo)
                preg_match('/recalculate_progress_\d+_(.+)_(\d+)$/', $keyWithoutPrefix, $matches);
                $type = $matches[1] ?? 'unknown';
                $referenceId = $matches[2] ?? null;

                $uniqueKey = "{$type}_{$referenceId}";

                // Se está completado há mais de 30 segundos, pular
                if ($progress['status'] === 'completed' && isset($progress['completed_at'])) {
                    $completedAt = \Carbon\Carbon::parse($progress['completed_at']);
                    if ($completedAt->diffInSeconds(now()) > 30) {
                        continue;
                    }
                }

                // Se já vimos esse tipo+id, comparar timestamps para pegar o mais recente
                if (isset($seenKeys[$uniqueKey])) {
                    $existingStartedAt = \Carbon\Carbon::parse($seenKeys[$uniqueKey]['started_at']);
                    $newStartedAt = \Carbon\Carbon::parse($progress['started_at'] ?? now());

                    // Se o novo é mais recente, substituir
                    if ($newStartedAt->greaterThan($existingStartedAt)) {
                        // Remover o antigo
                        $activeRecalculations = array_filter($activeRecalculations, function($item) use ($uniqueKey) {
                            return "{$item['type']}_{$item['reference_id']}" !== $uniqueKey;
                        });

                        // Adicionar o novo
                        $recalculation = [
                            'type' => $type,
                            'reference_id' => $referenceId,
                            'status' => $progress['status'],
                            'percentage' => $progress['percentage'] ?? 0,
                            'total' => $progress['total'] ?? 0,
                            'processed' => $progress['processed'] ?? 0,
                            'started_at' => $progress['started_at'] ?? null,
                            'completed_at' => $progress['completed_at'] ?? null,
                        ];

                        $activeRecalculations[] = $recalculation;
                        $seenKeys[$uniqueKey] = $recalculation;
                    }
                } else {
                    // Primeira vez vendo esse tipo+id
                    $recalculation = [
                        'type' => $type,
                        'reference_id' => $referenceId,
                        'status' => $progress['status'],
                        'percentage' => $progress['percentage'] ?? 0,
                        'total' => $progress['total'] ?? 0,
                        'processed' => $progress['processed'] ?? 0,
                        'started_at' => $progress['started_at'] ?? null,
                        'completed_at' => $progress['completed_at'] ?? null,
                    ];

                    $activeRecalculations[] = $recalculation;
                    $seenKeys[$uniqueKey] = $recalculation;
                }
            }
        }

        // Ordenar por started_at DESC (mais recente primeiro)
        usort($activeRecalculations, function($a, $b) {
            $aTime = strtotime($a['started_at'] ?? '1970-01-01');
            $bTime = strtotime($b['started_at'] ?? '1970-01-01');
            return $bTime - $aTime;
        });

        return response()->json([
            'has_active' => count($activeRecalculations) > 0,
            'recalculations' => $activeRecalculations,
        ]);
    }

    /**
     * Busca todas as chaves de cache de progresso para um tenant
     */
    private function getCacheKeysForTenant(int $tenantId): array
    {
        // Obter o prefixo do cache
        $prefix = config('cache.prefix');

        // Buscar padrões possíveis (com prefixo)
        $patterns = [
            "{$prefix}recalculate_progress_{$tenantId}_cost_commission_%",
            "{$prefix}recalculate_progress_{$tenantId}_product_%",
        ];

        $keys = [];

        foreach ($patterns as $pattern) {
            // Buscar direto no banco de dados do cache
            $cacheKeys = \DB::table(config('cache.stores.database.table', 'cache'))
                ->where('key', 'like', $pattern)
                ->pluck('key')
                ->toArray();

            $keys = array_merge($keys, $cacheKeys);
        }

        return $keys;
    }
}
