<?php

use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Atualizar registros existentes: 'additional' -> 'optional'
        DB::table('product_mappings')
            ->where('item_type', 'additional')
            ->update(['item_type' => 'optional']);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Reverter: 'optional' -> 'additional'
        DB::table('product_mappings')
            ->where('item_type', 'optional')
            ->update(['item_type' => 'additional']);
    }
};
