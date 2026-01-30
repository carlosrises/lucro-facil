<?php

namespace App\Jobs;

use App\Events\ItemTriaged;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\ProductMapping;
use App\Services\OrderCostService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;

class LinkProductMappingJob implements ShouldQueue
{
    use Queueable;

    /**
     * Create a new job instance.
     */
    public function __construct(
        public int $tenantId,
        public string $externalItemId,
        public ?int $internalProductId,
        public string $itemName,
        public string $itemType,
        public string $action = 'link' // 'link' or 'detach'
    ) {
        //
    }

    /**
     * Execute the job.
     */
    public function handle(OrderCostService $costService): void
    {
        // Log::info('🔗 LinkProductMappingJob - Iniciando', [
        //     'tenant_id' => $this->tenantId,
        //     'external_item_id' => $this->externalItemId,
        //     'internal_product_id' => $this->internalProductId,
        //     'action' => $this->action,
        // ]);

        try {
            $mapping = ProductMapping::where('tenant_id', $this->tenantId)
                ->where('external_item_id', $this->externalItemId)
                ->first();

            if (! $mapping) {
                // Log::warning('⚠️ ProductMapping não encontrado', [
                //     'external_item_id' => $this->externalItemId,
                // ]);

                return;
            }

            if ($this->action === 'detach') {
                $this->handleDetach($mapping);
            } else {
                $this->handleLink($mapping);
            }

            // Recalcular pedidos afetados
            $this->recalculateAffectedOrders($mapping, $costService);

            // Limpar flag de linking_since
            $mapping->update(['linking_since' => null]);

            // Broadcast evento para atualizar frontend via WebSocket
            broadcast(new ItemTriaged(
                $this->tenantId,
                0, // orderId não usado aqui
                '', // orderCode não usado
                0, // itemId não usado
                $this->itemName,
                $this->internalProductId,
                $this->itemType,
                $this->action === 'detach' ? 'classified' : 'mapped'
            ));

            // Log::info('✅ LinkProductMappingJob - Concluído', [
            //     'external_item_id' => $this->externalItemId,
            //     'action' => $this->action,
            // ]);
        } catch (\Exception $e) {
            Log::error('❌ LinkProductMappingJob - Erro', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            // Limpar flag mesmo em caso de erro
            ProductMapping::where('tenant_id', $this->tenantId)
                ->where('external_item_id', $this->externalItemId)
                ->update(['linking_since' => null]);

            throw $e;
        }
    }

    private function handleDetach(ProductMapping $mapping): void
    {
        // Log::info('🗑️ Desassociando produto - removendo OrderItemMappings', [
        //     'mapping_id' => $mapping->id,
        //     'sku' => $this->externalItemId,
        // ]);

        if (str_starts_with($this->externalItemId, 'addon_')) {
            // Deletar apenas os mappings do add-on ESPECÍFICO (por external_name)
            $deletedCount = \App\Models\OrderItemMapping::whereHas('orderItem', function ($q) {
                $q->where('tenant_id', $this->tenantId);
            })
                ->where('mapping_type', 'addon')
                ->where('external_name', $this->itemName)
                ->delete();
        } else {
            $deletedCount = \App\Models\OrderItemMapping::whereHas('orderItem', function ($q) {
                $q->where('tenant_id', $this->tenantId)
                    ->where('sku', $this->externalItemId);
            })
                ->where('mapping_type', 'main')
                ->delete();
        }

        // Log::info('✅ Produto desassociado', [
        //     'deleted_mappings' => $deletedCount ?? 0,
        // ]);

        // Mesmo sem produto, processar pedidos históricos para aplicar a classificação
        if (str_starts_with($this->externalItemId, 'addon_')) {
            $this->applyMappingToHistoricalOrders($mapping);
        }
    }

    private function handleLink(ProductMapping $mapping): void
    {
        if ($this->itemType === 'flavor' && str_starts_with($this->externalItemId, 'addon_')) {
            $flavorService = new \App\Services\FlavorMappingService;
            $mappedCount = $flavorService->mapFlavorToAllOccurrences($mapping, $this->tenantId);

            // Log::info('🍕 Sabor mapeado para todas as ocorrências', [
            //     'mapped_count' => $mappedCount,
            // ]);
        } elseif (str_starts_with($this->externalItemId, 'addon_')) {
            $this->applyMappingToHistoricalOrders($mapping);
        }
    }

    private function applyMappingToHistoricalOrders(ProductMapping $mapping): void
    {
        // Log::info('🔍 Aplicando mapping de add-on histórico', [
        //     'sku' => $mapping->external_item_id,
        //     'name' => $mapping->external_item_name,
        // ]);

        $orderItems = OrderItem::where('tenant_id', $this->tenantId)
            ->whereNotNull('add_ons')
            ->whereRaw('JSON_LENGTH(add_ons) > 0')
            ->get();

        $processedCount = 0;

        foreach ($orderItems as $orderItem) {
            $addOns = $orderItem->add_ons;
            if (is_array($addOns)) {
                foreach ($addOns as $index => $addOn) {
                    $addOnName = $addOn['name'] ?? '';
                    if ($addOnName === $mapping->external_item_name) {
                        $existingMapping = \App\Models\OrderItemMapping::where('order_item_id', $orderItem->id)
                            ->where('mapping_type', 'addon')
                            ->where('external_reference', (string) $index)
                            ->where('external_name', $addOnName)
                            ->first();

                        if ($mapping->internal_product_id) {
                            if ($existingMapping) {
                                $existingMapping->update([
                                    'internal_product_id' => $mapping->internal_product_id,
                                ]);
                            } else {
                                \App\Models\OrderItemMapping::create([
                                    'order_item_id' => $orderItem->id,
                                    'mapping_type' => 'addon',
                                    'external_reference' => (string) $index,
                                    'external_name' => $addOnName,
                                    'internal_product_id' => $mapping->internal_product_id,
                                ]);
                            }
                            $processedCount++;
                        } elseif ($existingMapping) {
                            $existingMapping->delete();
                        }
                    }
                }
            }
        }

        // Log::info('✅ Add-on histórico processado', [
        //     'processed_count' => $processedCount,
        // ]);
    }

    private function recalculateAffectedOrders(ProductMapping $mapping, OrderCostService $costService): void
    {
        $affectedOrderIds = collect();

        if (str_starts_with($mapping->external_item_id, 'addon_')) {
            // Para add-ons, buscar orders que contêm esse add-on
            $affectedOrderIds = OrderItem::where('tenant_id', $this->tenantId)
                ->whereNotNull('add_ons')
                ->whereRaw('JSON_LENGTH(add_ons) > 0')
                ->get()
                ->filter(function ($orderItem) use ($mapping) {
                    $addOns = $orderItem->add_ons;
                    if (is_array($addOns)) {
                        foreach ($addOns as $addOn) {
                            if (($addOn['name'] ?? '') === $mapping->external_item_name) {
                                return true;
                            }
                        }
                    }

                    return false;
                })
                ->pluck('order_id')
                ->unique();
        } else {
            // Para items principais, buscar por SKU
            $affectedOrderIds = OrderItem::where('tenant_id', $this->tenantId)
                ->where('sku', $mapping->external_item_id)
                ->pluck('order_id')
                ->unique();
        }

        // Log::info('🔄 Recalculando pedidos afetados', [
        //     'order_count' => $affectedOrderIds->count(),
        // ]);

        $recalculatedCount = 0;

        // Recalcular em chunks para não sobrecarregar
        foreach ($affectedOrderIds as $orderId) {
            try {
                $order = Order::find($orderId);
                if ($order) {
                    $result = $costService->calculateCosts($order);
                    $order->update([
                        'calculated_costs' => $result,
                        'total_costs' => $result['total_costs'] ?? 0,
                        'total_commissions' => $result['total_commissions'] ?? 0,
                        'net_revenue' => $result['net_revenue'] ?? 0,
                        'costs_calculated_at' => now(),
                    ]);
                    $recalculatedCount++;
                }
            } catch (\Exception $e) {
                Log::error('Erro ao recalcular pedido', [
                    'order_id' => $orderId,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        // Log::info('✅ Pedidos recalculados', [
        //     'recalculated_count' => $recalculatedCount,
        // ]);
    }
}
