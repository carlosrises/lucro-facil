<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('product_mappings', function (Blueprint $table) {
            // Remover a foreign key constraint
            $table->dropForeign(['internal_product_id']);

            // Tornar a coluna nullable
            $table->foreignId('internal_product_id')->nullable()->change();

            // Recriar a foreign key constraint
            $table->foreign('internal_product_id')
                ->references('id')
                ->on('internal_products')
                ->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('product_mappings', function (Blueprint $table) {
            // Remover a foreign key constraint
            $table->dropForeign(['internal_product_id']);

            // Tornar a coluna NOT NULL novamente
            $table->foreignId('internal_product_id')->nullable(false)->change();

            // Recriar a foreign key constraint
            $table->foreign('internal_product_id')
                ->references('id')
                ->on('internal_products')
                ->cascadeOnDelete();
        });
    }
};
