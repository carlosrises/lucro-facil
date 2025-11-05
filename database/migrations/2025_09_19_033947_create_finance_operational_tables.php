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
        Schema::create('finance_categories', function (Blueprint $t) {
            $t->id();
            $t->foreignId('tenant_id')->constrained()->cascadeOnDelete();

            $t->enum('type', ['expense','income']);
            $t->string('name');
            $t->timestamps();

            $t->unique(['tenant_id','type','name'], 'finance_categories_unique');
        });

        Schema::create('finance_entries', function (Blueprint $t) {
            $t->id();
            $t->foreignId('tenant_id')->constrained()->cascadeOnDelete();

            $t->foreignId('finance_category_id')->constrained('finance_categories')->cascadeOnDelete();
            $t->date('occurred_on');
            $t->decimal('amount', 14, 2);
            $t->string('reference')->nullable(); // nota, doc, etc.
            $t->text('notes')->nullable();
            $t->timestamps();

            $t->index(['tenant_id','occurred_on']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('finance_entries');
        Schema::dropIfExists('finance_categories');
    }
};
