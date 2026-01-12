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
        Schema::table('orders', function (Blueprint $table) {
            // Adicionar coluna para armazenar vínculos de taxas de pagamento por método
            // Estrutura: { "PIX": 123, "CREDIT_CARD": 124, ... }
            $table->json('payment_fee_links')->nullable()->after('calculated_costs');

            $table->index(['tenant_id', 'provider', 'origin'], 'orders_tenant_provider_origin_idx');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn('payment_fee_links');
            $table->dropIndex('orders_tenant_provider_origin_idx');
        });
    }
};
