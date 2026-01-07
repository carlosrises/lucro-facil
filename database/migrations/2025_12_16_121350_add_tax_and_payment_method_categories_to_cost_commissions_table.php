<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Alterar o enum para incluir as novas categorias
        DB::statement("ALTER TABLE cost_commissions MODIFY COLUMN category ENUM('cost', 'commission', 'tax', 'payment_method') NOT NULL DEFAULT 'cost'");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Voltar ao enum original
        DB::statement("ALTER TABLE cost_commissions MODIFY COLUMN category ENUM('cost', 'commission') NOT NULL DEFAULT 'cost'");
    }
};
