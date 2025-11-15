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
        Schema::create('tax_categories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->onDelete('cascade');

            // Informações básicas
            $table->string('name');
            $table->string('sale_cfop', 10); // Ex: 5102
            $table->text('description')->nullable();

            // Identificação fiscal
            $table->string('icms_origin', 1); // 0-8
            $table->string('csosn_cst', 10); // Ex: 102, 500
            $table->string('ncm', 20)->nullable(); // Nomenclatura Comum do Mercosul

            // Tipo de cálculo de imposto
            $table->enum('tax_calculation_type', ['detailed', 'fixed', 'none'])->default('detailed');

            // Alíquotas detalhadas (quando tax_calculation_type = 'detailed')
            $table->decimal('iss_rate', 5, 2)->nullable(); // % ISS
            $table->decimal('icms_rate', 5, 2)->nullable(); // % ICMS
            $table->decimal('pis_rate', 5, 2)->nullable(); // % PIS
            $table->decimal('cofins_rate', 5, 2)->nullable(); // % COFINS

            // Configurações especiais
            $table->enum('pis_cofins_mode', ['normal', 'monofasico', 'isento'])->nullable();
            $table->boolean('icms_st')->default(false); // Substituição Tributária

            // Imposto fixo (quando tax_calculation_type = 'fixed')
            $table->decimal('fixed_tax_rate', 5, 2)->nullable(); // % total

            // Status
            $table->boolean('active')->default(true);

            $table->timestamps();

            // Índices
            $table->index(['tenant_id', 'active']);
            $table->index('name');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('tax_categories');
    }
};
