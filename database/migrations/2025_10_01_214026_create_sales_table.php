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
        Schema::create('sales', function (Blueprint $table) {
            $table->id();

            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('store_id');

            $table->uuid('sale_uuid')->unique(); // id do sale (UUID do iFood)
            $table->string('short_id')->nullable();

            $table->string('type')->nullable();
            $table->string('category')->nullable();
            $table->string('sales_channel')->nullable();
            $table->string('current_status')->nullable();

            // Valores principais
            $table->decimal('bag_value', 10, 2)->nullable();
            $table->decimal('delivery_fee', 10, 2)->nullable();
            $table->decimal('service_fee', 10, 2)->nullable();

            $table->decimal('gross_value', 10, 2)->nullable();
            $table->decimal('discount_value', 10, 2)->nullable();
            $table->decimal('net_value', 10, 2)->nullable();

            // Pagamento principal
            $table->string('payment_method')->nullable();
            $table->string('payment_brand')->nullable();
            $table->decimal('payment_value', 10, 2)->nullable();
            $table->string('payment_liability')->nullable();

            // Datas
            $table->timestamp('sale_created_at')->nullable();
            $table->timestamp('concluded_at')->nullable();
            $table->date('expected_payment_date')->nullable();

            // Dados completos em JSON
            $table->json('raw')->nullable();

            $table->timestamps();

            $table->index(['tenant_id', 'store_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('sales');
    }
};
