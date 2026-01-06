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
        Schema::table('internal_products', function (Blueprint $table) {
            $table->string('size', 20)->nullable()->after('product_category')->comment('Tamanho do produto (broto, media, grande, familia)');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('internal_products', function (Blueprint $table) {
            $table->dropColumn('size');
        });
    }
};
