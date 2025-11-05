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
        Schema::create('plans', function (Blueprint $t) {
            $t->id();
            $t->string('code')->unique();   // ex.: start, pro, enterprise
            $t->string('name');
            $t->decimal('price_month', 10, 2)->default(0);
            $t->integer('max_stores')->default(1);
            $t->integer('retention_days')->default(365);
            $t->boolean('reports_advanced')->default(false);
            $t->json('features')->nullable();
            $t->timestamps();
        });

        Schema::create('subscriptions', function (Blueprint $t) {
            $t->id();
            $t->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $t->foreignId('plan_id')->constrained('plans')->restrictOnDelete();

            $t->enum('status', ['active','trialing','past_due','canceled'])->default('active');
            $t->date('started_on')->nullable();
            $t->date('ends_on')->nullable();
            $t->json('gateway_payload')->nullable(); // webhook/gateway data
            $t->timestamps();

            $t->index(['tenant_id','status']);
        });

        Schema::create('tickets', function (Blueprint $t) {
            $t->id();
            $t->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $t->foreignId('user_id')->nullable()->constrained()->nullOnDelete();

            $t->string('subject');
            $t->enum('priority', ['low','medium','high'])->default('low');
            $t->enum('status', ['open','in_progress','closed'])->default('open');
            $t->timestamps();

            $t->index(['tenant_id','status','priority']);
        });

        Schema::create('ticket_messages', function (Blueprint $t) {
            $t->id();
            $t->foreignId('ticket_id')->constrained('tickets')->cascadeOnDelete();
            $t->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $t->text('message');
            $t->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ticket_messages');
        Schema::dropIfExists('tickets');
        Schema::dropIfExists('subscriptions');
        Schema::dropIfExists('plans');
    }
};
