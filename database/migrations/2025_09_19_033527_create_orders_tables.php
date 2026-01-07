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
        Schema::create('orders', function (Blueprint $t) {
            $t->id();
            $t->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $t->foreignId('store_id')->nullable()->constrained()->nullOnDelete();

            $t->uuid('order_uuid');                     // UUID do pedido no provedor
            $t->string('provider')->default('ifood');   // ifood | takeat
            $t->string('status')->index();
            $t->string('code')->nullable();             // displayId/código visível
            $t->string('origin')->nullable();           // canal/origem

            $t->decimal('gross_total', 12, 2)->default(0);
            $t->decimal('discount_total', 12, 2)->default(0);
            $t->decimal('delivery_fee', 12, 2)->default(0);
            $t->decimal('tip', 12, 2)->default(0);
            $t->decimal('net_total', 12, 2)->default(0); // calculado via financial_events

            $t->timestamp('placed_at')->nullable();
            $t->json('raw')->nullable();
            $t->timestamps();

            $t->unique(['tenant_id', 'provider', 'order_uuid'], 'orders_unique');
            $t->index(['tenant_id', 'placed_at']);
        });

        Schema::create('order_items', function (Blueprint $t) {
            $t->id();
            $t->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $t->foreignId('order_id')->constrained()->cascadeOnDelete();

            $t->string('sku')->nullable();
            $t->string('name');
            $t->integer('qty');
            $t->decimal('unit_price', 12, 2);
            $t->decimal('total', 12, 2);
            $t->json('add_ons')->nullable(); // complementos/opcionais do pedido

            $t->timestamps();
            $t->index(['tenant_id', 'order_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('order_items');
        Schema::dropIfExists('orders');
    }
};
