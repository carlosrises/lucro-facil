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
            // Para sabores, usar FlavorMappingService que calcula CMV por tamanho e frações corretas
            $flavorService = new \App\Services\FlavorMappingService;
            $mappedCount = $flavorService->mapFlavorToAllOccurrences($mapping, $this->tenantId);

            // Log::info('🍕 Sabor mapeado para todas as ocorrências', [
            //     'mapped_count' => $mappedCount,
            // ]);
        } elseif (str_starts_with($this->externalItemId, 'addon_')) {
            // Para outros add-ons (bebidas, complementos), aplicar normalmente
            $this->applyMappingToHistoricalOrders($mapping);
        } else {
            // Para items principais (parent_product), criar mappings principais
            $this->applyMainProductMapping($mapping);
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
                            $addOnQuantity = $addOn['quantity'] ?? $addOn['qty'] ?? 1;

                            // Buscar produto para calcular CMV
                            $product = \App\Models\InternalProduct::find($mapping->internal_product_id);
                            $unitCost = $product ? (float) $product->unit_cost : 0;

                            if ($existingMapping) {
                                $existingMapping->update([
                                    'internal_product_id' => $mapping->internal_product_id,
                                    'quantity' => $addOnQuantity,
                                    'unit_cost_override' => $unitCost,
                                ]);
                            } else {
                                \App\Models\OrderItemMapping::create([
                                    'tenant_id' => $this->tenantId,
                                    'order_item_id' => $orderItem->id,
                                    'mapping_type' => 'addon',
                                    'option_type' => 'addon', // Para add-ons não-sabor
                                    'external_reference' => (string) $index,
                                    'external_name' => $addOnName,
                                    'internal_product_id' => $mapping->internal_product_id,
                                    'quantity' => $addOnQuantity,
                                    'unit_cost_override' => $unitCost,
                                    'auto_fraction' => false,
                                ]);
                            }
                            $processedCount++;
                        } elseif ($existingMapping && $existingMapping->mapping_type === 'addon') {
                            // Só deletar se for add-on, não deletar sabores
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

    /**
     * Aplicar mapping para items principais (parent_product)
     */
    private function applyMainProductMapping(ProductMapping $mapping): void
    {
        $orderItems = OrderItem::where('tenant_id', $this->tenantId)
            ->where('sku', $mapping->external_item_id)
            ->get();

        if ($orderItems->isEmpty()) {
            return;
        }

        foreach ($orderItems as $orderItem) {
            // Deletar mapping principal existente
            \App\Models\OrderItemMapping::where('order_item_id', $orderItem->id)
                ->where('mapping_type', 'main')
                ->delete();

            if ($mapping->internal_product_id) {
                // Buscar produto
                $product = \App\Models\InternalProduct::find($mapping->internal_product_id);

                // Calcular CMV correto baseado no tamanho
                $correctCMV = $product ? $this->calculateCorrectCMV($product, $orderItem) : null;

                // Criar novo mapping principal
                \App\Models\OrderItemMapping::create([
                    'tenant_id' => $this->tenantId,
                    'order_item_id' => $orderItem->id,
                    'internal_product_id' => $mapping->internal_product_id,
                    'quantity' => 1.0,
                    'mapping_type' => 'main',
                    'option_type' => 'regular',
                    'auto_fraction' => false,
                    'unit_cost_override' => $correctCMV,
                ]);

                // Se for parent_product (pizza completa), processar sabores
                if ($mapping->item_type === 'parent_product') {
                    // Primeiro, usar FlavorMappingService para criar/atualizar mappings dos sabores
                    $flavorService = new \App\Services\FlavorMappingService;
                    $flavorService->recalculateAllFlavorsForOrderItem($orderItem);

                    // Depois, recalcular frações de todos os sabores com PizzaFractionService
                    $pizzaFractionService = new \App\Services\PizzaFractionService;
                    $pizzaFractionService->recalculateFractions($orderItem);
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
        if (!$pizzaSize) {
            $pizzaSize = $this->detectPizzaSize($orderItem->name);
        }

        if (!$pizzaSize) {
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
