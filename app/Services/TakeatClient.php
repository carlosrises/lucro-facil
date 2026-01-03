<?php

namespace App\Services;

use App\Models\Store;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;

class TakeatClient
{
    protected Store $store;
    protected ?string $token;

    public function __construct(protected int $tenantId, protected int $storeId)
    {
        $this->store = Store::where('tenant_id', $tenantId)
            ->where('id', $storeId)
            ->where('provider', 'takeat')
            ->firstOrFail();

        // Buscar token JWT do OauthToken
        $oauthToken = $this->store->oauthToken;

        if (!$oauthToken || $oauthToken->expires_at->isPast()) {
            throw new \Exception('Token Takeat expirado ou não encontrado. Faça login novamente.');
        }

        $this->token = $oauthToken->access_token;
    }

    /**
     * Autentica com email e senha e retorna token + informações do restaurante
     *
     * @throws RequestException
     */
    public static function authenticate(string $email, string $password): array
    {
        $baseUrl = config('services.takeat.base_url');

        logger()->info('🔐 Takeat: Iniciando autenticação', [
            'url' => $baseUrl.'/public/api/sessions',
            'email' => $email,
        ]);

        try {
            $response = Http::acceptJson()
                ->post($baseUrl.'/public/api/sessions', [
                    'email' => $email,
                    'password' => $password,
                ])
                ->throw();

            $data = $response->json();

            logger()->info('✅ Takeat: Autenticação bem-sucedida', [
                'restaurant_id' => $data['restaurant']['id'] ?? null,
                'restaurant_name' => $data['restaurant']['name'] ?? null,
                'fantasy_name' => $data['restaurant']['fantasy_name'] ?? null,
                'token_length' => strlen($data['token'] ?? ''),
            ]);

            return $data;
        } catch (RequestException $e) {
            $errorDetails = [
                'status' => $e->response?->status(),
                'body' => $e->response?->body(),
                'error' => $e->getMessage(),
                'url' => $baseUrl.'/public/api/sessions',
            ];

            logger()->error('❌ Takeat: Falha na autenticação', $errorDetails);

            // Log adicional em canal separado
            \Illuminate\Support\Facades\Log::channel('single')->error('❌ Takeat Auth Failed', $errorDetails);

            throw $e;
        } catch (\Throwable $e) {
            logger()->error('❌ Takeat: Erro inesperado na autenticação', [
                'error_class' => get_class($e),
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            throw $e;
        }
    }    /**
     * GET /api/v1/table-sessions
     * Retorna sessões de comandas/pedidos dentro do intervalo de datas
     *
     * @param string $startDate formato ISO 8601 (ex: 2025-08-06T03:00:00)
     * @param string $endDate formato ISO 8601 (ex: 2025-08-07T03:00:00)
     */
    public function getTableSessions(string $startDate, string $endDate): array
    {
        $baseUrl = config('services.takeat.base_url');

        logger()->info('📦 Takeat: Buscando table_sessions', [
            'tenant_id' => $this->tenantId,
            'store_id' => $this->storeId,
            'store_name' => $this->store->display_name,
            'url' => $baseUrl.'/api/v1/table-sessions',
            'start_date' => $startDate,
            'end_date' => $endDate,
        ]);

        try {
            $response = Http::withToken($this->token)
                ->acceptJson()
                ->get($baseUrl.'/api/v1/table-sessions', [
                    'start_date' => $startDate,
                    'end_date' => $endDate,
                ])
                ->throw();

            $data = $response->json() ?? [];
            $count = count($data);

            logger()->info('✅ Takeat: table_sessions recebidos', [
                'tenant_id' => $this->tenantId,
                'store_id' => $this->storeId,
                'total_sessions' => $count,
                'response_size' => strlen($response->body()),
            ]);

            return $data;
        } catch (RequestException $e) {
            logger()->error('❌ Takeat: Falha ao buscar table_sessions', [
                'tenant_id' => $this->tenantId,
                'store_id' => $this->storeId,
                'status' => $e->response?->status(),
                'body' => $e->response?->body(),
                'error' => $e->getMessage(),
            ]);

            throw $e;
        }
    }

    /**
     * GET /api/v1/payment-methods
     * Retorna métodos de pagamento ativos
     */
    public function getPaymentMethods(): array
    {
        $baseUrl = config('services.takeat.base_url');

        logger()->info('💳 Takeat: Buscando payment_methods', [
            'tenant_id' => $this->tenantId,
            'store_id' => $this->storeId,
            'url' => $baseUrl.'/api/v1/payment-methods',
        ]);

        try {
            $response = Http::withToken($this->token)
                ->acceptJson()
                ->get($baseUrl.'/api/v1/payment-methods')
                ->throw();

            $data = $response->json() ?? [];

            logger()->info('✅ Takeat: payment_methods recebidos', [
                'tenant_id' => $this->tenantId,
                'store_id' => $this->storeId,
                'total_methods' => count($data),
            ]);

            return $data;
        } catch (RequestException $e) {
            logger()->error('❌ Takeat: Falha ao buscar payment_methods', [
                'tenant_id' => $this->tenantId,
                'store_id' => $this->storeId,
                'status' => $e->response?->status(),
                'body' => $e->response?->body(),
                'error' => $e->getMessage(),
            ]);

            throw $e;
        }
    }

    /**
     * GET /api/v1/products
     * Retorna categorias de produtos e seus produtos
     */
    public function getProducts(): array
    {
        $baseUrl = config('services.takeat.base_url');

        logger()->info('🍔 Takeat: Buscando products', [
            'tenant_id' => $this->tenantId,
            'store_id' => $this->storeId,
            'url' => $baseUrl.'/api/v1/products',
        ]);

        try {
            $response = Http::withToken($this->token)
                ->acceptJson()
                ->get($baseUrl.'/api/v1/products')
                ->throw();

            $data = $response->json() ?? [];

            logger()->info('✅ Takeat: products recebidos', [
                'tenant_id' => $this->tenantId,
                'store_id' => $this->storeId,
                'total_categories' => count($data),
            ]);

            return $data;
        } catch (RequestException $e) {
            logger()->error('❌ Takeat: Falha ao buscar products', [
                'tenant_id' => $this->tenantId,
                'store_id' => $this->storeId,
                'status' => $e->response?->status(),
                'body' => $e->response?->body(),
                'error' => $e->getMessage(),
            ]);

            throw $e;
        }
    }

    /**
     * GET /api/v1/complements
     * Retorna categorias de complementos com seus complementos
     */
    public function getComplements(): array
    {
        $baseUrl = config('services.takeat.base_url');

        logger()->info('🧩 Takeat: Buscando complements', [
            'tenant_id' => $this->tenantId,
            'store_id' => $this->storeId,
            'url' => $baseUrl.'/api/v1/complements',
        ]);

        try {
            $response = Http::withToken($this->token)
                ->acceptJson()
                ->get($baseUrl.'/api/v1/complements')
                ->throw();

            $data = $response->json() ?? [];

            logger()->info('✅ Takeat: complements recebidos', [
                'tenant_id' => $this->tenantId,
                'store_id' => $this->storeId,
                'total_categories' => count($data),
            ]);

            return $data;
        } catch (RequestException $e) {
            logger()->error('❌ Takeat: Falha ao buscar complements', [
                'tenant_id' => $this->tenantId,
                'store_id' => $this->storeId,
                'status' => $e->response?->status(),
                'body' => $e->response?->body(),
                'error' => $e->getMessage(),
            ]);

            throw $e;
        }
    }
}
