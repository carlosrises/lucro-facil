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
            $table->string('product_category')->nullable()->after('type');
            $table->integer('max_flavors')->nullable()->after('product_category');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('internal_products', function (Blueprint $table) {
            $table->dropColumn(['product_category', 'max_flavors']);
        });
    }
};
