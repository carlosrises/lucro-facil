<?php

namespace App\Jobs;

use App\Models\OauthToken;
use App\Models\Store;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

class RefreshTakeatTokensJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * Executa a renovação automática dos tokens Takeat próximos da expiração.
     * Tenta reconectar usando as credenciais salvas (criptografadas).
     * Se não houver credenciais ou a reconexão falhar, loga aviso para ação manual.
     */
    public function handle(): void
    {
        try {
            Log::info('🚦 Iniciando RefreshTakeatTokensJob - Verificação de tokens expirando');

            // Busca tokens Takeat expirando em menos de 72h (3 dias)
            $tokens = OauthToken::where('provider', 'takeat')
                ->whereNotNull('expires_at')
                ->where('expires_at', '>', now())
                ->where('expires_at', '<', now()->addHours(72))
                ->with('store')
                ->get();

            if ($tokens->isEmpty()) {
                Log::info('✅ Nenhum token Takeat próximo da expiração');
                return;
            }

            Log::info("📊 Encontrados {$tokens->count()} token(s) Takeat para processar");

            foreach ($tokens as $token) {
                try {
                    $store = $token->store;

                    if (!$store) {
                        Log::warning('⚠️ Loja não encontrada para token', ['token_id' => $token->id]);
                        continue;
                    }

                    // Verificar se possui credenciais salvas para reconexão automática
                    if (!$token->hasCredentials()) {
                        Log::warning('⚠️ Token Takeat expirando em breve - RECONEXÃO MANUAL NECESSÁRIA', [
                            'store_id' => $store->id,
                            'store_name' => $store->display_name,
                            'expires_at' => $token->expires_at,
                            'reason' => 'Credenciais não salvas',
                        ]);
                        continue;
                    }

                    Log::info('🔄 Tentando reconexão automática Takeat', [
                        'store_id' => $store->id,
                        'store_name' => $store->display_name,
                        'username' => $token->username,
                    ]);

                    // Tentar reconexão automática usando credenciais salvas
                    $response = Http::post('https://api.takeat.com.br/api/auth/login', [
                        'email' => $token->username,
                        'password' => $token->getPassword(),
                    ]);

                    if (!$response->successful()) {
                        Log::error('❌ Falha na reconexão automática Takeat', [
                            'store_id' => $store->id,
                            'store_name' => $store->display_name,
                            'status' => $response->status(),
                            'error' => $response->json('message') ?? 'Erro desconhecido',
                        ]);
                        continue;
                    }

                    $authData = $response->json();
                    $newToken = $authData['token'] ?? null;

                    if (!$newToken) {
                        Log::error('❌ Token não retornado na reconexão Takeat', [
                            'store_id' => $store->id,
                        ]);
                        continue;
                    }

                    // Atualizar token com novo valor
                    $token->update([
                        'access_token' => $newToken,
                        'expires_at' => now()->addDays(15),
                    ]);

                    Log::info('✅ Reconexão automática Takeat bem-sucedida', [
                        'store_id' => $store->id,
                        'store_name' => $store->display_name,
                        'new_expires_at' => $token->expires_at->toIso8601String(),
                    ]);

                } catch (Throwable $e) {
                    Log::error('❌ Falha ao processar token Takeat', [
                        'store_id' => $token->store_id,
                        'error' => $e->getMessage(),
                        'trace' => $e->getTraceAsString(),
                    ]);
                }
            }

            Log::info('✅ RefreshTakeatTokensJob concluído');
        } catch (Throwable $e) {
            Log::error('❌ Erro geral no RefreshTakeatTokensJob', [
                'error' => $e->getMessage(),
            ]);
            throw $e;
        }
    }
}
