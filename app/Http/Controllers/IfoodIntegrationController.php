<?php

namespace App\Http\Controllers;

use App\Models\OauthToken;
use App\Models\Store;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class IfoodIntegrationController extends Controller
{
    /**
     * Gera o código de autorização (ou URL) para iniciar a integração iFood.
     */
    public function userCode(Request $request)
    {
        try {
            $clientId = config('services.ifood.client_id');
            $clientSecret = config('services.ifood.client_secret');

            $response = Http::asForm()->post('https://merchant-api.ifood.com.br/authentication/v1.0/oauth/userCode', [
                'clientId' => $clientId,
            ]);

            if ($response->failed()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Erro ao solicitar userCode.',
                    'details' => $response->json(),
                ], 400);
            }

            $data = $response->json();

            return response()->json($data);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erro interno ao gerar userCode.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Troca o código de autorização por access/refresh token.
     */
    public function token(Request $request)
    {
        $request->validate([
            'authorization_code' => 'required|string',
            'code_verifier' => 'required|string',
        ]);

        try {
            $clientId = config('services.ifood.client_id');
            $clientSecret = config('services.ifood.client_secret');

            // Troca o código por tokens
            $response = Http::asForm()->post('https://merchant-api.ifood.com.br/authentication/v1.0/oauth/token', [
                'grantType' => 'authorization_code',
                'clientId' => $clientId,
                'clientSecret' => $clientSecret,
                'authorizationCode' => $request->authorization_code,
                'authorizationCodeVerifier' => $request->code_verifier,

            ]);

            if ($response->failed()) {
                logger()->error('iFood token exchange failed', [
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
            $oauth = OauthToken::updateOrCreate(
                [
                    'tenant_id' => auth()->user()->tenant_id,
                    'provider' => 'ifood',
                ],
                [
                    'access_token' => $tokens['accessToken'],
                    'refresh_token' => $tokens['refreshToken'] ?? null,
                    'expires_at' => now()->addSeconds($tokens['expiresIn']),
                    // 'scopes'        => $tokens['scope'] ?? null,
                ]
            );

            // Chama a API do iFood para buscar dados da loja
            $merchantResponse = Http::withToken($tokens['accessToken'])
                ->get('https://merchant-api.ifood.com.br/merchant/v1.0/merchants');

            $store = null;
            if ($merchantResponse->ok()) {
                $merchant = $merchantResponse->json()[0]; // se tiver mais de uma, pegar todas
                $store = Store::updateOrCreate(
                    [
                        'tenant_id' => auth()->user()->tenant_id,
                        'external_store_id' => $merchant['id'],
                        'provider' => 'ifood',
                    ],
                    [
                        'display_name' => $merchant['name'],
                        'active' => true,
                    ]
                );

                // vincula o token à loja
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

    public function stores()
    {
        $stores = Store::where('tenant_id', auth()->user()->tenant_id)
            ->where('provider', 'ifood')
            ->get();

        return response()->json(['stores' => $stores]);
    }

    public function destroy($id)
    {
        try {
            $store = Store::findOrFail($id);

            // Remove tokens relacionados
            OauthToken::where('store_id', $store->id)
                ->where('provider', 'ifood')
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
