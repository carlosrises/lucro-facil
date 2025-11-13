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
        Schema::table('tenants', function (Blueprint $table) {
            $table->decimal('margin_excellent', 5, 2)->default(100.00)->after('phone');
            $table->decimal('margin_good_min', 5, 2)->default(30.00)->after('margin_excellent');
            $table->decimal('margin_good_max', 5, 2)->default(99.99)->after('margin_good_min');
            $table->decimal('margin_poor', 5, 2)->default(0.00)->after('margin_good_max');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->dropColumn(['margin_excellent', 'margin_good_min', 'margin_good_max', 'margin_poor']);
        });
    }
};
