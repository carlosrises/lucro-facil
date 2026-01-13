<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class CheckProductValues extends Command
{
    protected $signature = 'products:check-values';

    protected $description = 'Check product values in database';

    public function handle()
    {
        $base = DB::table('internal_products')->where('id', 45)->first(['id', 'name', 'unit_cost']);
        $pizza = DB::table('internal_products')->where('id', 13)->first(['id', 'name', 'unit_cost']);

        $this->info('=== BANCO DE DADOS (sem cache) ===');
        $this->newLine();

        if ($base) {
            $this->line("Base 4 Queijos (ID {$base->id}):");
            $this->line("  unit_cost: R$ ".number_format($base->unit_cost, 2, ',', '.'));
        }

        $this->newLine();

        if ($pizza) {
            $this->line("Pizza 4 Queijos (ID {$pizza->id}):");
            $this->line("  unit_cost: R$ ".number_format($pizza->unit_cost, 2, ',', '.'));
        }

        $this->newLine();
        $this->line('Product Costs da Pizza:');

        $costs = DB::table('product_costs')
            ->where('internal_product_id', 13)
            ->get(['id', 'ingredient_id', 'qty', 'size']);

        $this->line("Total de custos: {$costs->count()}");

        foreach ($costs as $cost) {
            $this->line("  - Cost ID: {$cost->id} | ingredient_id: {$cost->ingredient_id} | qty: {$cost->qty} | size: ".($cost->size ?? 'null'));
        }

        $this->newLine();

        // Calcular CMV manualmente
        $totalCosts = DB::table('product_costs')
            ->where('internal_product_id', 13)
            ->get();

        $calculatedCmv = 0;
        foreach ($totalCosts as $cost) {
            $ingredient = DB::table('ingredients')->where('id', $cost->ingredient_id)->first();
            if ($ingredient) {
                $calculatedCmv += $cost->qty * $ingredient->unit_price;
            } else {
                $product = DB::table('internal_products')->where('id', $cost->ingredient_id)->first();
                if ($product) {
                    $calculatedCmv += $cost->qty * $product->unit_cost;
                    $this->line("  Usando produto: {$product->name} @ R$ ".number_format($product->unit_cost, 2, ',', '.'));
                }
            }
        }

        $this->line("CMV Calculado da Pizza: R$ ".number_format($calculatedCmv, 2, ',', '.'));
        $this->line("Diferença: R$ ".number_format(abs($pizza->unit_cost - $calculatedCmv), 2, ',', '.'));

        return 0;
    }
}
