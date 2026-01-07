<?php

namespace App\Console\Commands;

use App\Models\InternalProduct;
use App\Models\OrderItem;
use App\Models\ProductMapping;
use App\Services\FlavorMappingService;
use Illuminate\Console\Command;

class TestFlavorFractionation extends Command
{
    protected $signature = 'flavors:test {tenant_id}';

    protected $description = 'Testar sistema de fracionamento de sabores de pizza';

    public function handle()
    {
        $tenantId = (int) $this->argument('tenant_id');

        $this->info("🍕 Testando sistema de fracionamento automático para tenant {$tenantId}");
        $this->newLine();

        // 1. Verificar produtos internos com categoria pizza
        $this->info('📊 Produtos Internos (Pizzas):');
        $pizzaProducts = InternalProduct::where('tenant_id', $tenantId)
            ->where('product_category', 'pizza')
            ->get();

        if ($pizzaProducts->isEmpty()) {
            $this->warn('Nenhum produto interno com categoria "pizza" encontrado.');
        } else {
            foreach ($pizzaProducts as $product) {
                $this->line("  - {$product->name} (max_flavors: {$product->max_flavors})");
            }
        }
        $this->newLine();

        // 2. Verificar mappings de sabores
        $this->info('🏷️  Product Mappings (Sabores):');
        $flavorMappings = ProductMapping::where('tenant_id', $tenantId)
            ->where('item_type', 'flavor')
            ->with('internalProduct')
            ->get();

        if ($flavorMappings->isEmpty()) {
            $this->warn('Nenhum sabor classificado encontrado.');
        } else {
            foreach ($flavorMappings as $mapping) {
                $productName = $mapping->internalProduct ? $mapping->internalProduct->name : 'Sem produto vinculado';
                $this->line("  - {$mapping->external_item_name} → {$productName}");
            }
        }
        $this->newLine();

        // 3. Verificar mappings de produtos pai (bases de pizza)
        $this->info('🍕 Product Mappings (Bases de Pizza):');
        $parentMappings = ProductMapping::where('tenant_id', $tenantId)
            ->where('item_type', 'parent_product')
            ->with('internalProduct')
            ->get();

        if ($parentMappings->isEmpty()) {
            $this->warn('Nenhuma base de pizza classificada encontrada.');
        } else {
            foreach ($parentMappings as $mapping) {
                $productName = $mapping->internalProduct ? $mapping->internalProduct->name : 'Sem produto vinculado';
                $this->line("  - {$mapping->external_item_name} → {$productName}");
            }
        }
        $this->newLine();

        // 4. Analisar alguns pedidos com pizzas
        $this->info('📦 Análise de Pedidos:');
        $ordersWithAddOns = OrderItem::where('tenant_id', $tenantId)
            ->whereNotNull('add_ons')
            ->whereRaw('JSON_LENGTH(add_ons) > 0')
            ->with('order')
            ->limit(5)
            ->get();

        if ($ordersWithAddOns->isEmpty()) {
            $this->warn('Nenhum pedido com add-ons (sabores) encontrado.');
        } else {
            foreach ($ordersWithAddOns as $orderItem) {
                $order = $orderItem->order;
                $addOns = $orderItem->add_ons;
                $flavorCount = count($addOns);

                $this->line("  Pedido #{$order->code}:");
                $this->line("    Item: {$orderItem->name}");
                $this->line("    Sabores: {$flavorCount}");

                foreach ($addOns as $addOn) {
                    $addOnName = $addOn['name'] ?? 'Sem nome';
                    $this->line("      - {$addOnName}");
                }

                // Verificar se o produto pai está mapeado
                $parentMapping = ProductMapping::where('tenant_id', $tenantId)
                    ->where('external_item_id', $orderItem->sku)
                    ->first();

                if ($parentMapping && $parentMapping->internalProduct) {
                    $parent = $parentMapping->internalProduct;
                    $this->line("    Base mapeada: {$parent->name}");
                    $this->line("    Categoria: {$parent->product_category}");
                    $this->line("    Max Sabores: {$parent->max_flavors}");

                    // Contar apenas sabores classificados
                    $classifiedFlavors = 0;
                    foreach ($addOns as $addOn) {
                        $addOnName = $addOn['name'] ?? '';
                        $addOnSku = 'addon_'.md5($addOnName);
                        $flavorMapping = \App\Models\ProductMapping::where('tenant_id', $tenantId)
                            ->where('external_item_id', $addOnSku)
                            ->where('item_type', 'flavor')
                            ->exists();
                        if ($flavorMapping) {
                            $classifiedFlavors++;
                        }
                    }

                    $this->line("    Sabores Classificados: {$classifiedFlavors}/{$flavorCount}");

                    if ($parent->product_category === 'pizza') {
                        if ($classifiedFlavors > 0) {
                            $fraction = 1.0 / $classifiedFlavors;
                            $percentage = round($fraction * 100, 2);
                            $this->line("    ✅ Fração por sabor: {$percentage}%");
                        } else {
                            $this->line('    ⚠️  Nenhum sabor classificado ainda');
                        }
                    } else {
                        $this->line('    ⚠️  Não é pizza, não fraciona');
                    }
                } else {
                    $this->line('    ⚠️  Base não mapeada');
                }

                $this->newLine();
            }
        }

        // 5. Oferecer aplicar fracionamento a um sabor específico
        if (! $flavorMappings->isEmpty()) {
            $this->newLine();
            if ($this->confirm('Deseja aplicar o fracionamento a um sabor específico?')) {
                $flavorOptions = $flavorMappings->pluck('external_item_name', 'id')->toArray();
                $selectedId = $this->choice(
                    'Selecione o sabor:',
                    $flavorOptions,
                    0
                );

                $mapping = $flavorMappings->firstWhere('id', array_search($selectedId, $flavorOptions));

                if ($mapping) {
                    $service = new FlavorMappingService;
                    $this->info("Aplicando fracionamento para: {$mapping->external_item_name}...");
                    $count = $service->mapFlavorToAllOccurrences($mapping, $tenantId);
                    $this->info("✅ Fracionamento aplicado a {$count} ocorrências!");
                }
            }
        }

        return Command::SUCCESS;
    }
}
