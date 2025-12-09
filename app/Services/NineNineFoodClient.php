<?php

namespace App\Services;

use App\Models\OauthToken;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;

class NineNineFoodClient
{
    protected OauthToken $token;

    public function __construct(protected int $tenantId, protected int $storeId)
    {
        $this->token = OauthToken::where('tenant_id', $tenantId)
            ->where('store_id', $storeId)
            ->where('provider', '99food')
            ->firstOrFail();
    }

    protected function refreshTokenIfNeeded(): void
    {
        if (! $this->token->expires_at || Carbon::now()->greaterThan($this->token->expires_at)) {
            try {
                $url = rtrim(config('services.99food.base_url'), '/');

                // TODO: Ajustar endpoint e parâmetros conforme documentação oficial do 99Food
                $response = Http::asForm()->post($url.'/oauth/token', [
                    'grant_type' => 'refresh_token',
                    'client_id' => config('services.99food.client_id'),
                    'client_secret' => config('services.99food.client_secret'),
                    'refresh_token' => $this->token->refresh_token,
                ]);

                if ($response->failed()) {
                    logger()->error('99Food refresh token failed', [
                        'tenant_id' => $this->tenantId,
                        'store_id' => $this->storeId,
                        'status' => $response->status(),
                        'body' => $response->json(),
                    ]);

                    throw new \Exception('Falha ao atualizar token 99Food');
                }

                $data = $response->json();

                // TODO: Ajustar nomes dos campos conforme resposta da API do 99Food
                $this->token->update([
                    'access_token' => $data['access_token'] ?? $data['accessToken'],
                    'refresh_token' => $data['refresh_token'] ?? $data['refreshToken'] ?? $this->token->refresh_token,
                    'expires_at' => now()->addSeconds($data['expires_in'] ?? $data['expiresIn']),
                ]);
            } catch (\Throwable $e) {
                logger()->error('Erro inesperado ao atualizar token 99Food', [
                    'error' => $e->getMessage(),
                ]);
                throw $e;
            }
        }
    }

    public function get(string $endpoint, array $query = [], array $headers = []): array
    {
        $this->refreshTokenIfNeeded();

        $url = rtrim(config('services.99food.base_url'), '/');

        try {
            $httpClient = Http::withToken($this->token->access_token)
                ->acceptJson();

            if (! empty($headers)) {
                $httpClient = $httpClient->withHeaders($headers);
            }

            $response = $httpClient
                ->get($url.'/'.ltrim($endpoint, '/'), $query)
                ->throw();

            return $response->body() !== '' ? $response->json() : [];
        } catch (RequestException $e) {
            logger()->error('99Food GET request failed', [
                'endpoint' => $endpoint,
                'tenant_id' => $this->tenantId,
                'store_id' => $this->storeId,
                'status' => $e->response?->status(),
                'body' => $e->response?->body(),
                'error' => $e->getMessage(),
            ]);

            throw $e;
        }
    }

    public function post(string $endpoint, array $data = [], array $headers = []): ?array
    {
        $this->refreshTokenIfNeeded();

        $url = rtrim(config('services.99food.base_url'), '/');

        try {
            $httpClient = Http::withToken($this->token->access_token)
                ->acceptJson()
                ->asJson();

            if (! empty($headers)) {
                $httpClient = $httpClient->withHeaders($headers);
            }

            $response = $httpClient
                ->post($url.'/'.ltrim($endpoint, '/'), $data)
                ->throw();

            return $response->body() !== '' ? $response->json() : [];
        } catch (RequestException $e) {
            logger()->error('99Food POST request failed', [
                'endpoint' => $endpoint,
                'tenant_id' => $this->tenantId,
                'store_id' => $this->storeId,
                'status' => $e->response?->status(),
                'body' => $e->response?->body(),
                'error' => $e->getMessage(),
            ]);

            throw $e;
        }
    }

    public function put(string $endpoint, array $data = [], array $headers = []): ?array
    {
        $this->refreshTokenIfNeeded();

        $url = rtrim(config('services.99food.base_url'), '/');

        try {
            $httpClient = Http::withToken($this->token->access_token)
                ->acceptJson()
                ->asJson();

            if (! empty($headers)) {
                $httpClient = $httpClient->withHeaders($headers);
            }

            $response = $httpClient
                ->put($url.'/'.ltrim($endpoint, '/'), $data)
                ->throw();

            return $response->body() !== '' ? $response->json() : [];
        } catch (RequestException $e) {
            logger()->error('99Food PUT request failed', [
                'endpoint' => $endpoint,
                'tenant_id' => $this->tenantId,
                'store_id' => $this->storeId,
                'status' => $e->response?->status(),
                'body' => $e->response?->body(),
                'error' => $e->getMessage(),
            ]);

            throw $e;
        }
    }

    public function delete(string $endpoint, array $headers = []): ?array
    {
        $this->refreshTokenIfNeeded();

        $url = rtrim(config('services.99food.base_url'), '/');

        try {
            $httpClient = Http::withToken($this->token->access_token)
                ->acceptJson();

            if (! empty($headers)) {
                $httpClient = $httpClient->withHeaders($headers);
            }

            $response = $httpClient
                ->delete($url.'/'.ltrim($endpoint, '/'))
                ->throw();

            return $response->body() !== '' ? $response->json() : [];
        } catch (RequestException $e) {
            logger()->error('99Food DELETE request failed', [
                'endpoint' => $endpoint,
                'tenant_id' => $this->tenantId,
                'store_id' => $this->storeId,
                'status' => $e->response?->status(),
                'body' => $e->response?->body(),
                'error' => $e->getMessage(),
            ]);

            throw $e;
        }
    }

    // ============================================
    // Métodos facilitadores (a serem implementados conforme API)
    // ============================================

    /**
     * TODO: Implementar métodos específicos do 99Food conforme documentação
     * Exemplos:
     * - getStoreDetails()
     * - getStoreStatus()
     * - confirmOrder()
     * - cancelOrder()
     * - etc.
     */
}
