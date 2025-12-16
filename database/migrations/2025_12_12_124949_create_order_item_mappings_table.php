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
        Schema::create('order_item_mappings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('order_item_id')->constrained()->cascadeOnDelete();
            $table->foreignId('internal_product_id')->constrained()->cascadeOnDelete();

            // Quantidade/fração (1.0 = 100%, 0.25 = 25%, etc)
            $table->decimal('quantity', 10, 4)->default(1.0);

            // Tipo de associação: 'main' (item principal), 'option' (opção/escolha), 'addon' (complemento)
            $table->enum('mapping_type', ['main', 'option', 'addon'])->default('main');

            // Referência ao item externo (id do complemento/opção no raw do pedido)
            $table->string('external_reference')->nullable();
            $table->string('external_name')->nullable(); // Nome do complemento/opção para referência

            $table->timestamps();

            // Índices para melhor performance
            $table->index(['order_item_id', 'mapping_type']);
            $table->index('tenant_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('order_item_mappings');
    }
};
