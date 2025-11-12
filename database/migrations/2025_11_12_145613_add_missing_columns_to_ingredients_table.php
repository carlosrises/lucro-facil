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
        Schema::table('ingredients', function (Blueprint $table) {
            // Verificar se a coluna unit_cost existe, se sim renomear para unit_price
            if (Schema::hasColumn('ingredients', 'unit_cost')) {
                $table->renameColumn('unit_cost', 'unit_price');
            } elseif (! Schema::hasColumn('ingredients', 'unit_price')) {
                // Se nenhuma das duas existir, criar unit_price
                $table->decimal('unit_price', 12, 4)->default(0)->after('unit');
            }

            // Adicionar categoria se não existir
            if (! Schema::hasColumn('ingredients', 'category_id')) {
                $table->foreignId('category_id')->nullable()->after('tenant_id')->constrained('categories')->nullOnDelete();
            }

            // Adicionar controle de estoque se não existirem
            if (! Schema::hasColumn('ingredients', 'current_stock')) {
                $table->decimal('current_stock', 12, 3)->default(0)->after('unit_price');
            }
            if (! Schema::hasColumn('ingredients', 'ideal_stock')) {
                $table->decimal('ideal_stock', 12, 3)->default(0)->after('current_stock');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('ingredients', function (Blueprint $table) {
            if (Schema::hasColumn('ingredients', 'category_id')) {
                $table->dropForeign(['category_id']);
                $table->dropColumn('category_id');
            }
            if (Schema::hasColumn('ingredients', 'current_stock')) {
                $table->dropColumn('current_stock');
            }
            if (Schema::hasColumn('ingredients', 'ideal_stock')) {
                $table->dropColumn('ideal_stock');
            }
            if (Schema::hasColumn('ingredients', 'unit_price') && ! Schema::hasColumn('ingredients', 'unit_cost')) {
                $table->renameColumn('unit_price', 'unit_cost');
            }
        });
    }
};
