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
        Schema::table('plans', function (Blueprint $table) {
            $table->boolean('is_visible')->default(true)->after('active');
            $table->boolean('is_contact_plan')->default(false)->after('is_visible');
            $table->string('contact_url')->nullable()->after('is_contact_plan');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('plans', function (Blueprint $table) {
            $table->dropColumn(['is_visible', 'is_contact_plan', 'contact_url']);
        });
    }
};
