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
        Schema::create('tenants', function (Blueprint $t) {
            $t->id();
            $t->uuid('uuid')->unique();
            $t->string('name');
            $t->string('document')->nullable(); // CNPJ/CPF opcional
            $t->string('email')->nullable();
            $t->string('phone')->nullable();
            $t->timestamps();
        });

        Schema::create('stores', function (Blueprint $t) {
            $t->id();
            $t->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $t->string('provider')->default('ifood'); // ifood | takeat | ...
            $t->string('external_store_id')->index(); // id da loja no provedor
            $t->string('display_name');
            $t->boolean('active')->default(true);
            $t->timestamps();

            $t->unique(['tenant_id', 'provider', 'external_store_id'], 'stores_unique');
        });

        Schema::create('oauth_tokens', function (Blueprint $t) {
            $t->id();
            $t->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $t->foreignId('store_id')->nullable()->constrained()->nullOnDelete();
            $t->string('provider')->default('ifood');
            $t->text('access_token');    // criptografar via cast/model
            $t->text('refresh_token')->nullable();
            $t->timestamp('expires_at')->nullable();
            $t->json('scopes')->nullable();
            $t->timestamps();
            $t->index(['tenant_id', 'provider']);
        });

        Schema::create('sync_cursors', function (Blueprint $t) {
            $t->id();
            $t->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $t->foreignId('store_id')->nullable()->constrained()->nullOnDelete();
            $t->enum('module', ['orders', 'financial', 'takeat_orders', 'takeat_financial']);
            $t->string('cursor_key')->nullable();        // ex.: last_event_id / after token
            $t->timestamp('last_synced_at')->nullable();
            $t->timestamps();

            $t->unique(['tenant_id', 'store_id', 'module'], 'sync_cursors_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('sync_cursors');
        Schema::dropIfExists('oauth_tokens');
        Schema::dropIfExists('stores');
        Schema::dropIfExists('tenants');
    }
};
