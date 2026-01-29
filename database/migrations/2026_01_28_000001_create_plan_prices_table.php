<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('plan_prices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('plan_id')->constrained('plans')->cascadeOnDelete();
            $table->string('key');
            $table->string('label');
            $table->decimal('amount', 10, 2)->nullable();
            $table->string('interval')->nullable();
            $table->string('period_label')->nullable();
            $table->boolean('is_annual')->default(false);
            $table->string('stripe_price_id')->nullable();
            $table->boolean('active')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('plan_prices');
    }
};
