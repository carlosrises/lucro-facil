<?php

namespace App\Services;

use App\Models\OauthToken;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;

class IfoodClient
{
    protected OauthToken $token;

    public function __construct(protected int $tenantId, protected int $storeId)
    {
        $this->token = OauthToken::where('tenant_id', $tenantId)
            ->where('store_id', $storeId)
            ->where('provider', 'ifood')
            ->firstOrFail();
    }

    protected function refreshTokenIfNeeded(): void
    {
        if (! $this->token->expires_at || Carbon::now()->greaterThan($this->token->expires_at)) {
            try {
                $url = rtrim(config('services.ifood.base_url'), '/');

                $response = Http::asForm()->post($url.'/authentication/v1.0/oauth/token', [
                    'grantType' => 'refresh_token',
                    'clientId' => config('services.ifood.client_id'),
                    'clientSecret' => config('services.ifood.client_secret'),
                    'refreshToken' => $this->token->refresh_token,
                ]);

                if ($response->failed()) {
                    logger()->error('iFood refresh token failed', [
                        'tenant_id' => $this->tenantId,
                        'store_id' => $this->storeId,
                        'status' => $response->status(),
                        'body' => $response->json(),
                    ]);

                    throw new \Exception('Falha ao atualizar token iFood');
                }

                $data = $response->json();

                $this->token->update([
                    'access_token' => $data['accessToken'],
                    'refresh_token' => $data['refreshYoken'] ?? $this->token->refresh_token,
                    'expires_at' => now()->addSeconds($data['expiresIn']),
                ]);
            } catch (\Throwable $e) {
                logger()->error('Erro inesperado ao atualizar token iFood', [
                    'error' => $e->getMessage(),
                ]);
                throw $e;
            }
        }
    }

    public function get(string $endpoint, array $query = [], array $headers = []): array
    {
        $this->refreshTokenIfNeeded();

        $url = rtrim(config('services.ifood.base_url'), '/');

        try {
            $httpClient = Http::withToken($this->token->access_token)
                ->acceptJson();

            // Aplica headers customizados se fornecidos
            if (! empty($headers)) {
                $httpClient = $httpClient->withHeaders($headers);
            }

            $response = $httpClient
                ->get($url.'/'.ltrim($endpoint, '/'), $query)
                ->throw();

            // Garante retorno de array mesmo quando não há conteúdo
            return $response->body() !== '' ? $response->json() : [];
        } catch (RequestException $e) {
            logger()->error('iFood GET request failed', [
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

        $url = rtrim(config('services.ifood.base_url'), '/');

        try {
            $httpClient = Http::withToken($this->token->access_token)
                ->acceptJson()
                ->asJson();

            // Aplica headers customizados se fornecidos
            if (! empty($headers)) {
                $httpClient = $httpClient->withHeaders($headers);
            }

            $response = $httpClient
                ->post($url.'/'.ltrim($endpoint, '/'), $data)
                ->throw();

            // Se não houver corpo JSON (204 No Content), retorna array vazio
            return $response->body() !== '' ? $response->json() : [];
        } catch (RequestException $e) {
            logger()->error('iFood POST request failed', [
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

        $url = rtrim(config('services.ifood.base_url'), '/');

        try {
            $httpClient = Http::withToken($this->token->access_token)
                ->acceptJson()
                ->asJson();

            // Aplica headers customizados se fornecidos
            if (! empty($headers)) {
                $httpClient = $httpClient->withHeaders($headers);
            }

            $response = $httpClient
                ->put($url.'/'.ltrim($endpoint, '/'), $data)
                ->throw();

            // Se não houver corpo JSON (204 No Content), retorna array vazio
            return $response->body() !== '' ? $response->json() : [];
        } catch (RequestException $e) {
            logger()->error('iFood PUT request failed', [
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

        $url = rtrim(config('services.ifood.base_url'), '/');

        try {
            $httpClient = Http::withToken($this->token->access_token)
                ->acceptJson();

            // Aplica headers customizados se fornecidos
            if (! empty($headers)) {
                $httpClient = $httpClient->withHeaders($headers);
            }

            $response = $httpClient
                ->delete($url.'/'.ltrim($endpoint, '/'))
                ->throw();

            // Se não houver corpo JSON (204 No Content), retorna array vazio
            return $response->body() !== '' ? $response->json() : [];
        } catch (RequestException $e) {
            logger()->error('iFood DELETE request failed', [
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
    // Métodos facilitadores para API Merchant
    // ============================================

    /**
     * GET /merchants/{merchantId}
     * Retorna detalhes de um merchant específico
     */
    public function getMerchantDetails(string $merchantId): array
    {
        return $this->get("merchant/v1.0/merchants/{$merchantId}");
    }

    /**
     * GET /merchants/{merchantId}/status
     * Retorna status de um merchant específico
     */
    public function getMerchantStatus(string $merchantId): array
    {
        return $this->get("merchant/v1.0/merchants/{$merchantId}/status");
    }

    /**
     * POST /merchants/{merchantId}/interruptions
     * Cria uma nova interrupção para o merchant
     */
    public function createInterruption(string $merchantId, array $data): array
    {
        return $this->post("merchant/v1.0/merchants/{$merchantId}/interruptions", $data);
    }

    /**
     * GET /merchants/{merchantId}/interruptions
     * Lista todas as interrupções do merchant
     */
    public function getInterruptions(string $merchantId): array
    {
        return $this->get("merchant/v1.0/merchants/{$merchantId}/interruptions");
    }

    /**
     * DELETE /merchants/{merchantId}/interruptions/{interruptionId}
     * Remove uma interrupção específica
     */
    public function deleteInterruption(string $merchantId, string $interruptionId): ?array
    {
        return $this->delete("merchant/v1.0/merchants/{$merchantId}/interruptions/{$interruptionId}");
    }

    /**
     * GET /merchants/{merchantId}/opening-hours
     * Lista horários de funcionamento do merchant
     */
    public function getOpeningHours(string $merchantId): array
    {
        return $this->get("merchant/v1.0/merchants/{$merchantId}/opening-hours");
    }

    /**
     * PUT /merchants/{merchantId}/opening-hours
     * Atualiza horários de funcionamento do merchant
     */
    public function updateOpeningHours(string $merchantId, array $data): ?array
    {
        return $this->put("merchant/v1.0/merchants/{$merchantId}/opening-hours", $data);
    }

    // ============================================
    // Métodos facilitadores para API Order
    // ============================================

    /**
     * POST /orders/{orderId}/confirm
     * Confirma um pedido
     */
    public function confirmOrder(string $orderId): ?array
    {
        return $this->post("order/v1.0/orders/{$orderId}/confirm");
    }

    /**
     * POST /orders/{orderId}/dispatch
     * Despacha um pedido (inicia entrega)
     */
    public function dispatchOrder(string $orderId): ?array
    {
        return $this->post("order/v1.0/orders/{$orderId}/dispatch");
    }

    /**
     * POST /orders/{orderId}/readyToPickup
     * Marca pedido TAKEOUT como pronto para retirada
     */
    public function readyToPickup(string $orderId): ?array
    {
        return $this->post("order/v1.0/orders/{$orderId}/readyToPickup");
    }

    /**
     * GET /orders/{orderId}/cancellationReasons
     * Lista motivos de cancelamento disponíveis para o pedido
     */
    public function getCancellationReasons(string $orderId): array
    {
        return $this->get("order/v1.0/orders/{$orderId}/cancellationReasons");
    }

    /**
     * POST /orders/{orderId}/requestCancellation
     * Cancela um pedido com motivo específico
     */
    public function cancelOrder(string $orderId, string $cancellationCode): ?array
    {
        // Busca a descrição do motivo primeiro
        $reasons = $this->getCancellationReasons($orderId);
        $reason = collect($reasons)->firstWhere('cancelCodeId', $cancellationCode);

        return $this->post("order/v1.0/orders/{$orderId}/requestCancellation", [
            'reason' => $reason['description'] ?? 'Cancelamento solicitado',
            'cancellationCode' => $cancellationCode,
        ]);
    }
}
