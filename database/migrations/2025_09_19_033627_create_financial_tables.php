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
        Schema::create('financial_events', function (Blueprint $t) {
            $t->id();
            $t->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $t->foreignId('store_id')->nullable()->constrained()->nullOnDelete();

            $t->string('provider')->default('ifood');
            $t->string('event_id');                     // id do evento no provedor
            $t->uuid('order_uuid')->nullable();         // quando o evento referencia pedido
            $t->string('type');                         // COMMISSION, DELIVERY_SHARE, PROMO_SUBSIDY, etc.
            $t->boolean('has_transfer_impact')->default(true);
            $t->decimal('amount', 12, 2);               // +crédito, -débito
            $t->string('currency', 3)->default('BRL');
            $t->timestamp('occurred_at')->index();
            $t->json('raw')->nullable();

            $t->timestamps();
            $t->unique(['tenant_id','provider','event_id'], 'financial_events_unique');
            $t->index(['tenant_id','order_uuid']);
        });

        Schema::create('settlements', function (Blueprint $t) {
            $t->id();
            $t->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $t->foreignId('store_id')->nullable()->constrained()->nullOnDelete();

            $t->string('provider')->default('ifood');
            $t->string('settlement_id')->index();
            $t->date('settlement_date')->index();
            $t->decimal('amount', 12, 2);
            $t->json('raw')->nullable();

            $t->timestamps();
            $t->unique(['tenant_id','provider','settlement_id'], 'settlements_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('settlements');
        Schema::dropIfExists('financial_events');
    }
};
