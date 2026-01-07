<?php

namespace App\Jobs;

use App\Models\FinancialEvent;
use App\Models\Store;
use App\Models\SyncCursor;
use App\Services\IfoodClient;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Throwable;

class SyncFinancialJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, SerializesModels;

    public function __construct(public int $tenantId, public int $storeId) {}

    public function handle(): void
    {
        try {
            logger()->info('🚀 Iniciando SyncFinancialJob', [
                'tenant' => $this->tenantId,
                'store' => $this->storeId,
            ]);

            $store = Store::where('tenant_id', $this->tenantId)->findOrFail($this->storeId);
            $client = new IfoodClient($this->tenantId, $this->storeId);

            $cursor = SyncCursor::firstOrCreate([
                'tenant_id' => $this->tenantId,
                'store_id' => $this->storeId,
                'module' => 'financial',
            ]);

            $from = $cursor->last_synced_at
                ? Carbon::parse($cursor->last_synced_at)->subDays(2)
                : now()->subDays(30);

            $to = now();

            $page = 1;
            $hasNext = true;

            while ($hasNext) {
                $params = [
                    'beginDate' => $from->toDateString(),
                    'endDate' => $to->toDateString(),
                    'page' => $page,
                    'size' => 100,
                ];

                $data = $client->get("financial/v3.0/merchants/{$store->external_id}/financial-events", $params);

                $events = $data['financialEvents'] ?? [];
                logger()->info('📊 Eventos financeiros recebidos', [
                    'tenant_id' => $this->tenantId,
                    'store_id' => $this->storeId,
                    'page' => $page,
                    'qtd' => count($events),
                ]);

                DB::transaction(function () use ($events) {
                    foreach ($events as $ev) {
                        FinancialEvent::updateOrCreate(
                            [
                                'tenant_id' => $this->tenantId,
                                'store_id' => $this->storeId,
                                'event_id' => $ev['id'] ?? data_get($ev, 'reference.id'),
                            ],
                            [
                                'provider' => $ev['product'] ?? 'IFOOD',
                                'order_uuid' => data_get($ev, 'reference.id'),
                                'type' => $ev['name'] ?? null,
                                'has_transfer_impact' => (bool) ($ev['hasTransferImpact'] ?? false),
                                'amount' => data_get($ev, 'amount.value', 0),
                                'currency' => data_get($ev, 'amount.currency', 'BRL'),
                                'occurred_at' => data_get($ev, 'reference.date')
                                    ? Carbon::parse($ev['reference.date'])
                                    : null,
                                'raw' => $ev, // guarda o JSON inteiro
                            ]
                        );
                    }
                });

                $hasNext = $data['hasNextPage'] ?? false;
                $page++;
            }

            $cursor->update(['last_synced_at' => now()]);

            logger()->info('✅ SyncFinancialJob concluído', [
                'tenant_id' => $this->tenantId,
                'store_id' => $this->storeId,
            ]);
        } catch (Throwable $e) {
            logger()->error('❌ Erro fatal na sync financeira iFood', [
                'tenant_id' => $this->tenantId,
                'store_id' => $this->storeId,
                'error' => $e->getMessage(),
            ]);
            throw $e;
        }
    }
}
