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
            // Dropar o índice único antigo
            $table->dropUnique('product_costs_unique');
            
            // Criar o novo índice único incluindo o campo size
            $table->unique(['tenant_id', 'internal_product_id', 'ingredient_id', 'size'], 'product_costs_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('product_costs', function (Blueprint $table) {
            // Dropar o índice único com size
            $table->dropUnique('product_costs_unique');
            
            // Recriar o índice único original sem size
            $table->unique(['tenant_id', 'internal_product_id', 'ingredient_id'], 'product_costs_unique');
        });
    }
};
