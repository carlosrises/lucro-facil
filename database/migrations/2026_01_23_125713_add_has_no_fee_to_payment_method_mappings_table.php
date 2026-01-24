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
            $table->boolean('has_no_fee')->default(false)->after('cost_commission_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('payment_method_mappings', function (Blueprint $table) {
            $table->dropColumn('has_no_fee');
        });
    }
};
