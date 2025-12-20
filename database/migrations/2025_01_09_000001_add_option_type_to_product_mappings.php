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
            // Tipo da opção: pizza_flavor, regular, addon, observation, drink
            $table->string('option_type', 50)->nullable()->after('mapping_type');

            // Se deve calcular fração automaticamente com base no número de pizza_flavors
            $table->boolean('auto_fraction')->default(false)->after('option_type');

            // Notas/observações sobre o mapeamento
            $table->text('notes')->nullable()->after('auto_fraction');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('order_item_mappings', function (Blueprint $table) {
            $table->dropColumn(['option_type', 'auto_fraction', 'notes']);
        });
    }
};
