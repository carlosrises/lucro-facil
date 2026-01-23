<?php

namespace App\Console\Commands;

use App\Models\OrderItem;
use App\Models\OrderItemMapping;
use Illuminate\Console\Command;

class FixPizzaFlavorCosts extends Command
{
    protected $signature = 'orders:fix-pizza-costs {--order_id=} {--tenant_id=} {--dry-run}';

    protected $description = 'Corrige CMV de sabores de pizza usando unit_cost genérico ao invés do CMV por tamanho';

    public function handle()
    {
        $orderId = $this->option('order_id');
        $tenantId = $this->option('tenant_id');
        $dryRun = $this->option('dry-run');

        if ($dryRun) {
            $this->warn('🔍 MODO DRY-RUN - Nenhuma alteração será feita');
        }

        // Buscar OrderItemMappings de sabores de pizza
        $query = OrderItemMapping::where('mapping_type', 'addon')
            ->where('option_type', 'pizza_flavor')
            ->whereHas('internalProduct', function ($q) {
                $q->where('product_category', 'sabor_pizza');
            })
            ->whereHas('orderItem.order') // Garantir que o pedido existe
            ->with(['orderItem.order', 'internalProduct'])
            ->orderBy('order_item_id'); // Ordenar para processar em sequência

        if ($orderId) {
            $query->whereHas('orderItem', function ($q) use ($orderId) {
                $q->where('order_id', $orderId);
            });
        }

        if ($tenantId) {
            $query->where('tenant_id', $tenantId);
        }

        $mappings = $query->get();

        $this->info("🔍 Encontrados {$mappings->count()} mappings de sabores de pizza");
        $this->line('');

        // Agrupar por pedido para melhor visualização
        $groupedByOrder = $mappings->groupBy(function ($mapping) {
            return $mapping->orderItem?->order_id ?? 'unknown';
        });

        $this->info("📊 Total de pedidos afetados: {$groupedByOrder->count()}");
        $this->line('');

        $fixed = 0;
        $alreadyCorrect = 0;
        $errors = 0;
        $affectedOrderIds = collect();

        foreach ($mappings as $mapping) {
            $orderItem = $mapping->orderItem;
            $product = $mapping->internalProduct;

            if (! $orderItem || ! $product) {
                $errors++;

                continue;
            }

            // Detectar tamanho da pizza
            $pizzaSize = $this->detectPizzaSize($orderItem);

            if (! $pizzaSize) {
                $this->warn("⚠️  Pedido {$orderItem->order_id} - Item {$orderItem->id}: Tamanho não detectado");
                $errors++;

                continue;
            }

            // Calcular CMV correto
            $correctCMV = $product->calculateCMV($pizzaSize);
            $currentCMV = (float) $mapping->unit_cost_override;
            $genericCMV = (float) $product->unit_cost;

            // Verificar se está usando CMV genérico (errado)
            $isUsingGenericCost = abs($currentCMV - $genericCMV) < 0.01;
            $needsUpdate = abs($currentCMV - $correctCMV) > 0.01;

            if (! $needsUpdate) {
                $alreadyCorrect++;

                continue;
            }

            $this->line('');
            $this->info("📦 Pedido {$orderItem->order_id} - Pizza: {$orderItem->name}");
            $this->line("   🍕 Sabor (add-on): {$product->name}");
            $this->line("   📏 Tamanho: {$pizzaSize}");
            $this->line('   💰 CMV Atual: R$ '.number_format($currentCMV, 2, ',', '.'));
            $this->line('   📊 CMV Genérico: R$ '.number_format($genericCMV, 2, ',', '.'));
            $this->line("   ✅ CMV Correto ({$pizzaSize}): R$ ".number_format($correctCMV, 2, ',', '.'));

            if ($isUsingGenericCost) {
                $this->warn('   ⚠️  Usando CMV genérico ao invés do CMV por tamanho (ERRADO)');
            }

            if (! $dryRun) {
                try {
                    $mapping->unit_cost_override = $correctCMV;
                    $mapping->save();
                    $this->info('   ✅ Corrigido!');
                    $fixed++;
                    $affectedOrderIds->push($orderItem->order_id);
                } catch (\Exception $e) {
                    $this->error("   ❌ Erro ao salvar: {$e->getMessage()}");
                    $errors++;
                }
            } else {
                $this->comment('   🔍 Seria corrigido (dry-run)');
                $fixed++;
                $affectedOrderIds->push($orderItem->order_id);
            }
        }

        // Recalcular custos dos pedidos afetados
        if (!$dryRun && $affectedOrderIds->isNotEmpty()) {
            $uniqueOrderIds = $affectedOrderIds->unique();
            $this->line('');
            $this->info("🔄 Recalculando custos de {$uniqueOrderIds->count()} pedidos...");

            $costService = app(\App\Services\OrderCostService::class);
            foreach ($uniqueOrderIds as $orderId) {
                $order = \App\Models\Order::find($orderId);
                if ($order) {
                    try {
                        $result = $costService->calculateOrderCosts($order);
                        $order->update([
                            'calculated_costs' => $result,
                            'total_costs' => $result['total_costs'] ?? 0,
                            'total_commissions' => $result['total_commissions'] ?? 0,
                            'net_revenue' => $result['net_revenue'] ?? 0,
                            'costs_calculated_at' => now(),
                        ]);
                    } catch (\Exception $e) {
                        logger()->error('Erro ao recalcular custos do pedido', [
                            'order_id' => $orderId,
                            'error' => $e->getMessage(),
                        ]);
                    }
                }
            }
            $this->info('✅ Custos recalculados!');
        }

        $this->line('');
        $this->info('═══════════════════════════════════════');
        $this->info("📊 Total analisado: {$mappings->count()} sabores");
        $this->info("✅ Já corretos: {$alreadyCorrect}");
        $this->info('🔧 '.($dryRun ? 'Seriam corrigidos' : 'Corrigidos').": {$fixed}");

        if ($errors > 0) {
            $this->error("❌ Erros: {$errors}");
        }

        $this->info('═══════════════════════════════════════');

        return 0;
    }

    private function detectPizzaSize(OrderItem $orderItem): ?string
    {
        // 1. Tentar via produto pai
        $mainMapping = $orderItem->mappings()->where('mapping_type', 'main')->first();
        if ($mainMapping && $mainMapping->internalProduct) {
            $pizzaSize = $mainMapping->internalProduct->size;
            if ($pizzaSize) {
                return $pizzaSize;
            }
        }

        // 2. Detectar do nome do item
        $itemNameLower = mb_strtolower($orderItem->name);

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
