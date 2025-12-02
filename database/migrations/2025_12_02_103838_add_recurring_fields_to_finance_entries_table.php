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
            $table->boolean('is_recurring')->default(false)->after('status');
            $table->foreignId('parent_entry_id')->nullable()->after('is_recurring')->constrained('finance_entries')->onDelete('cascade');
            $table->integer('installment_number')->nullable()->after('parent_entry_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('finance_entries', function (Blueprint $table) {
            $table->dropForeign(['parent_entry_id']);
            $table->dropColumn(['is_recurring', 'parent_entry_id', 'installment_number']);
        });
    }
};
