<?php

namespace App\Console\Commands;

use App\Models\InternalProduct;
use App\Models\ProductCost;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class RecalculateProductCosts extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'products:recalculate-costs {--tenant= : ID do tenant} {--product= : ID do produto específico}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Recalcula o CMV de todos os produtos que possuem ficha técnica';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $tenantId = $this->option('tenant');
        $productId = $this->option('product');

        if (! $tenantId) {
            $this->error('Por favor, informe o tenant ID usando --tenant=X');

            return 1;
        }

        $query = InternalProduct::where('tenant_id', $tenantId)
            ->whereHas('costs'); // Apenas produtos com ficha técnica

        if ($productId) {
            $query->where('id', $productId);
        }

        $products = $query->get();

        if ($products->isEmpty()) {
            $this->warn('Nenhum produto encontrado com ficha técnica.');

            return 0;
        }

        $this->info("Recalculando CMV de {$products->count()} produtos...");

        $updated = 0;
        $bar = $this->output->createProgressBar($products->count());

        DB::beginTransaction();
        try {
            foreach ($products as $product) {
                $oldCost = $product->unit_cost;
                $newCost = $product->calculateCMV();

                if (abs($oldCost - $newCost) > 0.01) {
                    $product->update(['unit_cost' => $newCost]);
                    $this->newLine();
                    $this->line("✓ {$product->name}: R$ ".number_format($oldCost, 2, ',', '.').' → R$ '.number_format($newCost, 2, ',', '.'));
                    $updated++;
                }

                $bar->advance();
            }

            DB::commit();
            $bar->finish();

            $this->newLine(2);
            $this->info("✓ Recalculo concluído! {$updated} produtos atualizados.");

            return 0;
        } catch (\Exception $e) {
            DB::rollBack();
            $this->error('Erro ao recalcular custos: '.$e->getMessage());

            return 1;
        }
    }
}
