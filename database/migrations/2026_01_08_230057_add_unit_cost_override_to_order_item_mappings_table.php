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
        Schema::table('order_item_mappings', function (Blueprint $table) {
            $table->decimal('unit_cost_override', 10, 4)->nullable()->after('quantity')
                ->comment('CMV específico calculado no momento da criação (ex: CMV por tamanho de pizza)');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('order_item_mappings', function (Blueprint $table) {
            $table->dropColumn('unit_cost_override');
        });
    }
};
