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
            $table->enum('delivery_by', ['all', 'store', 'marketplace'])
                ->default('all')
                ->after('applies_to')
                ->comment('Quem realiza o delivery: all (todos), store (loja), marketplace');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('cost_commissions', function (Blueprint $table) {
            $table->dropColumn('delivery_by');
        });
    }
};
