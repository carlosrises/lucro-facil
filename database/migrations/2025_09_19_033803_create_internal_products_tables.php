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
        Schema::create('internal_products', function (Blueprint $t) {
            $t->id();
            $t->foreignId('tenant_id')->constrained()->cascadeOnDelete();

            $t->string('sku')->nullable()->index();
            $t->string('name');
            $t->string('category')->nullable();
            $t->decimal('default_margin_percent', 8, 2)->default(0); // margem padrão %
            $t->decimal('default_margin_value', 12, 2)->default(0);  // margem fixa opcional
            $t->boolean('active')->default(true);

            $t->timestamps();
            $t->unique(['tenant_id', 'sku']);
        });

        Schema::create('ingredients', function (Blueprint $t) {
            $t->id();
            $t->foreignId('tenant_id')->constrained()->cascadeOnDelete();

            $t->string('name');
            $t->string('unit')->default('UN'); // UN, KG, L, etc.
            $t->decimal('unit_cost', 12, 4)->default(0); // custo por unidade
            $t->boolean('active')->default(true);

            $t->timestamps();
            $t->unique(['tenant_id', 'name', 'unit'], 'ingredients_unique');
        });

        // Relação N:N produto ↔ ingredientes + quantidade por produto
        Schema::create('product_costs', function (Blueprint $t) {
            $t->id();
            $t->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $t->foreignId('internal_product_id')->constrained('internal_products')->cascadeOnDelete();
            $t->foreignId('ingredient_id')->constrained('ingredients')->cascadeOnDelete();

            $t->decimal('qty', 12, 4)->default(0); // quanto de ingrediente por produto
            $t->timestamps();

            $t->unique(['tenant_id', 'internal_product_id', 'ingredient_id'], 'product_costs_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('product_costs');
        Schema::dropIfExists('ingredients');
        Schema::dropIfExists('internal_products');
    }
};
