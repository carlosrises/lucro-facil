<?php

namespace App\Jobs;

use App\Models\OauthToken;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Throwable;

class RefreshIfoodTokensJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * Executa a renovação dos tokens iFood próximos da expiração.
     */
    public function handle(): void
    {
        try {
            Log::info('🚦 Iniciando RefreshIfoodTokensJob');

            // Busca todos os tokens iFood ativos
            $tokens = OauthToken::where('provider', 'ifood')
                ->whereNotNull('refresh_token')
                ->get();

            foreach ($tokens as $token) {
                // Verifica se está próximo da expiração (menos de 24h)
                if ($token->expires_at && $token->expires_at->diffInHours(now()) < 24) {
                    try {
                        // Utiliza o service centralizado para renovar o token
                        $client = new \App\Services\IfoodClient($token->tenant_id, $token->store_id);
                        $client->refreshTokenIfNeeded();
                        Log::info('🔄 Token iFood renovado', ['store_id' => $token->store_id]);
                    } catch (Throwable $e) {
                        Log::error('❌ Falha ao renovar token iFood', [
                            'store_id' => $token->store_id,
                            'error' => $e->getMessage(),
                        ]);
                    }
                }
            }

            Log::info('✅ RefreshIfoodTokensJob concluído');
        } catch (Throwable $e) {
            Log::error('❌ Erro geral no RefreshIfoodTokensJob', [
                'error' => $e->getMessage(),
            ]);
            throw $e;
        }
    }
}
