<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('internal_products', function (Blueprint $table) {
            // Adicionar tipo (produto ou serviço) se não existir
            if (! Schema::hasColumn('internal_products', 'type')) {
                $table->enum('type', ['product', 'service'])->default('product')->after('name');
            }

            // Adicionar unidade de medida se não existir
            if (! Schema::hasColumn('internal_products', 'unit')) {
                $table->string('unit')->default('unit')->after('type');
            }

            // Adicionar custo unitário calculado (CMV) e preço de venda se não existirem
            if (! Schema::hasColumn('internal_products', 'unit_cost')) {
                $table->decimal('unit_cost', 12, 2)->default(0)->after('unit');
            }
            if (! Schema::hasColumn('internal_products', 'sale_price')) {
                $table->decimal('sale_price', 12, 2)->default(0)->after('unit_cost');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('internal_products', function (Blueprint $table) {
            $columns = ['type', 'unit', 'unit_cost', 'sale_price'];
            foreach ($columns as $column) {
                if (Schema::hasColumn('internal_products', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
