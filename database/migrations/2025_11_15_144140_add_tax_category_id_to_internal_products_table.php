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
        Schema::table('internal_products', function (Blueprint $table) {
            $table->foreignId('tax_category_id')->nullable()->after('id')->constrained('tax_categories')->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('internal_products', function (Blueprint $table) {
            $table->dropForeign(['tax_category_id']);
            $table->dropColumn('tax_category_id');
        });
    }
};
