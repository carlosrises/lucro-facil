<?php

use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Precisamos alterar a constraint única para incluir o campo size
        // Como a constraint pode estar sendo usada por FK, vamos usar SQL direto

        DB::statement('ALTER TABLE product_costs DROP INDEX product_costs_unique');
        DB::statement('ALTER TABLE product_costs ADD UNIQUE product_costs_unique (tenant_id, internal_product_id, ingredient_id, size)');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement('ALTER TABLE product_costs DROP INDEX product_costs_unique');
        DB::statement('ALTER TABLE product_costs ADD UNIQUE product_costs_unique (tenant_id, internal_product_id, ingredient_id)');
    }
};
