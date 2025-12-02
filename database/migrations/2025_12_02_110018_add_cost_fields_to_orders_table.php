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
            $table->json('calculated_costs')->nullable()->after('net_total');
            $table->decimal('total_costs', 10, 2)->default(0)->after('calculated_costs');
            $table->decimal('total_commissions', 10, 2)->default(0)->after('total_costs');
            $table->decimal('net_revenue', 10, 2)->nullable()->after('total_commissions');
            $table->timestamp('costs_calculated_at')->nullable()->after('net_revenue');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['calculated_costs', 'total_costs', 'total_commissions', 'net_revenue', 'costs_calculated_at']);
        });
    }
};
