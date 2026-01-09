<?php

namespace App\Console\Commands;

use App\Models\Order;
use App\Models\ProductMapping;
use Illuminate\Console\Command;

class DiagnoseOrderMappings extends Command
{
    protected $signature = 'orders:diagnose-mappings {order : ID do pedido}';
    protected $description = 'Mostra item principal + add-ons igual ao frontend';

    public function handle(): int
    {
        $orderId = $this->argument('order');
        $order = Order::with(['items.mappings.internalProduct', 'store'])->find($orderId);

        if (!$order) {
            $this->error("❌ Pedido #{$orderId} não encontrado");
            return 1;
        }

        $this->info("📦 Pedido: {$order->code} | Provider: {$order->provider}");
        $storeName = $order->store ? $order->store->name : 'N/A';
        $this->info("🏪 Loja: {$storeName}");
        $this->newLine();

        foreach ($order->items as $orderItem) {
            $this->line("═══════════════════════════════════════════════");
            $this->info("🔹 Item: {$orderItem->name}");
            $this->line("   SKU: {$orderItem->sku}");
            $this->line("   Quantidade: " . ($orderItem->qty ?? $orderItem->quantity ?? 1));

            $size = $this->detectPizzaSize($orderItem->name);
            if ($size) {
                $this->line("   🍕 Tamanho: {$size}");
            }
            $this->newLine();

            $totalCost = 0;

            // 1. Item principal (OrderItemMapping tipo 'main')
            $mainMappings = $orderItem->mappings()->where('mapping_type', 'main')->get();
            if ($mainMappings->isNotEmpty()) {
                foreach ($mainMappings as $mapping) {
                    $product = $mapping->internalProduct;
                    $this->line("   📌 Item Principal");
                    $this->line("      → {$product->name}");
                    $this->line("      → unit_cost: R$ " . number_format((float)$product->unit_cost, 2, ',', '.'));
                    if ($mapping->unit_cost_override) {
                        $this->line("      → override: R$ " . number_format($mapping->unit_cost_override, 2, ',', '.'));
                    }
                    $cost = $mapping->calculateCost();
                    $totalCost += $cost;
                    $this->info("      💰 R$ " . number_format($cost, 2, ',', '.'));
                    $this->newLine();
                }
            }

            // 2. Add-ons (sabores, refrigerantes, etc)
            if ($orderItem->add_ons && is_array($orderItem->add_ons) && count($orderItem->add_ons) > 0) {
                // Contar sabores classificados
                $classifiedFlavors = 0;
                foreach ($orderItem->add_ons as $addOn) {
                    $name = $addOn['name'] ?? '';
                    if (!$name) continue;
                    $sku = 'addon_'.md5($name);
                    $pm = ProductMapping::where('tenant_id', $orderItem->tenant_id)
                        ->where('external_item_id', $sku)
                        ->where('item_type', 'flavor')
                        ->first();
                    if ($pm) $classifiedFlavors++;
                }

                $fraction = $classifiedFlavors > 0 ? (1.0 / $classifiedFlavors) : 1.0;

                foreach ($orderItem->add_ons as $index => $addOn) {
                    $name = $addOn['name'] ?? '';
                    $qty = $addOn['quantity'] ?? $addOn['qty'] ?? 1;
                    if (!$name) continue;

                    $this->line("   ├─ [{$index}] {$name} ({$qty}x)");

                    $sku = 'addon_'.md5($name);
                    $pm = ProductMapping::where('tenant_id', $orderItem->tenant_id)
                        ->where('external_item_id', $sku)
                        ->first();

                    if (!$pm) {
                        $this->warn("      ❌ Não classificado");
                        continue;
                    }

                    $this->line("      ✅ {$pm->item_type}");

                    if (!$pm->internalProduct) {
                        $this->warn("      ❌ Sem produto CMV");
                        continue;
                    }

                    $product = $pm->internalProduct;
                    $this->line("      → {$product->name}");

                    $unitCost = (float) $product->unit_cost;

                    // Sabor de pizza: usar CMV por tamanho
                    if ($pm->item_type === 'flavor' && $size) {
                        if ($product->cmv_by_size && isset($product->cmv_by_size[$size])) {
                            $cmvBySize = $product->cmv_by_size[$size];
                            $this->line("      → unit_cost: R$ " . number_format($unitCost, 2, ',', '.'));
                            $this->line("      → CMV {$size}: R$ " . number_format($cmvBySize, 2, ',', '.'));
                            $this->line("      → Fração: 1/{$classifiedFlavors} = " . number_format($fraction * 100, 1) . "%");
                            $unitCost = $cmvBySize;
                        }
                        $cost = $unitCost * $fraction * $qty;
                    } else {
                        $this->line("      → unit_cost: R$ " . number_format($unitCost, 2, ',', '.'));
                        $cost = $unitCost * $qty;
                    }

                    $totalCost += $cost;
                    $this->info("      💰 R$ " . number_format($cost, 2, ',', '.'));
                }
                $this->newLine();
            }

            $this->line("   ═══════════════════════════════════════════════");
            $this->info("   💵 TOTAL: R$ " . number_format($totalCost, 2, ',', '.'));

            $calculated = $orderItem->calculateTotalCost();
            $this->info("   💵 OrderItem::calculateTotalCost(): R$ " . number_format($calculated, 2, ',', '.'));

            if (abs($totalCost - $calculated) > 0.01) {
                $this->error("   ⚠️  DIFERENÇA: R$ " . number_format(abs($totalCost - $calculated), 2, ',', '.'));
            }
            $this->newLine();
        }

        return 0;
    }

    private function detectPizzaSize(string $itemName): ?string
    {
        $lower = mb_strtolower($itemName);
        if (preg_match('/\bbroto\b/', $lower)) return 'broto';
        if (preg_match('/\bgrande\b/', $lower)) return 'grande';
        if (preg_match('/\b(familia|big|don|70x35)\b/', $lower)) return 'familia';
        if (preg_match('/\b(media|média|m\b)/', $lower)) return 'media';
        return null;
    }
}
