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
        Schema::table('oauth_tokens', function (Blueprint $table) {
            $table->string('username')->nullable()->after('provider');
            $table->text('encrypted_password')->nullable()->after('username');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('oauth_tokens', function (Blueprint $table) {
            $table->dropColumn(['username', 'encrypted_password']);
        });
    }
};
