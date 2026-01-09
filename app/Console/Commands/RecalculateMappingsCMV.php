<?php

namespace App\Console\Commands;

use App\Models\InternalProduct;
use App\Models\OrderItemMapping;
use Illuminate\Console\Command;

class RecalculateMappingsCMV extends Command
{
    protected $signature = 'mappings:recalculate-cmv
                            {--tenant= : ID do tenant específico}
                            {--order= : ID de um pedido específico}
                            {--dry-run : Apenas simular sem salvar}';

    protected $description = 'Recalcula o CMV dos mappings existentes aplicando CMV por tamanho onde aplicável';

    public function handle(): int
    {
        $tenantId = $this->option('tenant');
        $orderId = $this->option('order');
        $dryRun = $this->option('dry-run');

        if ($dryRun) {
            $this->warn('🔍 MODO DRY-RUN - Nenhuma alteração será salva');
            $this->newLine();
        }

        // Buscar mappings
        $query = OrderItemMapping::with(['orderItem', 'internalProduct']);

        if ($orderId) {
            $query->whereHas('orderItem', function ($q) use ($orderId) {
                $q->where('order_id', $orderId);
            });
        } elseif ($tenantId) {
            $query->where('tenant_id', $tenantId);
        }

        $mappings = $query->get();
        $this->info("📦 Encontrados {$mappings->count()} mappings para processar");
        $this->newLine();

        $updated = 0;
        $skipped = 0;
        $errors = 0;

        foreach ($mappings as $mapping) {
            try {
                $orderItem = $mapping->orderItem;
                $product = $mapping->internalProduct;

                if (!$orderItem || !$product) {
                    $skipped++;
                    continue;
                }

                // Calcular CMV correto
                $correctCMV = $this->calculateCorrectCMV($product, $orderItem);

                // Verificar se mudou
                $currentCMV = $mapping->unit_cost_override ?? $product->unit_cost;
                $changed = abs($correctCMV - $currentCMV) > 0.01;

                if ($changed) {
                    $this->line("✏️  Mapping #{$mapping->id} | Item: {$orderItem->name}");
                    $this->line("   Produto: {$product->name} ({$product->product_category})");
                    $this->line("   CMV atual: R$ " . number_format($currentCMV, 2, ',', '.'));
                    $this->line("   CMV correto: R$ " . number_format($correctCMV, 2, ',', '.'));

                    if (!$dryRun) {
                        $mapping->update(['unit_cost_override' => $correctCMV]);
                        $this->info("   ✅ Atualizado");
                    } else {
                        $this->comment("   ⏭️  Simulado");
                    }

                    $updated++;
                } else {
                    $skipped++;
                }
            } catch (\Exception $e) {
                $this->error("❌ Erro no mapping #{$mapping->id}: " . $e->getMessage());
                $errors++;
            }
        }

        $this->newLine();
        $this->info("✅ Processamento concluído:");
        $this->line("   Atualizados: {$updated}");
        $this->line("   Sem alteração: {$skipped}");
        $this->line("   Erros: {$errors}");

        return 0;
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

    /**
     * Calcular o CMV correto do produto baseado no tamanho
     */
    private function calculateCorrectCMV(InternalProduct $product, $orderItem): float
    {
        // Se não for sabor de pizza, usar unit_cost normal
        if ($product->product_category !== 'sabor_pizza') {
            return (float) $product->unit_cost;
        }

        // Detectar o tamanho do item pai
        $size = $this->detectPizzaSize($orderItem->name);

        // Se não detectou tamanho, usar unit_cost genérico
        if (!$size) {
            return (float) $product->unit_cost;
        }

        // Verificar se o produto tem ficha técnica
        $hasCosts = $product->costs()->exists();

        // Se tem ficha técnica, calcular CMV pelo tamanho
        if ($hasCosts) {
            return $product->calculateCMV($size);
        }

        // Se não tem ficha técnica mas tem cmv_by_size, usar ele
        if ($product->cmv_by_size && is_array($product->cmv_by_size) && isset($product->cmv_by_size[$size])) {
            return (float) $product->cmv_by_size[$size];
        }

        // Fallback: unit_cost genérico
        return (float) $product->unit_cost;
    }
}

