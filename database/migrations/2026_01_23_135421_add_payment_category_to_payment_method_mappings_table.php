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
        Schema::table('payment_method_mappings', function (Blueprint $table) {
            // Categoria: payment (normal), subsidy (subsídio), cashback (desconto)
            $table->string('payment_category', 20)->default('payment')->after('has_no_fee');
            $table->index(['tenant_id', 'payment_category'], 'pm_mappings_tenant_category_idx');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('payment_method_mappings', function (Blueprint $table) {
            $table->dropIndex('pm_mappings_tenant_category_idx');
            $table->dropColumn('payment_category');
        });
    }
};
