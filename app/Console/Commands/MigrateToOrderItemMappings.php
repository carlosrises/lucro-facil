<?php

namespace App\Console\Commands;

use App\Models\InternalProduct;
use App\Models\OrderItem;
use App\Models\OrderItemMapping;
use App\Models\ProductMapping;
use Illuminate\Console\Command;

class MigrateToOrderItemMappings extends Command
{
    protected $signature = 'mappings:migrate-to-new-system
                            {--order= : ID de um pedido específico}
                            {--tenant= : ID do tenant}
                            {--dry-run : Apenas simular}';

    protected $description = 'Migra associações do sistema antigo (ProductMapping) para o novo (OrderItemMapping) com CMV por tamanho';

    public function handle(): int
    {
        $orderId = $this->option('order');
        $tenantId = $this->option('tenant');
        $dryRun = $this->option('dry-run');

        if ($dryRun) {
            $this->warn('🔍 MODO DRY-RUN - Nenhuma alteração será salva');
            $this->newLine();
        }

        // Buscar order_items que têm ProductMapping mas não têm OrderItemMapping
        $query = OrderItem::with(['productMapping.internalProduct'])
            ->whereHas('productMapping')
            ->whereDoesntHave('mappings');

        if ($orderId) {
            $query->where('order_id', $orderId);
        } elseif ($tenantId) {
            $query->where('tenant_id', $tenantId);
        }

        $orderItems = $query->get();

        $this->info("📦 Encontrados {$orderItems->count()} itens para migrar");
        $this->newLine();

        $migrated = 0;
        $skipped = 0;
        $errors = 0;

        foreach ($orderItems as $orderItem) {
            try {
                $productMapping = $orderItem->productMapping;
                
                if (!$productMapping || !$productMapping->internal_product_id) {
                    $skipped++;
                    continue;
                }

                $product = $productMapping->internalProduct;
                if (!$product) {
                    $skipped++;
                    continue;
                }

                // Calcular CMV correto por tamanho
                $correctCMV = $this->calculateCorrectCMV($product, $orderItem);

                $this->line("✏️  Item: {$orderItem->name}");
                $this->line("   Produto: {$product->name}");
                $this->line("   CMV: R$ " . number_format($correctCMV, 2, ',', '.'));

                if (!$dryRun) {
                    OrderItemMapping::create([
                        'tenant_id' => $orderItem->tenant_id,
                        'order_item_id' => $orderItem->id,
                        'internal_product_id' => $product->id,
                        'quantity' => 1.0,
                        'mapping_type' => 'main',
                        'option_type' => 'regular',
                        'auto_fraction' => false,
                        'unit_cost_override' => $correctCMV,
                    ]);
                    $this->info("   ✅ Migrado");
                } else {
                    $this->comment("   ⏭️  Simulado");
                }

                $migrated++;
            } catch (\Exception $e) {
                $this->error("❌ Erro no item #{$orderItem->id}: " . $e->getMessage());
                $errors++;
            }
        }

        $this->newLine();
        $this->info("✅ Migração concluída:");
        $this->line("   Migrados: {$migrated}");
        $this->line("   Ignorados: {$skipped}");
        $this->line("   Erros: {$errors}");

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

    private function calculateCorrectCMV(InternalProduct $product, OrderItem $orderItem): float
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
