<?php

namespace App\Console\Commands;

use App\Models\OrderItem;
use App\Models\ProductMapping;
use App\Services\PizzaFractionService;
use Illuminate\Console\Command;

class FixPizzaFromAddOns extends Command
{
    protected $signature = 'orders:fix-pizza-from-addons
                            {--order_id= : ID específico do pedido}
                            {--tenant_id= : ID do tenant}
                            {--dry-run : Simula sem salvar no banco}';

    protected $description = 'Identifica e corrige pizzas que só têm add_ons JSON (sem mappings), criando os mappings corretos';

    public function handle()
    {
        $orderId = $this->option('order_id');
        $tenantId = $this->option('tenant_id');
        $dryRun = $this->option('dry-run');

        if ($dryRun) {
            $this->warn('🔍 MODO DRY-RUN - Nenhuma alteração será feita');
        }

        $this->info('🔍 Buscando pedidos com add_ons de pizza...');
        $this->line('');

        // Buscar OrderItems que têm add_ons não vazio
        $query = OrderItem::whereNotNull('add_ons')
            ->where('add_ons', '!=', '[]')
            ->with([
                'mappings.internalProduct',
                'order',
            ]);

        if ($orderId) {
            $query->where('order_id', $orderId);
        }

        if ($tenantId) {
            $query->where('tenant_id', $tenantId);
        }

        $orderItems = $query->get();

        // Filtrar apenas items que parecem ser pizzas
        $pizzaItems = $orderItems->filter(function ($item) {
            return $this->isPizzaItem($item);
        });

        $this->info("📦 Encontrados {$pizzaItems->count()} items de pizza");
        $this->line('');

        $fixed = 0;
        $skipped = 0;
        $errors = 0;
        $affectedOrderIds = collect();

        $pizzaService = app(PizzaFractionService::class);

        foreach ($pizzaItems as $orderItem) {
            try {
                $this->line('');
                $this->info("📦 Pedido #{$orderItem->order_id} - Item #{$orderItem->id}");
                $this->line("   🍕 {$orderItem->name}");

                // Detectar tamanho da pizza
                $pizzaSize = $this->detectPizzaSize($orderItem);
                $this->line('   📏 Tamanho detectado: '.($pizzaSize ?: 'não detectado'));

                if (! $pizzaSize) {
                    $this->warn('   ⚠️  Não foi possível detectar o tamanho - pulando');
                    $skipped++;

                    continue;
                }

                // Mostrar add_ons
                $this->line("   📋 Add-ons JSON ({$orderItem->add_ons} items):");

                $currentTotal = 0;
                $correctTotal = 0;

                foreach ($orderItem->add_ons as $index => $addon) {
                    $addonName = is_array($addon) ? ($addon['name'] ?? '') : $addon;
                    $addonQuantity = is_array($addon) ? ($addon['quantity'] ?? $addon['qty'] ?? 1) : 1;
                    $addonSku = 'addon_'.md5($addonName);

                    // Buscar ProductMapping
                    $mapping = ProductMapping::where('external_item_id', $addonSku)
                        ->where('tenant_id', $orderItem->tenant_id)
                        ->with('internalProduct')
                        ->first();

                    if (! $mapping || ! $mapping->internalProduct) {
                        $this->line("      └ {$addonName} (qty: {$addonQuantity}) - ⚠️  Sem mapping");

                        continue;
                    }

                    $product = $mapping->internalProduct;
                    $genericCMV = $product->unit_cost;
                    $correctCMV = $product->calculateCMV($pizzaSize);

                    // Calcular fração (assumir divisão igual)
                    $flavorCount = count($orderItem->add_ons);
                    $fraction = $flavorCount > 0 ? (1.0 / $flavorCount) : 1.0;

                    $currentSubtotal = $genericCMV * $addonQuantity;
                    $correctSubtotal = $correctCMV * $fraction * $addonQuantity;

                    $currentTotal += $currentSubtotal;
                    $correctTotal += $correctSubtotal;

                    $fractionLabel = $fraction == 0.5 ? '1/2' : ($fraction == 0.33 ? '1/3' : ($fraction == 0.25 ? '1/4' : $fraction));

                    if (abs($genericCMV - $correctCMV) > 0.01) {
                        $this->line("      ├ ⚠️  {$addonName} (qty: {$addonQuantity}, fração: {$fractionLabel})");
                        $this->line('         ❌ CMV ATUAL (genérico): R$ '.number_format($currentSubtotal, 2, ',', '.').' (unit: R$ '.number_format($genericCMV, 2, ',', '.').')');
                        $this->line("         ✅ CMV CORRETO ({$pizzaSize}): R$ ".number_format($correctSubtotal, 2, ',', '.').' (unit: R$ '.number_format($correctCMV, 2, ',', '.').')');
                    } else {
                        $this->line("      └ ✅ {$addonName} (qty: {$addonQuantity}, fração: {$fractionLabel}) - R$ ".number_format($correctSubtotal, 2, ',', '.'));
                    }
                }

                $difference = abs($currentTotal - $correctTotal);

                $this->line('');
                $this->line('   💰 Total ATUAL (genérico): R$ '.number_format($currentTotal, 2, ',', '.'));
                $this->line('   ✅ Total CORRETO (com tamanho): R$ '.number_format($correctTotal, 2, ',', '.'));
                $this->line('   📏 Diferença: R$ '.number_format($difference, 2, ',', '.'));

                if ($difference < 1.0) {
                    $this->comment('   ✅ Diferença pequena - OK');
                    $skipped++;

                    continue;
                }

                $this->warn('   ⚠️  NECESSITA CORREÇÃO');

                if (! $dryRun) {
                    // Recalcular frações (cria os mappings corretos)
                    $result = $pizzaService->recalculateFractions($orderItem);

                    $this->info('   ✅ Frações recalculadas e mappings criados!');

                    // Verificar resultado
                    $orderItem->refresh();
                    $newTotal = $orderItem->calculateTotalCost();
                    $this->line('   🆕 Novo total: R$ '.number_format($newTotal, 2, ',', '.'));

                    $fixed++;
                    $affectedOrderIds->push($orderItem->order_id);
                } else {
                    $this->comment('   🔍 Seria recalculado (dry-run)');
                    $fixed++;
                    $affectedOrderIds->push($orderItem->order_id);
                }

            } catch (\Exception $e) {
                $this->error("   ❌ Erro ao processar item #{$orderItem->id}: {$e->getMessage()}");
                $errors++;
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
        $this->info("📊 Total analisado: {$pizzaItems->count()} items");
        $this->info('🔧 '.($dryRun ? 'Seriam corrigidos' : 'Corrigidos').": {$fixed}");
        $this->info("⏭️  Pulados: {$skipped}");

        if ($errors > 0) {
            $this->error("❌ Erros: {$errors}");
        }

        $this->info('═══════════════════════════════════════');

        if ($dryRun) {
            $this->warn('🔍 DRY-RUN: Nenhuma alteração foi salva. Execute sem --dry-run para aplicar.');
        }

        return 0;
    }

    /**
     * Verificar se um OrderItem é uma pizza
     */
    private function isPizzaItem(OrderItem $item): bool
    {
        if (empty($item->add_ons)) {
            return false;
        }

        // Procurar por palavras-chave de pizza nos add_ons
        foreach ($item->add_ons as $addon) {
            $name = is_array($addon) ? ($addon['name'] ?? '') : $addon;

            // Padrões de sabores ou tamanhos de pizza
            if (preg_match('/(grande|média|pequena|broto|familia|pizza|sabor)/i', $name)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Detectar tamanho da pizza do OrderItem
     */
    protected function detectPizzaSize(OrderItem $orderItem): ?string
    {
        // 1. Tentar detectar do nome do item ou add_ons
        $itemName = strtolower($orderItem->name);

        // Verificar também nos add_ons
        $addOnsText = '';
        if (! empty($orderItem->add_ons)) {
            foreach ($orderItem->add_ons as $addon) {
                $name = is_array($addon) ? ($addon['name'] ?? '') : $addon;
                $addOnsText .= ' '.strtolower($name);
            }
        }

        $fullText = $itemName.' '.$addOnsText;

        if (preg_match('/\bbroto\b/', $fullText)) {
            return 'broto';
        }
        if (preg_match('/\bgrande\b/', $fullText)) {
            return 'grande';
        }
        if (preg_match('/\b(familia|big|don|70x35)\b/', $fullText)) {
            return 'familia';
        }
        if (preg_match('/\b(media|média|m\b)/', $fullText)) {
            return 'media';
        }

        return null;
    }
}
