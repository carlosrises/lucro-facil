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
            $table->enum('recurrence_type', ['single', 'weekly', 'biweekly', 'monthly', 'bimonthly', 'quarterly', 'semiannual', 'annual'])->default('single')->after('occurred_on');
            $table->date('recurrence_end_date')->nullable()->after('recurrence_type');
            $table->string('supplier')->nullable()->after('finance_category_id');
            $table->date('due_date')->nullable()->after('occurred_on');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('finance_entries', function (Blueprint $table) {
            $table->dropColumn(['recurrence_type', 'recurrence_end_date', 'supplier', 'due_date']);
        });
    }
};
