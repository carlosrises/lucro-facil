<?php

namespace App\Jobs;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Store;
use App\Models\SyncCursor;
use App\Services\IfoodClient;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Throwable;

class SyncOrdersJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(public int $tenantId, public int $storeId) {}

    public function handle(): void
    {
        try {
            logger()->info('🚀 Iniciando SyncOrdersJob', [
                'tenant' => $this->tenantId,
                'store' => $this->storeId,
            ]);

            $store = Store::where('tenant_id', $this->tenantId)->findOrFail($this->storeId);
            $client = new IfoodClient($this->tenantId, $this->storeId);

            logger()->info('🔑 Store encontrada', [
                'store_id' => $store->id,
                'tenant_id' => $store->tenant_id,
            ]);

            $cursor = SyncCursor::firstOrCreate([
                'tenant_id' => $this->tenantId,
                'store_id' => $this->storeId,
                'module' => 'orders',
            ]);

            logger()->info('🔑 Store encontrada', [
                'store_id' => $store->id,
                'tenant_id' => $store->tenant_id,
            ]);

            // Header x-polling-merchants: IDs das lojas separadas por vírgula
            // Inclui apenas lojas que possuem token OAuth válido
            $merchantIds = Store::where('tenant_id', $this->tenantId)
                ->where('provider', 'ifood')
                ->whereHas('oauthToken')
                ->pluck('external_store_id')
                ->filter()
                ->unique()
                ->join(',');

            if (empty($merchantIds)) {
                logger()->warning('⚠️ Nenhuma loja com token OAuth encontrada para polling', [
                    'tenant_id' => $this->tenantId,
                ]);
                return;
            }

            logger()->info('📡 Merchant IDs para polling', [
                'merchant_ids' => $merchantIds,
            ]);

            $events = $client->get('events/v1.0/events:polling', [], [
                'x-polling-merchants' => $merchantIds,
            ]);

            // Se a API retornar lista simples, normaliza
            $eventsList = isset($events['events']) ? $events['events'] : $events;

            if (empty($eventsList)) {
                logger()->info('iFood sync: Nenhum evento encontrado', [
                    'tenant_id' => $this->tenantId,
                    'store_id' => $this->storeId,
                    'raw' => $events, // loga a resposta crua para debug
                ]);

                return;
            }

            logger()->info('📦 Eventos para processar', [
                'tenant_id' => $this->tenantId,
                'store_id' => $this->storeId,
                'qtd' => count($eventsList),
            ]);

            DB::transaction(function () use ($eventsList, $client, $store, $cursor) {
                $last = $cursor->cursor_key;

                foreach ($eventsList as $ev) {
                    $last = $ev['id'] ?? $last;

                    if (empty($ev['orderId'])) {
                        continue;
                    }

                    try {
                        $orderId = $ev['orderId'];
                        $eventCode = $ev['code'] ?? $ev['fullCode'] ?? 'UNKNOWN';
                        $detail = $client->get("order/v1.0/orders/{$orderId}");

                        // Busca pedido existente para detectar mudanças
                        $existingOrder = Order::where('tenant_id', $this->tenantId)
                            ->where('order_uuid', $orderId)
                            ->first();

                        $oldStatus = $existingOrder?->status;

                        // Prioriza fullCode (status completo) sobre code (abreviado)
                        // Se não houver fullCode, usa status ou eventCode como fallback
                        $newStatus = data_get($detail, 'fullCode')
                            ?? data_get($detail, 'status')
                            ?? $eventCode;

                        $order = Order::updateOrCreate(
                            [
                                'tenant_id' => $this->tenantId,
                                'order_uuid' => $orderId,
                            ],
                            [
                                'store_id' => $store->id,
                                'code' => data_get($detail, 'displayId'),
                                'status' => $newStatus,
                                'origin' => data_get($detail, 'origin'),
                                'gross_total' => data_get($detail, 'total.price', 0),
                                'discount_total' => data_get($detail, 'total.discounts', 0),
                                'delivery_fee' => data_get($detail, 'total.deliveryFee', 0),
                                'tip' => data_get($detail, 'total.tip', 0),
                                'placed_at' => optional(Carbon::parse(data_get($detail, 'createdAt')))->toDateTimeString(),
                                'raw' => $detail,
                            ]
                        );

                        // Log de mudanças de status (Critérios 12-13)
                        if ($existingOrder && $oldStatus !== $newStatus) {
                            logger()->info('🔄 Status do pedido atualizado', [
                                'tenant_id' => $this->tenantId,
                                'order_id' => $order->id,
                                'order_code' => $order->code,
                                'old_status' => $oldStatus,
                                'new_status' => $newStatus,
                                'event_code' => $eventCode,
                                'cancelled_by_customer' => in_array($newStatus, ['CANCELLED', 'CANCELLATION_REQUESTED']),
                            ]);

                            // Eventos específicos de cancelamento
                            if (in_array($newStatus, ['CANCELLED', 'CANCELLATION_REQUESTED'])) {
                                logger()->warning('⚠️ Pedido cancelado externamente', [
                                    'order_code' => $order->code,
                                    'old_status' => $oldStatus,
                                    'cancellation_reason' => data_get($detail, 'cancellationReason'),
                                ]);
                            }

                            // Dispara evento para broadcasting (Critério 13)
                            event(new \App\Events\OrderStatusChanged(
                                $order,
                                $oldStatus,
                                $newStatus,
                                in_array($newStatus, ['CANCELLED', 'CANCELLATION_REQUESTED'])
                            ));
                        }

                        // Substitui itens
                        $order->items()->delete();
                        foreach (data_get($detail, 'items', []) as $it) {
                            OrderItem::create([
                                'tenant_id' => $this->tenantId,
                                'order_id' => $order->id,
                                'sku' => data_get($it, 'externalCode'),
                                'name' => data_get($it, 'name'),
                                'qty' => (int) data_get($it, 'quantity', 1),
                                'unit_price' => (float) data_get($it, 'unitPrice', 0),
                                'total' => (float) data_get($it, 'totalPrice', 0),
                                'add_ons' => data_get($it, 'additions', []),
                                'observations' => data_get($it, 'observations'),
                            ]);
                        }
                    } catch (Throwable $e) {
                        logger()->error('Erro ao processar pedido iFood', [
                            'tenant_id' => $this->tenantId,
                            'store_id' => $this->storeId,
                            'event' => $ev,
                            'error' => $e->getMessage(),
                        ]);

                        continue; // não interrompe a sync
                    }
                }

                if ($last) {
                    $cursor->update([
                        'cursor_key' => $last,
                        'last_synced_at' => now(),
                    ]);
                }
            });

            $ackPayload = collect($eventsList)->pluck('id')->map(fn ($id) => ['id' => $id])->values()->all();
            try {
                $client->post('events/v1.0/events/acknowledgment', $ackPayload);
                logger()->info('✅ ACK enviado para eventos', [
                    'tenant_id' => $this->tenantId,
                    'store_id' => $this->storeId,
                    'event_ids' => collect($eventsList)->pluck('id'),
                ]);

            } catch (\Throwable $e) {
                logger()->error('❌ Falha ao enviar ACK de eventos iFood', [
                    'tenant_id' => $this->tenantId,
                    'store_id' => $this->storeId,
                    'error' => $e->getMessage(),
                    'payload' => $ackPayload,
                ]);
            }

            logger()->info('iFood sync concluída', [
                'tenant_id' => $this->tenantId,
                'store_id' => $this->storeId,
                'events' => count($eventsList),
            ]);
        } catch (Throwable $e) {
            logger()->error('Erro fatal na sync de pedidos iFood', [
                'tenant_id' => $this->tenantId,
                'store_id' => $this->storeId,
                'error' => $e->getMessage(),
            ]);
            throw $e; // deixa o Laravel reprocessar se configurado
        }
    }
}
