<?php

namespace App\Http\Controllers;

use App\Models\OauthToken;
use App\Models\Store;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class NineNineFoodIntegrationController extends Controller
{
    /**
     * TODO: Implementar conforme documentação oficial do 99Food
     *
     * Gera o código de autorização ou inicia o fluxo OAuth.
     */
    public function userCode(Request $request)
    {
        try {
            $clientId = config('services.99food.client_id');
            $clientSecret = config('services.99food.client_secret');
            $baseUrl = config('services.99food.base_url');

            // TODO: Ajustar endpoint conforme documentação do 99Food
            $response = Http::asForm()->post($baseUrl.'/oauth/authorize', [
                'client_id' => $clientId,
                'response_type' => 'code',
                // Adicionar outros parâmetros conforme necessário
            ]);

            if ($response->failed()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Erro ao solicitar código de autorização.',
                    'details' => $response->json(),
                ], 400);
            }

            $data = $response->json();

            return response()->json($data);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erro interno ao gerar código de autorização.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * TODO: Implementar conforme documentação oficial do 99Food
     *
     * Troca o código de autorização por access/refresh token.
     */
    public function token(Request $request)
    {
        $request->validate([
            'authorization_code' => 'required|string',
            // Adicionar outros campos conforme necessário
        ]);

        try {
            $clientId = config('services.99food.client_id');
            $clientSecret = config('services.99food.client_secret');
            $baseUrl = config('services.99food.base_url');

            // TODO: Ajustar endpoint e parâmetros conforme documentação
            $response = Http::asForm()->post($baseUrl.'/oauth/token', [
                'grant_type' => 'authorization_code',
                'client_id' => $clientId,
                'client_secret' => $clientSecret,
                'code' => $request->authorization_code,
                // Adicionar outros parâmetros conforme necessário
            ]);

            if ($response->failed()) {
                logger()->error('99Food token exchange failed', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                    'json' => $response->json(),
                ]);

                return response()->json([
                    'success' => false,
                    'message' => 'Erro ao obter tokens',
                    'details' => $response->json(),
                    'status_code' => $response->status(),
                ], 400);
            }

            $tokens = $response->json();

            // Salva tokens em `oauth_tokens`
            // TODO: Ajustar nomes dos campos conforme resposta da API
            $oauth = OauthToken::updateOrCreate(
                [
                    'tenant_id' => auth()->user()->tenant_id,
                    'provider' => '99food',
                ],
                [
                    'access_token' => $tokens['access_token'] ?? $tokens['accessToken'],
                    'refresh_token' => $tokens['refresh_token'] ?? $tokens['refreshToken'] ?? null,
                    'expires_at' => now()->addSeconds($tokens['expires_in'] ?? $tokens['expiresIn']),
                ]
            );

            // TODO: Implementar busca de informações da loja conforme API do 99Food
            // Exemplo: GET /stores ou /merchants
            $storeResponse = Http::withToken($tokens['access_token'] ?? $tokens['accessToken'])
                ->get($baseUrl.'/stores'); // Ajustar endpoint

            $store = null;
            if ($storeResponse->ok()) {
                $storeData = $storeResponse->json();

                // TODO: Ajustar conforme estrutura de resposta da API
                $store = Store::updateOrCreate(
                    [
                        'tenant_id' => auth()->user()->tenant_id,
                        'external_store_id' => $storeData['id'] ?? $storeData['store_id'],
                        'provider' => '99food',
                    ],
                    [
                        'display_name' => $storeData['name'] ?? $storeData['store_name'],
                        'active' => true,
                    ]
                );

                // Vincula o token à loja
                $oauth->update(['store_id' => $store->id]);
            }

            return response()->json([
                'success' => true,
                'store' => $store,
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erro ao concluir integração',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Lista todas as lojas do 99Food integradas para o tenant atual.
     */
    public function stores()
    {
        $stores = Store::where('tenant_id', auth()->user()->tenant_id)
            ->where('provider', '99food')
            ->get();

        return response()->json(['stores' => $stores]);
    }

    /**
     * Remove uma loja e seus tokens associados.
     */
    public function destroy($id)
    {
        try {
            $store = Store::findOrFail($id);

            // Remove tokens relacionados
            OauthToken::where('store_id', $store->id)
                ->where('provider', '99food')
                ->delete();

            // Remove a loja
            $store->delete();

            return response()->json([
                'success' => true,
                'message' => 'Loja e tokens removidos com sucesso.',
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Loja não encontrada.',
            ], 404);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erro ao remover a loja.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }
}
