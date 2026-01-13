<?php

namespace App\Console\Commands;

use App\Models\Ingredient;
use App\Models\InternalProduct;
use Illuminate\Console\Command;

class DebugProductCosts extends Command
{
    protected $signature = 'products:debug-costs {product_id}';

    protected $description = 'Debug product costs calculation';

    public function handle()
    {
        $productId = $this->argument('product_id');
        $product = InternalProduct::find($productId);

        if (! $product) {
            $this->error('Produto não encontrado');

            return 1;
        }

        $this->info("=== {$product->name} (ID: {$product->id}) ===");
        $this->line('unit_cost ATUAL: R$ '.number_format($product->unit_cost, 2, ',', '.'));
        $this->newLine();

        $this->info('Ficha Técnica:');
        $calculatedTotal = 0;

        foreach ($product->costs as $cost) {
            // Buscar direto do banco sem cache
            $ing = Ingredient::where('id', $cost->ingredient_id)->first();

            if ($ing) {
                $subtotal = $cost->qty * $ing->unit_price;
                $calculatedTotal += $subtotal;
                $this->line(sprintf('  [ING] %s (ID:%d): %.4f x R$ %.4f = R$ %.2f', $ing->name, $ing->id, $cost->qty, $ing->unit_price, $subtotal));
            } else {
                $prod = InternalProduct::where('id', $cost->ingredient_id)->first();
                if ($prod) {
                    $subtotal = $cost->qty * $prod->unit_cost;
                    $calculatedTotal += $subtotal;
                    $this->line(sprintf('  [PROD] %s (ID:%d): %.4f x R$ %.2f = R$ %.2f', $prod->name, $prod->id, $cost->qty, $prod->unit_cost, $subtotal));
                }
            }
        }

        $this->newLine();
        $this->line('CMV CALCULADO MANUAL: R$ '.number_format($calculatedTotal, 2, ',', '.'));
        $this->line('CMV via calculateCMV(): R$ '.number_format($product->calculateCMV(), 2, ',', '.'));
        $this->line('Diferença: R$ '.number_format(abs($calculatedTotal - $product->unit_cost), 2, ',', '.'));

        if (abs($calculatedTotal - $product->unit_cost) > 0.01) {
            $this->newLine();
            $this->warn('⚠️  CMV precisa ser atualizado!');

            if ($this->confirm('Deseja atualizar o CMV agora?', true)) {
                $product->update(['unit_cost' => $calculatedTotal]);
                $this->info('✓ CMV atualizado para R$ '.number_format($calculatedTotal, 2, ',', '.'));
            }
        } else {
            $this->newLine();
            $this->info('✓ CMV está correto!');
        }

        return 0;
    }
}
