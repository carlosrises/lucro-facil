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
            // Remover a foreign key constraint do ingredient_id
            $table->dropForeign(['ingredient_id']);

            // Manter o campo como integer index
            // Agora ele pode referenciar tanto ingredients quanto internal_products
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('product_costs', function (Blueprint $table) {
            // Recriar a foreign key constraint
            $table->foreign('ingredient_id')
                ->references('id')
                ->on('ingredients')
                ->cascadeOnDelete();
        });
    }
};
