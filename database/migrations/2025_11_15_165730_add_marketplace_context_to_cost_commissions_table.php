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
        Schema::table('cost_commissions', function (Blueprint $table) {
            $table->string('provider')->nullable()->after('tenant_id');
            $table->enum('applies_to', [
                'all_orders',
                'delivery_only',
                'pickup_only',
                'payment_method',
                'custom',
            ])->default('all_orders')->after('type');
            $table->string('condition_value')->nullable()->after('applies_to');

            $table->index(['tenant_id', 'provider', 'active']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('cost_commissions', function (Blueprint $table) {
            $table->dropIndex(['tenant_id', 'provider', 'active']);
            $table->dropColumn(['provider', 'applies_to', 'condition_value']);
        });
    }
};
