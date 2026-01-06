<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Precisamos dropar as FKs que dependem da constraint única
        // Depois alterar a constraint para incluir o campo size
        // E então recriar as FKs

        // 1. Dropar FKs
        Schema::table('product_costs', function (Blueprint $table) {
            $table->dropForeign(['tenant_id']);
            $table->dropForeign(['internal_product_id']);
            $table->dropForeign(['ingredient_id']);
        });

        // 2. Dropar e recriar constraint única incluindo size
        DB::statement('ALTER TABLE product_costs DROP INDEX product_costs_unique');
        DB::statement('ALTER TABLE product_costs ADD UNIQUE product_costs_unique (tenant_id, internal_product_id, ingredient_id, size)');

        // 3. Recriar FKs
        Schema::table('product_costs', function (Blueprint $table) {
            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
            $table->foreign('internal_product_id')->references('id')->on('internal_products')->onDelete('cascade');
            $table->foreign('ingredient_id')->references('id')->on('ingredients')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Reverter: dropar FKs, recriar constraint sem size, recriar FKs

        Schema::table('product_costs', function (Blueprint $table) {
            $table->dropForeign(['tenant_id']);
            $table->dropForeign(['internal_product_id']);
            $table->dropForeign(['ingredient_id']);
        });

        DB::statement('ALTER TABLE product_costs DROP INDEX product_costs_unique');
        DB::statement('ALTER TABLE product_costs ADD UNIQUE product_costs_unique (tenant_id, internal_product_id, ingredient_id)');

        Schema::table('product_costs', function (Blueprint $table) {
            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
            $table->foreign('internal_product_id')->references('id')->on('internal_products')->onDelete('cascade');
            $table->foreign('ingredient_id')->references('id')->on('ingredients')->onDelete('cascade');
        });
    }
};
