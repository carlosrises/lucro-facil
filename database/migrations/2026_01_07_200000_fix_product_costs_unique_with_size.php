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
        Schema::table('product_costs', function (Blueprint $table) {
            // 1. Verificar se já existe o campo size (da migration 2026_01_05_220001)
            $hasSizeColumn = Schema::hasColumn('product_costs', 'size');
            
            // 2. Dropar as foreign keys que dependem das colunas do índice único
            $table->dropForeign(['tenant_id']);
            $table->dropForeign(['internal_product_id']);
            $table->dropForeign(['ingredient_id']);

            // 3. Dropar o índice único antigo
            $table->dropUnique('product_costs_unique');

            // 4. Adicionar o campo size se não existir (da migration add_size_to_product_costs)
            if (! $hasSizeColumn) {
                $table->string('size', 20)->nullable()->after('qty')->comment('Tamanho específico desta ficha técnica (broto, media, grande, familia)');
            }

            // 5. Criar o novo índice único incluindo size
            $table->unique(['tenant_id', 'internal_product_id', 'ingredient_id', 'size'], 'product_costs_unique');

            // 6. Recriar apenas as foreign keys tenant_id e internal_product_id
            // (ingredient_id não tem mais FK porque pode referenciar ingredients OU internal_products)
            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $table->foreign('internal_product_id')->references('id')->on('internal_products')->cascadeOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('product_costs', function (Blueprint $table) {
            // 1. Dropar as foreign keys
            $table->dropForeign(['tenant_id']);
            $table->dropForeign(['internal_product_id']);

            // 2. Dropar o índice único com size
            $table->dropUnique('product_costs_unique');

            // 3. Remover o campo size
            if (Schema::hasColumn('product_costs', 'size')) {
                $table->dropColumn('size');
            }

            // 4. Recriar o índice único original sem size
            $table->unique(['tenant_id', 'internal_product_id', 'ingredient_id'], 'product_costs_unique');

            // 5. Recriar as foreign keys originais (incluindo ingredient_id)
            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $table->foreign('internal_product_id')->references('id')->on('internal_products')->cascadeOnDelete();
            $table->foreign('ingredient_id')->references('id')->on('ingredients')->cascadeOnDelete();
        });
    }
};
