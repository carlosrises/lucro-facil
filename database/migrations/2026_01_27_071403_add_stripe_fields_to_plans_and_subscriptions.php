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
            $table->string('stripe_product_id')->nullable()->after('code');
            $table->string('stripe_price_id')->nullable()->after('price_month');
            $table->boolean('active')->default(true)->after('features');
        });

        Schema::table('subscriptions', function (Blueprint $table) {
            $table->string('stripe_customer_id')->nullable()->after('tenant_id');
            $table->string('stripe_subscription_id')->nullable()->after('plan_id');
            $table->string('stripe_payment_method')->nullable()->after('stripe_subscription_id');
            $table->timestamp('trial_ends_at')->nullable()->after('ends_on');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('plans', function (Blueprint $table) {
            $table->dropColumn(['stripe_product_id', 'stripe_price_id', 'active']);
        });

        Schema::table('subscriptions', function (Blueprint $table) {
            $table->dropColumn(['stripe_customer_id', 'stripe_subscription_id', 'stripe_payment_method', 'trial_ends_at']);
        });
    }
};
