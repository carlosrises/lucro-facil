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
        Schema::table('finance_entries', function (Blueprint $table) {
            $table->string('payment_method')->nullable()->after('due_date');
            $table->string('financial_account')->nullable()->after('payment_method');
            $table->date('competence_date')->nullable()->after('occurred_on');
            $table->decimal('interest_rate', 5, 2)->default(0)->after('financial_account');
            $table->decimal('fine_rate', 5, 2)->default(0)->after('interest_rate');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('finance_entries', function (Blueprint $table) {
            $table->dropColumn(['payment_method', 'financial_account', 'competence_date', 'interest_rate', 'fine_rate']);
        });
    }
};
