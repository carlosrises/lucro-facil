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
        // Mapeia produto interno ao item do marketplace (ifood/takeat)
        Schema::create('product_mappings', function (Blueprint $t) {
            $t->id();
            $t->foreignId('tenant_id')->constrained()->cascadeOnDelete();

            $t->foreignId('internal_product_id')->constrained('internal_products')->cascadeOnDelete();
            $t->string('provider')->default('ifood'); // ifood | takeat
            $t->string('external_item_id')->index();  // id/código do item no provedor
            $t->string('external_item_name')->nullable();

            $t->timestamps();
            $t->unique(['tenant_id', 'provider', 'external_item_id', 'internal_product_id'], 'product_mappings_unique');
        });

        // Regras fixas de custo por bandeira (ajustáveis no futuro)
        Schema::create('payment_flag_rules', function (Blueprint $t) {
            $t->id();
            $t->foreignId('tenant_id')->constrained()->cascadeOnDelete();

            $t->enum('flag', ['CREDITO', 'PIX', 'TICKET_VR', 'DEBITO']);
            $t->decimal('fee_percent', 8, 4)->default(0);  // %
            $t->decimal('fee_fixed', 12, 4)->default(0);   // valor fixo opcional

            $t->timestamps();
            $t->unique(['tenant_id', 'flag']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('payment_flag_rules');
        Schema::dropIfExists('product_mappings');
    }
};
