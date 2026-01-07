<?php

namespace App\Jobs;

use App\Models\Store;
use App\Services\IfoodClient;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Throwable;

class SyncMerchantJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * Create a new job instance.
     */
    public function __construct(public int $tenantId, public int $storeId)
    {
        //
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        try {
            logger()->info('🚀 Iniciando SyncMerchantJob', [
                'tenant_id' => $this->tenantId,
                'store_id' => $this->storeId,
            ]);

            $store = Store::where('tenant_id', $this->tenantId)->findOrFail($this->storeId);
            $client = new IfoodClient($this->tenantId, $this->storeId);

            $merchant = $client->get("merchant/v1.0/merchants/{$store->external_store_id}");

            if (! $merchant) {
                logger()->warning('⚠️ Nenhum dado retornado para merchant', [
                    'tenant_id' => $this->tenantId,
                    'store_id' => $this->storeId,
                ]);

                return;
            }

            $store->update([
                'display_name' => $merchant['name'] ?? $store->display_name,
                'status' => $merchant['status'] ?? null,
                'raw' => $merchant, // mantém dump completo
            ]);

            logger()->info('✅ Merchant atualizado com sucesso', [
                'tenant_id' => $this->tenantId,
                'store_id' => $this->storeId,
                'status' => $merchant['status'] ?? null,
            ]);
        } catch (Throwable $e) {
            logger()->error('❌ Erro ao sincronizar merchant iFood', [
                'tenant_id' => $this->tenantId,
                'store_id' => $this->storeId,
                'error' => $e->getMessage(),
            ]);
            throw $e;
        }
    }
}
