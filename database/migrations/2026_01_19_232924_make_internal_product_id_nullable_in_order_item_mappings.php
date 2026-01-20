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
        Schema::table('order_item_mappings', function (Blueprint $table) {
            // Remover a foreign key constraint
            $table->dropForeign(['internal_product_id']);

            // Alterar a coluna para nullable
            $table->foreignId('internal_product_id')->nullable()->change();

            // Re-adicionar a foreign key constraint (agora com nullable)
            $table->foreign('internal_product_id')
                ->references('id')
                ->on('internal_products')
                ->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('order_item_mappings', function (Blueprint $table) {
            // Remover a foreign key constraint
            $table->dropForeign(['internal_product_id']);

            // Deletar mappings com internal_product_id null antes de voltar
            \DB::table('order_item_mappings')->whereNull('internal_product_id')->delete();

            // Reverter para NOT NULL
            $table->foreignId('internal_product_id')->nullable(false)->change();

            // Re-adicionar a foreign key constraint com cascade
            $table->foreign('internal_product_id')
                ->references('id')
                ->on('internal_products')
                ->cascadeOnDelete();
        });
    }
};
