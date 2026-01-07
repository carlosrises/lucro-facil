<?php

namespace App\Http\Controllers;

use App\Models\Store;
use App\Services\TakeatClient;
use Illuminate\Http\Request;

class TakeatIntegrationController extends Controller
{
    /**
     * Autentica com Takeat e salva token + informações do restaurante
     */
    public function login(Request $request)
    {
        // Log inicial antes de qualquer processamento
        logger()->info('🚀 Takeat: Requisição de login recebida', [
            'tenant_id' => auth()->user()->tenant_id ?? 'N/A',
            'user_id' => auth()->id() ?? 'N/A',
            'email' => $request->input('email'),
            'has_password' => ! empty($request->input('password')),
        ]);

        $validated = $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        logger()->info('🔐 Takeat: Tentativa de login', [
            'tenant_id' => auth()->user()->tenant_id,
            'user_id' => auth()->id(),
            'email' => $validated['email'],
        ]);

        try {
            $authData = TakeatClient::authenticate(
                $validated['email'],
                $validated['password']
            );

            $restaurantId = (string) $authData['restaurant']['id'];
            $token = $authData['token'];
            $tenantId = auth()->user()->tenant_id;

            // Criar ou atualizar Store usando restaurant.id como identificador único
            $store = Store::updateOrCreate(
                [
                    'tenant_id' => $tenantId,
                    'provider' => 'takeat',
                    'external_store_id' => $restaurantId, // ID do restaurante na Takeat
                ],
                [
                    'display_name' => $authData['restaurant']['fantasy_name'] ?? $authData['restaurant']['name'],
                    'active' => true,
                    'excluded_channels' => [], // Inicialmente vazio
                ]
            );

            // Salvar token JWT no OauthToken (expira em 15 dias)
            $expiresAt = now()->addDays(15);

            $oauthToken = \App\Models\OauthToken::updateOrCreate(
                [
                    'tenant_id' => $tenantId,
                    'store_id' => $store->id,
                    'provider' => 'takeat',
                ],
                [
                    'username' => $validated['email'],
                    'access_token' => $token,
                    'refresh_token' => null, // Takeat não usa refresh token
                    'expires_at' => $expiresAt,
                    'scopes' => null,
                ]
            );

            // Criptografar e salvar a senha para reconexão automática
            $oauthToken->setPassword($validated['password']);
            $oauthToken->save();

            logger()->info('✅ Takeat: Login concluído com sucesso', [
                'tenant_id' => $tenantId,
                'store_id' => $store->id,
                'restaurant_id' => $restaurantId,
                'restaurant_name' => $store->display_name,
                'token_expires_at' => $expiresAt->toIso8601String(),
            ]);

            return response()->json([
                'success' => true,
                'store' => $store,
                'restaurant' => $authData['restaurant'],
            ]);
        } catch (\Throwable $e) {
            // Log detalhado do erro
            $errorData = [
                'tenant_id' => auth()->user()->tenant_id ?? 'N/A',
                'email' => $request->email,
                'error_class' => get_class($e),
                'error_message' => $e->getMessage(),
                'error_code' => $e->getCode(),
                'error_file' => $e->getFile(),
                'error_line' => $e->getLine(),
                'trace' => $e->getTraceAsString(),
            ];

            // Se for RequestException, adicionar resposta HTTP
            if ($e instanceof \Illuminate\Http\Client\RequestException) {
                $errorData['http_status'] = $e->response?->status();
                $errorData['http_body'] = $e->response?->body();
            }

            logger()->error('❌ Takeat: Erro no login', $errorData);

            // Também grava em arquivo separado para garantir
            \Illuminate\Support\Facades\Log::channel('single')->error('❌ Takeat Login Error', $errorData);

            return response()->json([
                'success' => false,
                'message' => 'Erro ao autenticar com Takeat',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Lista todas as lojas Takeat integradas
     */
    public function stores()
    {
        $stores = Store::where('tenant_id', auth()->user()->tenant_id)
            ->where('provider', 'takeat')
            ->get();

        // Adicionar informações de token expirado
        $stores->transform(function ($store) {
            $store->token_expired = $store->hasExpiredToken();
            $store->token_expiring_soon = $store->hasTokenExpiringSoon();

            return $store;
        });

        return response()->json(['stores' => $stores]);
    }

    /**
     * Atualiza os canais excluídos de uma loja Takeat
     */
    public function updateExcludedChannels(Request $request, $id)
    {
        $request->validate([
            'excluded_channels' => 'required|array',
            'excluded_channels.*' => 'string|in:ifood,99food,neemo,keeta,pdv,delivery,totem',
        ]);

        logger()->info('⚙️ Takeat: Atualizando canais excluídos', [
            'tenant_id' => auth()->user()->tenant_id,
            'store_id' => $id,
            'excluded_channels' => $request->excluded_channels,
        ]);

        try {
            $store = Store::where('tenant_id', auth()->user()->tenant_id)
                ->where('provider', 'takeat')
                ->findOrFail($id);

            $store->update([
                'excluded_channels' => $request->excluded_channels,
            ]);

            logger()->info('✅ Takeat: Canais atualizados', [
                'tenant_id' => auth()->user()->tenant_id,
                'store_id' => $id,
                'store_name' => $store->display_name,
                'excluded_channels' => $request->excluded_channels,
            ]);

            return response()->json([
                'success' => true,
                'store' => $store,
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            logger()->warning('⚠️ Takeat: Loja não encontrada ao atualizar canais', [
                'tenant_id' => auth()->user()->tenant_id,
                'store_id' => $id,
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Loja não encontrada.',
            ], 404);
        } catch (\Throwable $e) {
            logger()->error('❌ Takeat: Erro ao atualizar canais', [
                'tenant_id' => auth()->user()->tenant_id,
                'store_id' => $id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Erro ao atualizar canais excluídos.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Remove uma loja Takeat
     */
    public function destroy($id)
    {
        logger()->info('🗑️ Takeat: Tentativa de remover loja', [
            'tenant_id' => auth()->user()->tenant_id,
            'store_id' => $id,
        ]);

        try {
            $store = Store::where('tenant_id', auth()->user()->tenant_id)
                ->where('provider', 'takeat')
                ->findOrFail($id);

            $storeName = $store->display_name;
            $store->delete();

            logger()->info('✅ Takeat: Loja removida', [
                'tenant_id' => auth()->user()->tenant_id,
                'store_id' => $id,
                'store_name' => $storeName,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Loja removida com sucesso.',
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            logger()->warning('⚠️ Takeat: Loja não encontrada ao tentar remover', [
                'tenant_id' => auth()->user()->tenant_id,
                'store_id' => $id,
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Loja não encontrada.',
            ], 404);
        } catch (\Throwable $e) {
            logger()->error('❌ Takeat: Erro ao remover loja', [
                'tenant_id' => auth()->user()->tenant_id,
                'store_id' => $id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Erro ao remover a loja.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }
}
