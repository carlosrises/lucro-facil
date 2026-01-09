<?php

namespace App\Console\Commands;

use App\Models\Order;
use Illuminate\Console\Command;

class DiagnoseOrderMappings extends Command
{
    protected $signature = 'orders:diagnose-mappings {order : ID do pedido}';

    protected $description = 'Mostra todos os mappings de um pedido com detalhes de CMV';

    public function handle(): int
    {
        $orderId = $this->argument('order');
        $order = Order::with(['items.mappings.internalProduct'])->find($orderId);

        if (!$order) {
            $this->error("❌ Pedido #{$orderId} não encontrado");
            return 1;
        }

        $this->info("📦 Pedido: {$order->code} | Provider: {$order->provider}");
        $this->info("🏪 Loja: {$order->store->name}");
        $this->newLine();

        foreach ($order->items as $orderItem) {
            $this->line("═══════════════════════════════════════════════");
            $this->info("🔹 Item: {$orderItem->name}");
            $this->line("   SKU: {$orderItem->sku}");
            $this->line("   Quantidade: {$orderItem->quantity}");
            
            // Detectar tamanho
            $size = $this->detectPizzaSize($orderItem->name);
            if ($size) {
                $this->line("   🍕 Tamanho detectado: {$size}");
            }
            
            $this->newLine();

            // Mostrar mappings
            $mappings = $orderItem->mappings;
            
            if ($mappings->isEmpty()) {
                $this->warn("   ⚠️  SEM MAPPINGS - Item não foi associado no novo sistema");
                $this->newLine();
                continue;
            }

            $totalCost = 0;
            
            foreach ($mappings as $mapping) {
                $product = $mapping->internalProduct;
                
                $this->line("   📌 Mapping #{$mapping->id}");
                $this->line("      Tipo: {$mapping->mapping_type}");
                $this->line("      Produto: {$product->name} (categoria: {$product->product_category})");
                $this->line("      Quantidade no mapping: {$mapping->quantity}");
                
                // Mostrar unit_cost vs unit_cost_override
                $productUnitCost = (float) $product->unit_cost;
                $overrideCost = $mapping->unit_cost_override;
                
                $this->line("      ├─ unit_cost do produto: R$ " . number_format($productUnitCost, 2, ',', '.'));
                
                if ($overrideCost !== null) {
                    $this->line("      ├─ unit_cost_override: R$ " . number_format($overrideCost, 2, ',', '.'));
                    $usedCost = $overrideCost;
                } else {
                    $this->warn("      ├─ unit_cost_override: NULL (usando unit_cost do produto)");
                    $usedCost = $productUnitCost;
                }
                
                // Se for sabor de pizza, mostrar CMV por tamanho disponível
                if ($product->product_category === 'sabor_pizza' && $size) {
                    $this->line("      ├─ CMV disponível por tamanho:");
                    
                    if ($product->cmv_by_size && is_array($product->cmv_by_size)) {
                        foreach ($product->cmv_by_size as $s => $cmv) {
                            $marker = ($s === $size) ? '👉' : '  ';
                            $this->line("      │  {$marker} {$s}: R$ " . number_format($cmv, 2, ',', '.'));
                        }
                    } else {
                        $this->warn("      │  ❌ Produto não tem cmv_by_size configurado");
                    }
                    
                    // Calcular o que DEVERIA ser
                    $correctCMV = $this->calculateCorrectCMV($product, $orderItem);
                    $this->line("      └─ CMV CORRETO para {$size}: R$ " . number_format($correctCMV, 2, ',', '.'));
                    
                    if (abs($usedCost - $correctCMV) > 0.01) {
                        $this->error("      ⚠️  CMV INCORRETO! Diferença: R$ " . number_format($usedCost - $correctCMV, 2, ',', '.'));
                    }
                }
                
                // Calcular custo total deste mapping
                $mappingCost = $usedCost * $mapping->quantity * $orderItem->quantity;
                $totalCost += $mappingCost;
                
                $this->line("      💰 Custo deste mapping: R$ " . number_format($mappingCost, 2, ',', '.'));
                $this->newLine();
            }
            
            $this->info("   💵 TOTAL do item: R$ " . number_format($totalCost, 2, ',', '.'));
            $this->newLine();
        }

        return 0;
    }

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

    private function calculateCorrectCMV($product, $orderItem): float
    {
        if ($product->product_category !== 'sabor_pizza') {
            return (float) $product->unit_cost;
        }

        $size = $this->detectPizzaSize($orderItem->name);
        if (!$size) {
            return (float) $product->unit_cost;
        }

        $hasCosts = $product->costs()->exists();
        if ($hasCosts) {
            return $product->calculateCMV($size);
        }

        if ($product->cmv_by_size && is_array($product->cmv_by_size) && isset($product->cmv_by_size[$size])) {
            return (float) $product->cmv_by_size[$size];
        }

        return (float) $product->unit_cost;
    }
}
