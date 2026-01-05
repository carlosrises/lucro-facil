<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('product_mappings', function (Blueprint $table) {
            $table->string('item_type')->nullable()->after('provider')
                ->comment('Tipo do item: flavor, beverage, complement, parent_product, additional, combo');
        });
    }

    public function down(): void
    {
        Schema::table('product_mappings', function (Blueprint $table) {
            $table->dropColumn('item_type');
        });
    }
};
