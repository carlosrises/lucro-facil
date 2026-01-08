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
                            {order : Código do pedido}
                            {--item= : Nome do item para diagnosticar}';

    protected $description = 'Diagnostica de onde vem o custo de um item específico do pedido';

    public function handle(): int
    {
        $orderCode = $this->argument('order');
        $itemName = $this->option('item');

        $order = Order::where('code', $orderCode)->first();

        if (!$order) {
            $this->error("❌ Pedido {$orderCode} não encontrado");
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
        
        if ($orderItem->total_cost) {
            $this->line("   💰 Total Cost (do backend): R$ {$orderItem->total_cost}");
        }

        $this->newLine();

        // 1. Verificar ProductMapping do item principal
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
            foreach ($orderItem->add_ons as $index => $addOn) {
                $addOnName = $addOn['name'] ?? 'N/A';
                $addOnQty = $addOn['quantity'] ?? $addOn['qty'] ?? 1;
                $this->line("   [{$index}] {$addOnName} ({$addOnQty}x)");
            }
        }
    }
}
