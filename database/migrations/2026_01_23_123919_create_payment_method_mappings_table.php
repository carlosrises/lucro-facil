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
        Schema::create('payment_method_mappings', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->string('external_payment_method_id'); // ID do payment_method (ex: 572)
            $table->string('payment_method_name'); // Nome original (ex: "Pagamento Online iFood")
            $table->string('payment_method_keyword')->nullable(); // Keyword (ex: "online_ifood")
            $table->unsignedBigInteger('cost_commission_id')->nullable(); // FK para cost_commissions
            $table->string('provider')->default('takeat'); // takeat, ifood, etc
            $table->timestamps();

            // Índices com nomes personalizados (MySQL tem limite de 64 caracteres)
            $table->index('tenant_id', 'pm_mappings_tenant_idx');
            $table->index(['tenant_id', 'external_payment_method_id'], 'pm_mappings_tenant_ext_id_idx');
            $table->index(['tenant_id', 'provider'], 'pm_mappings_tenant_provider_idx');

            // Foreign keys
            $table->foreign('tenant_id', 'pm_mappings_tenant_fk')->references('id')->on('tenants')->onDelete('cascade');
            $table->foreign('cost_commission_id', 'pm_mappings_cost_comm_fk')->references('id')->on('cost_commissions')->onDelete('set null');

            // Unique: um payment_method só pode ter uma taxa por tenant
            $table->unique(['tenant_id', 'external_payment_method_id', 'provider'], 'pm_mappings_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('payment_method_mappings');
    }
};
