<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('order_item_mappings', function (Blueprint $table) {
            if (! Schema::hasColumn('order_item_mappings', 'auto_fraction')) {
                $table->boolean('auto_fraction')->default(false)->after('quantity');
            }
            if (! Schema::hasColumn('order_item_mappings', 'external_reference')) {
                $table->string('external_reference')->nullable()->after('quantity');
            }
            if (! Schema::hasColumn('order_item_mappings', 'external_name')) {
                $table->string('external_name')->nullable()->after('quantity');
            }
        });
    }

    public function down(): void
    {
        Schema::table('order_item_mappings', function (Blueprint $table) {
            if (Schema::hasColumn('order_item_mappings', 'auto_fraction')) {
                $table->dropColumn('auto_fraction');
            }
            if (Schema::hasColumn('order_item_mappings', 'external_reference')) {
                $table->dropColumn('external_reference');
            }
            if (Schema::hasColumn('order_item_mappings', 'external_name')) {
                $table->dropColumn('external_name');
            }
        });
    }
};
