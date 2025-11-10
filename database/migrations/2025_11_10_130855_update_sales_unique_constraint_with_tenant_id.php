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
            // Remove a constraint UNIQUE antiga (apenas sale_uuid)
            $table->dropUnique('sales_sale_uuid_unique');

            // Adiciona nova constraint UNIQUE composta (tenant_id + sale_uuid)
            $table->unique(['tenant_id', 'sale_uuid'], 'sales_tenant_sale_uuid_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            // Remove a constraint composta
            $table->dropUnique('sales_tenant_sale_uuid_unique');

            // Restaura a constraint antiga
            $table->unique('sale_uuid', 'sales_sale_uuid_unique');
        });
    }
};
