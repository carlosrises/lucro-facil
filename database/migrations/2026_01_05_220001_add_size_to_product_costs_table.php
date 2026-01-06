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
        Schema::table('product_costs', function (Blueprint $table) {
            $table->string('size', 20)->nullable()->after('qty')->comment('Tamanho específico desta ficha técnica (broto, media, grande, familia)');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('product_costs', function (Blueprint $table) {
            $table->dropColumn('size');
        });
    }
};
