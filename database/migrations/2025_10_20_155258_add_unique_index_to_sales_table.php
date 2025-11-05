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
        Schema::table('sales', function (Blueprint $table) {
            // Índice único composto: garante que não haverá duplicação
            // mesmo que o comando seja executado múltiplas vezes
            $table->unique(['tenant_id', 'store_id', 'sale_uuid'], 'sales_unique_per_tenant_store');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->dropUnique('sales_unique_per_tenant_store');
        });
    }
};
