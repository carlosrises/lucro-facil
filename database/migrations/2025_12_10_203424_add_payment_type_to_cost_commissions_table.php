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
            // Mudar condition_value de string para JSON para suportar múltiplos valores
            $table->json('condition_values')->nullable()->after('condition_value');

            // Adicionar payment_type (online/offline/all)
            $table->enum('payment_type', ['all', 'online', 'offline'])->default('all')->after('applies_to');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('cost_commissions', function (Blueprint $table) {
            $table->dropColumn(['condition_values', 'payment_type']);
        });
    }
};
