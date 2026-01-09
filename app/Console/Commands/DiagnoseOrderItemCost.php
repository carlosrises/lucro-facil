<?php

namespace App\Console\Commands;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderItemMapping;
use App\Models\ProductMapping;
use Illuminate\Console\Command;

class DiagnoseOrderItemCost extends Command
{
    protected $signature = 'orders:diagnose-item-cost
                            {order : ID do pedido}
                            {--item= : Nome do item para diagnosticar}';

    protected $description = 'Diagnostica de onde vem o custo de um item específico do pedido';

    public function handle(): int
    {
        $orderId = $this->argument('order');
        $itemName = $this->option('item');

        $order = Order::find($orderId);

        if (!$order) {
            $this->error("❌ Pedido ID {$orderId} não encontrado");
            return 1;
        }

        $this->info("📦 Pedido: {$order->code} | Provider: {$order->provider}");
        $this->info("🏪 Loja: {$order->store->name}");
        $this->newLine();

        $orderItems = $order->items;

        if ($orderItems->isEmpty()) {
            $this->warn('⚠️  Pedido sem itens');
            return 0;
        }

        foreach ($orderItems as $orderItem) {
            // Se especificou um item, pular os outros
            if ($itemName && stripos($orderItem->name, $itemName) === false) {
                continue;
            }

            $this->diagnoseItem($orderItem);
            $this->newLine();
        }

        return 0;
    }

    protected function diagnoseItem(OrderItem $orderItem): void
    {
        $this->line("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        $this->info("🔍 Item: {$orderItem->name}");
        $this->line("   ID: {$orderItem->id} | SKU: {$orderItem->sku}");
        $this->line("   Quantidade: {$orderItem->quantity}x | Valor unitário: R$ {$orderItem->unit_price}");

        // Detectar tamanho do item pai
        $detectedSize = $this->detectPizzaSize($orderItem->name);
        if ($detectedSize) {
            $this->line("   🍕 Tamanho detectado: " . strtoupper($detectedSize));
        } else {
            $this->warn("   ⚠️  Tamanho NÃO detectado no nome do item");
            $this->line("      Sugestão: Nome deve conter broto, média, grande, família, big, don, etc.");
        }

        if ($orderItem->total_cost) {
            $this->line("   💰 Total Cost (do backend): R$ {$orderItem->total_cost}");
        }

        $this->newLine();

        $this->line("📋 1. ProductMapping (SKU → Produto Interno):");
        $productMapping = ProductMapping::where('tenant_id', $orderItem->tenant_id)
            ->where('external_item_id', $orderItem->sku)
            ->where('item_type', 'parent_product')
            ->first();

        if ($productMapping) {
            $this->line("   ✅ ENCONTRADO");
            $this->line("      → Produto: {$productMapping->internalProduct->name}");
            $this->line("      → Custo unitário: R$ " . number_format($productMapping->internalProduct->unit_cost, 2, ',', '.'));
            $this->line("      → Custo total: R$ " . number_format($productMapping->internalProduct->unit_cost * $orderItem->quantity, 2, ',', '.'));
        } else {
            $this->line("   ❌ NÃO ENCONTRADO (item não associado)");
        }

        $this->newLine();

        // 2. Verificar OrderItemMapping do tipo 'main'
        $this->line("📦 2. OrderItemMapping tipo 'main' (específico deste pedido):");
        $mainMapping = OrderItemMapping::where('order_item_id', $orderItem->id)
            ->where('mapping_type', 'main')
            ->first();

        if ($mainMapping) {
            $this->line("   ✅ ENCONTRADO");
            $this->line("      → Produto: {$mainMapping->internalProduct->name}");
            $this->line("      → Quantity: {$mainMapping->quantity}");
            $this->line("      → Custo unitário: R$ " . number_format($mainMapping->internalProduct->unit_cost, 2, ',', '.'));
            $this->line("      → Custo calculado: R$ " . number_format($mainMapping->internalProduct->unit_cost * $mainMapping->quantity * $orderItem->quantity, 2, ',', '.'));
        } else {
            $this->line("   ❌ NÃO ENCONTRADO");
        }

        $this->newLine();

        // 3. Verificar OrderItemMappings de add-ons
        $this->line("🍕 3. OrderItemMappings de add-ons (sabores, extras, etc.):");
        $addonMappings = OrderItemMapping::where('order_item_id', $orderItem->id)
            ->where('mapping_type', 'addon')
            ->get();

        if ($addonMappings->isEmpty()) {
            $this->line("   ❌ Nenhum add-on mapeado");
        } else {
            $totalAddonCost = 0;
            foreach ($addonMappings as $mapping) {
                $cost = $mapping->internalProduct->unit_cost * $mapping->quantity * $orderItem->quantity;
                $totalAddonCost += $cost;

                $fractionInfo = $mapping->auto_fraction ? " (fração: {$mapping->quantity})" : "";
                $this->line("   ├─ {$mapping->internalProduct->name}{$fractionInfo}");
                $this->line("      → Custo unitário: R$ " . number_format($mapping->internalProduct->unit_cost, 2, ',', '.'));
                $this->line("      → Quantity no mapping: {$mapping->quantity}");
                $this->line("      → Quantidade do item: {$orderItem->quantity}x");
                $this->line("      → Custo calculado: R$ " . number_format($cost, 2, ',', '.'));
            }
            $this->newLine();
            $this->line("   💰 Total de add-ons: R$ " . number_format($totalAddonCost, 2, ',', '.'));
        }

        $this->newLine();

        // 4. Cálculo Frontend (como o frontend calcula)
        $this->line("💻 4. Simulação do Cálculo Frontend:");

        $frontendCost = 0;

        // Prioridade 1: total_cost do backend
        if ($orderItem->total_cost) {
            $frontendCost = $orderItem->total_cost;
            $this->line("   → Usando total_cost do backend: R$ " . number_format($frontendCost, 2, ',', '.'));
        }
        // Prioridade 2: calcular via mappings
        elseif ($mainMapping || $addonMappings->isNotEmpty()) {
            if ($mainMapping) {
                $mainCost = $mainMapping->internalProduct->unit_cost * $mainMapping->quantity * $orderItem->quantity;
                $frontendCost += $mainCost;
                $this->line("   → Custo do mapping 'main': R$ " . number_format($mainCost, 2, ',', '.'));
            }

            foreach ($addonMappings as $mapping) {
                $addonCost = $mapping->internalProduct->unit_cost * $mapping->quantity * $orderItem->quantity;
                $frontendCost += $addonCost;
            }
            $this->line("   → Total calculado via mappings: R$ " . number_format($frontendCost, 2, ',', '.'));
        }
        // Prioridade 3: ProductMapping direto
        elseif ($productMapping) {
            $frontendCost = $productMapping->internalProduct->unit_cost * $orderItem->quantity;
            $this->line("   → Usando ProductMapping direto: R$ " . number_format($frontendCost, 2, ',', '.'));
        }
        else {
            $this->line("   → Sem custo (não associado): R$ 0,00");
        }

        $this->newLine();
        $this->info("🎯 CUSTO FINAL NO FRONTEND: R$ " . number_format($frontendCost, 2, ',', '.'));

        // 5. Verificar add_ons no JSON
        if ($orderItem->add_ons && is_array($orderItem->add_ons)) {
            $this->newLine();
            $this->line("📎 5. Add-ons no JSON do pedido:");

            $detectedSize = $this->detectPizzaSize($orderItem->name);

            foreach ($orderItem->add_ons as $index => $addOn) {
                $addOnName = $addOn['name'] ?? 'N/A';
                $addOnQty = $addOn['quantity'] ?? $addOn['qty'] ?? 1;
                $this->line("   [{$index}] {$addOnName} ({$addOnQty}x)");

                // Verificar se este add-on tem ProductMapping
                $addOnSku = 'addon_'.md5($addOnName);
                $productMapping = ProductMapping::where('tenant_id', $orderItem->tenant_id)
                    ->where('external_item_id', $addOnSku)
                    ->where('item_type', 'flavor')
                    ->first();

                if ($productMapping && $productMapping->internalProduct) {
                    $product = $productMapping->internalProduct;
                    $this->line("      → Produto: {$product->name}");

                    // Verificar se tem CMV por tamanho
                    if ($product->cmv_by_size && is_array($product->cmv_by_size)) {
                        $this->line("      → CMV por tamanho:");
                        foreach ($product->cmv_by_size as $size => $cost) {
                            $marker = ($detectedSize && $size === $detectedSize) ? ' ← TAMANHO ATUAL' : '';
                            $this->line("         • {$size}: R$ " . number_format($cost, 2, ',', '.') . $marker);
                        }

                        // Verificar se o custo usado está correto
                        $unitCost = floatval($product->unit_cost);
                        if ($detectedSize && isset($product->cmv_by_size[$detectedSize])) {
                            $expectedCost = floatval($product->cmv_by_size[$detectedSize]);
                            if (abs($unitCost - $expectedCost) > 0.01) {
                                $this->warn("      ⚠️  ATENÇÃO: unit_cost (R$ {$unitCost}) difere do CMV do tamanho {$detectedSize} (R$ {$expectedCost})");
                            } else {
                                $this->line("      ✅ Custo correto para tamanho {$detectedSize}");
                            }
                        }
                    } else {
                        $this->line("      → Custo único: R$ " . number_format($product->unit_cost, 2, ',', '.'));
                        if ($detectedSize) {
                            $this->warn("      ⚠️  Este produto NÃO tem CMV por tamanho configurado!");
                            $this->line("         Recomendação: Configure CMV diferente para cada tamanho (broto, média, grande, família)");
                        }
                    }
                }
            }
        }
    }

    /**
     * Detectar tamanho da pizza a partir do nome
     */
    protected function detectPizzaSize(string $itemName): ?string
    {
        $itemNameLower = strtolower($itemName);

        // Broto
        if (str_contains($itemNameLower, 'broto')) {
            return 'broto';
        }

        // Média
        if (str_contains($itemNameLower, 'média') || str_contains($itemNameLower, 'media')) {
            return 'media';
        }

        // Grande
        if (str_contains($itemNameLower, 'grande')) {
            return 'grande';
        }

        // Família (vários padrões)
        if (str_contains($itemNameLower, 'família') ||
            str_contains($itemNameLower, 'familia') ||
            str_contains($itemNameLower, 'big') ||
            str_contains($itemNameLower, 'don') ||
            str_contains($itemNameLower, '70x35') ||
            str_contains($itemNameLower, 'gigante') ||
            str_contains($itemNameLower, 'super')) {
            return 'familia';
        }

        return null;
    }
}
