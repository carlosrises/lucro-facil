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
            $table->string('business_type')->nullable()->after('email');
            $table->timestamp('onboarding_completed_at')->nullable()->after('business_type');
            $table->boolean('onboarding_skipped')->default(false)->after('onboarding_completed_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->dropColumn(['business_type', 'onboarding_completed_at', 'onboarding_skipped']);
        });
    }
};
