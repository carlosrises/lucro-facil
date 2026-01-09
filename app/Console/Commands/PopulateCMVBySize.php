<?php

namespace App\Console\Commands;

use App\Models\InternalProduct;
use Illuminate\Console\Command;

class PopulateCMVBySize extends Command
{
    protected $signature = 'products:populate-cmv-by-size
                            {--product= : ID de um produto específico}
                            {--dry-run : Apenas simular}';

    protected $description = 'Popula cmv_by_size dos produtos sabor_pizza com valores da ficha técnica';

    public function handle(): int
    {
        $productId = $this->option('product');
        $dryRun = $this->option('dry-run');

        if ($dryRun) {
            $this->warn('🔍 MODO DRY-RUN - Nenhuma alteração será salva');
            $this->newLine();
        }

        $query = InternalProduct::where('product_category', 'sabor_pizza')
            ->whereHas('costs');

        if ($productId) {
            $query->where('id', $productId);
        }

        $products = $query->get();
        $this->info("📦 Encontrados {$products->count()} produtos sabor_pizza com ficha técnica");
        $this->newLine();

        $updated = 0;
        $skipped = 0;

        foreach ($products as $product) {
            $this->line("🍕 {$product->name}");
            
            $sizes = ['broto', 'media', 'grande', 'familia'];
            $cmvBySize = [];
            $hasAnyCost = false;

            foreach ($sizes as $size) {
                $cmv = $product->calculateCMV($size);
                
                if ($cmv > 0) {
                    $cmvBySize[$size] = $cmv;
                    $hasAnyCost = true;
                    $this->line("   → {$size}: R$ " . number_format($cmv, 2, ',', '.'));
                }
            }

            if (!$hasAnyCost) {
                $this->warn("   ⚠️  Sem custos calculados");
                $skipped++;
                continue;
            }

            // Comparar com o atual
            $currentCmvBySize = $product->cmv_by_size;
            if ($currentCmvBySize == $cmvBySize) {
                $this->comment("   ✓ Já está atualizado");
                $skipped++;
            } else {
                if (!$dryRun) {
                    $product->update(['cmv_by_size' => $cmvBySize]);
                    $this->info("   ✅ Atualizado");
                } else {
                    $this->comment("   ⏭️  Simulado");
                }
                $updated++;
            }

            $this->newLine();
        }

        $this->info("✅ Processamento concluído:");
        $this->line("   Atualizados: {$updated}");
        $this->line("   Sem alteração: {$skipped}");

        return 0;
    }
}
