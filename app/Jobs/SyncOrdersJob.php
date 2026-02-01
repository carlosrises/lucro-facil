<?php

namespace App\Jobs;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderItemMapping;
use App\Models\ProductMapping;
use App\Models\Store;
use App\Models\SyncCursor;
use App\Services\FlavorMappingService;
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
            // logger()->info('🚀 Iniciando SyncOrdersJob', [
            //     'tenant' => $this->tenantId,
            //     'store' => $this->storeId,
            // ]);

            $store = Store::where('tenant_id', $this->tenantId)->findOrFail($this->storeId);
            $client = new IfoodClient($this->tenantId, $this->storeId);

            // logger()->info('🔑 Store encontrada', [
            //     'store_id' => $store->id,
            //     'tenant_id' => $store->tenant_id,
            // ]);

            $cursor = SyncCursor::firstOrCreate([
                'tenant_id' => $this->tenantId,
                'store_id' => $this->storeId,
                'module' => 'orders',
            ]);

            // logger()->info('🔑 Store encontrada', [
            //     'store_id' => $store->id,
            //     'tenant_id' => $store->tenant_id,
            // ]);

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

            // logger()->info('📡 Merchant IDs para polling', [
            //     'merchant_ids' => $merchantIds,
            // ]);

            $events = $client->get('events/v1.0/events:polling', [], [
                'x-polling-merchants' => $merchantIds,
            ]);

            // Se a API retornar lista simples, normaliza
            $eventsList = isset($events['events']) ? $events['events'] : $events;

            if (empty($eventsList)) {
                // logger()->info('iFood sync: Nenhum evento encontrado', [
                //     'tenant_id' => $this->tenantId,
                //     'store_id' => $this->storeId,
                //     'raw' => $events, // loga a resposta crua para debug
                // ]);

                return;
            }

            // logger()->info('📦 Eventos para processar', [
            //     'tenant_id' => $this->tenantId,
            //     'store_id' => $this->storeId,
            //     'qtd' => count($eventsList),
            // ]);

            DB::transaction(function () use ($eventsList, $client, $store, $cursor) {
                $last = $cursor->cursor_key;
                $processedOrderIds = [];

                foreach ($eventsList as $ev) {
                    $last = $ev['id'] ?? $last;

                    if (empty($ev['orderId'])) {
                        continue;
                    }

                    $orderId = $ev['orderId'];
                    if (in_array($orderId, $processedOrderIds, true)) {
                        continue; // já processado neste polling
                    }
                    $processedOrderIds[] = $orderId;

                    try {
                        $eventCode = $ev['code'] ?? $ev['fullCode'] ?? 'UNKNOWN';
                        $detail = $client->get("order/v1.0/orders/{$orderId}");

                        // Se for evento HANDSHAKE_DISPUTE, extrai todos os campos relevantes conforme documentação
                        if (in_array($eventCode, ['HSD', 'HANDSHAKE_DISPUTE'])) {
                            $handshakeDispute = [
                                'disputeId' => $ev['id'] ?? $ev['disputeId'] ?? null,
                                'parentDisputeId' => $ev['parentDisputeId'] ?? null,
                                'action' => $ev['action'] ?? null,
                                'message' => $ev['message'] ?? null,
                                'alternatives' => $ev['alternatives'] ?? null,
                                'expiresAt' => $ev['expiresAt'] ?? null,
                                'createdAt' => $ev['createdAt'] ?? null,
                                'handshakeType' => $ev['handshakeType'] ?? null,
                                'handshakeGroup' => $ev['handshakeGroup'] ?? null,
                                'timeoutAction' => $ev['timeoutAction'] ?? null,
                                'items' => $ev['metadata']['items'] ?? null,
                                'garnishItems' => $ev['metadata']['garnishItems'] ?? null,
                                'evidences' => $ev['metadata']['evidences'] ?? null,
                                'acceptCancellationReasons' => $ev['metadata']['acceptCancellationReasons'] ?? null,
                            ];
                            // Remove valores null
                            $handshakeDispute = array_filter($handshakeDispute, fn ($v) => $v !== null);
                            $detail['handshakeDispute'] = $handshakeDispute;
                        }

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
                                'short_reference' => data_get($detail, 'shortReference'), // iFood: shortReference
                                'status' => $newStatus,
                                'origin' => data_get($detail, 'origin'),
                                'gross_total' => data_get($detail, 'total.price', 0),
                                'discount_total' => data_get($detail, 'total.discounts', 0),
                                'delivery_fee' => data_get($detail, 'total.deliveryFee', 0),
                                'tip' => data_get($detail, 'total.tip', 0),
                                'placed_at' => optional(Carbon::parse(data_get($detail, 'createdAt'), 'America/Sao_Paulo'))->setTimezone('UTC')->toDateTimeString(),
                                'raw' => $detail,
                            ]
                        );

                        // Disparar evento de novo pedido se foi criado agora
                        if (! $existingOrder) {
                            // \Log::info('🚀 [WebSocket] Disparando evento OrderCreated', [
                            //     'tenant_id' => $this->tenantId,
                            //     'order_id' => $order->id,
                            //     'order_code' => $order->code,
                            //     'provider' => $order->provider,
                            //     'channel' => "orders.tenant.{$this->tenantId}",
                            //     'broadcast_driver' => config('broadcasting.default'),
                            // ]);
                            event(new \App\Events\OrderCreated($order));
                        }

                        // Log de mudanças de status (Critérios 12-13)
                        if ($existingOrder && $oldStatus !== $newStatus) {
                            // logger()->info('🔄 Status do pedido atualizado', [
                            //     'tenant_id' => $this->tenantId,
                            //     'order_id' => $order->id,
                            //     'order_code' => $order->code,
                            //     'old_status' => $oldStatus,
                            //     'new_status' => $newStatus,
                            //     'event_code' => $eventCode,
                            //     'cancelled_by_customer' => in_array($newStatus, ['CANCELLED', 'CANCELLATION_REQUESTED']),
                            // ]);

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
                            $orderItem = OrderItem::create([
                                'tenant_id' => $this->tenantId,
                                'order_id' => $order->id,
                                'sku' => data_get($it, 'id'), // Usar o ID do produto no iFood
                                'name' => data_get($it, 'name'),
                                'qty' => (int) data_get($it, 'quantity', 1),
                                'unit_price' => (float) data_get($it, 'unitPrice', 0),
                                'total' => (float) data_get($it, 'totalPrice', 0),
                                'add_ons' => data_get($it, 'additions', []),
                                'observations' => data_get($it, 'observations'),
                            ]);

                            // Auto-aplicar mapeamento se existir ProductMapping para este SKU
                            $this->autoApplyMappings($orderItem);
                        }

                        // Recalcular custos do pedido após criar/atualizar itens
                        try {
                            $costService = app(\App\Services\OrderCostService::class);
                            $result = $costService->calculateOrderCosts($order->fresh());
                            $order->update([
                                'calculated_costs' => $result,
                                'total_costs' => $result['total_costs'] ?? 0,
                                'total_commissions' => $result['total_commissions'] ?? 0,
                                'net_revenue' => $result['net_revenue'] ?? 0,
                                'costs_calculated_at' => now(),
                            ]);
                        } catch (Throwable $costError) {
                            logger()->error('Erro ao calcular custos do pedido iFood', [
                                'order_id' => $order->id,
                                'error' => $costError->getMessage(),
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
                // logger()->info('✅ ACK enviado para eventos', [
                //     'tenant_id' => $this->tenantId,
                //     'store_id' => $this->storeId,
                //     'event_ids' => collect($eventsList)->pluck('id'),
                // ]);

            } catch (\Throwable $e) {
                logger()->error('❌ Falha ao enviar ACK de eventos iFood', [
                    'tenant_id' => $this->tenantId,
                    'store_id' => $this->storeId,
                    'error' => $e->getMessage(),
                    'payload' => $ackPayload,
                ]);
            }

            // logger()->info('iFood sync concluída', [
            //     'tenant_id' => $this->tenantId,
            //     'store_id' => $this->storeId,
            //     'events' => count($eventsList),
            // ]);
        } catch (Throwable $e) {
            logger()->error('Erro fatal na sync de pedidos iFood', [
                'tenant_id' => $this->tenantId,
                'store_id' => $this->storeId,
                'error' => $e->getMessage(),
            ]);
            throw $e; // deixa o Laravel reprocessar se configurado
        }
    }

    /**
     * Auto-aplicar mapeamentos ao OrderItem baseado em ProductMapping
     */
    private function autoApplyMappings(OrderItem $orderItem): void
    {
        // Buscar ProductMapping pelo SKU
        $productMapping = ProductMapping::where('tenant_id', $this->tenantId)
            ->where('external_item_id', $orderItem->sku)
            ->first();

        if (! $productMapping || ! $productMapping->internal_product_id) {
            return; // Sem mapeamento configurado ou sem produto vinculado
        }

        // Buscar produto interno
        $product = \App\Models\InternalProduct::find($productMapping->internal_product_id);
        if (! $product) {
            return;
        }

        // Calcular CMV correto baseado no tamanho (mesma lógica do LinkProductMappingJob)
        $correctCMV = $this->calculateCorrectCMV($product, $orderItem);

        // Criar OrderItemMapping principal com unit_cost_override
        OrderItemMapping::create([
            'tenant_id' => $this->tenantId,
            'order_item_id' => $orderItem->id,
            'internal_product_id' => $productMapping->internal_product_id,
            'quantity' => 1.0,
            'mapping_type' => 'main',
            'option_type' => 'regular',
            'auto_fraction' => false,
            'unit_cost_override' => $correctCMV,
        ]);

        // Se for parent_product (pizza completa), processar sabores
        if ($productMapping->item_type === 'parent_product') {
            $flavorMappingService = app(FlavorMappingService::class);

            // Primeiro, usar FlavorMappingService para criar/atualizar mappings dos sabores
            $flavorMappingService->recalculateAllFlavorsForOrderItem($orderItem);

            // Depois, recalcular frações de todos os sabores com PizzaFractionService
            $pizzaFractionService = new \App\Services\PizzaFractionService;
            $pizzaFractionService->recalculateFractions($orderItem);
        }

        // Auto-mapear complementos (add_ons) se houverem
        $addOns = $orderItem->add_ons ?? [];

        foreach ($addOns as $index => $addOn) {
            $addonName = $addOn['name'] ?? '';
            if (! $addonName) {
                continue;
            }

            // Criar SKU único para o add-on baseado no nome (mesmo padrão da Triagem)
            $addonSku = 'addon_'.md5($addonName);

            // Tentar encontrar mapeamento para o complemento
            $addonMapping = ProductMapping::where('tenant_id', $this->tenantId)
                ->where('external_item_id', $addonSku)
                ->first();

            if ($addonMapping && $addonMapping->internal_product_id) {
                // Se for sabor (flavor), usar FlavorMappingService para aplicar corretamente
                if ($addonMapping->item_type === 'flavor') {
                    // FlavorMappingService cuida de criar o mapping com CMV correto e fração
                    $flavorMappingService = app(FlavorMappingService::class);
                    $flavorMappingService->mapFlavorToAllOccurrences($addonMapping, $this->tenantId);
                } else {
                    // Para outros tipos de add-on, criar mapping com unit_cost_override
                    $addonQty = $addOn['quantity'] ?? 1;
                    $addonProduct = \App\Models\InternalProduct::find($addonMapping->internal_product_id);
                    $unitCost = $addonProduct ? (float) $addonProduct->unit_cost : 0;

                    OrderItemMapping::create([
                        'tenant_id' => $this->tenantId,
                        'order_item_id' => $orderItem->id,
                        'internal_product_id' => $addonMapping->internal_product_id,
                        'quantity' => $addonQty,
                        'mapping_type' => 'addon',
                        'option_type' => 'addon',
                        'auto_fraction' => false,
                        'external_reference' => (string) $index,
                        'external_name' => $addonName,
                        'unit_cost_override' => $unitCost,
                    ]);
                }
            }
        }
    }

    /**
     * Calcular o CMV correto do produto baseado no tamanho
     */
    private function calculateCorrectCMV(\App\Models\InternalProduct $product, OrderItem $orderItem): float
    {
        if ($product->product_category !== 'sabor_pizza') {
            return (float) $product->unit_cost;
        }

        // Buscar o produto pai através do mapping principal
        $pizzaSize = null;
        $mainMapping = $orderItem->mappings()->where('mapping_type', 'main')->first();

        if ($mainMapping && $mainMapping->internalProduct) {
            $pizzaSize = $mainMapping->internalProduct->size;
        }

        // Fallback: detectar do nome do item se produto pai não tiver size
        if (! $pizzaSize) {
            $pizzaSize = $this->detectPizzaSize($orderItem->name);
        }

        if (! $pizzaSize) {
            return (float) $product->unit_cost;
        }

        // Calcular CMV dinamicamente pela ficha técnica
        $cmv = $product->calculateCMV($pizzaSize);

        return $cmv > 0 ? $cmv : (float) $product->unit_cost;
    }

    /**
     * Detectar tamanho da pizza a partir do nome do item
     */
    private function detectPizzaSize(string $itemName): ?string
    {
        $itemNameLower = mb_strtolower($itemName);

        if (preg_match('/\bbroto\b/', $itemNameLower)) {
            return 'broto';
        }
        if (preg_match('/\bgrande\b/', $itemNameLower)) {
            return 'grande';
        }
        if (preg_match('/\b(familia|big|don|70x35)\b/', $itemNameLower)) {
            return 'familia';
        }
        if (preg_match('/\b(media|média|m\b)/', $itemNameLower)) {
            return 'media';
        }

        return null;
    }
}
