<?php

use App\Http\Controllers\Settings\GeneralController;
use App\Http\Controllers\Settings\IntegrationsController;
use App\Http\Controllers\Settings\PasswordController;
use App\Http\Controllers\Settings\ProfileController;
use App\Http\Controllers\Settings\TwoFactorAuthenticationController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::middleware('auth')->group(function () {
    Route::redirect('settings', '/settings/profile');

    Route::get('settings/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('settings/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('settings/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');

    Route::get('settings/password', [PasswordController::class, 'edit'])->name('password.edit');

    Route::put('settings/password', [PasswordController::class, 'update'])
        ->middleware('throttle:6,1')
        ->name('password.update');

    Route::get('settings/appearance', function () {
        return Inertia::render('settings/appearance');
    })->name('appearance.edit');

    Route::get('settings/billing', function () {
        $plans = \App\Models\Plan::where('active', true)
            ->where('is_visible', true)
            ->with('prices')
            ->orderBy('display_order', 'asc')
            ->orderBy('price_month', 'asc')
            ->get();
        $currentPlan = auth()->user()->tenant->plan ?
            \App\Models\Plan::with('prices')->find(auth()->user()->tenant->plan->id) :
            null;
        $subscription = auth()->user()->tenant->subscriptions()->whereIn('status', ['active', 'trialing'])->first();

        return Inertia::render('settings/billing', [
            'plans' => $plans,
            'currentPlan' => $currentPlan,
            'subscription' => $subscription,
        ]);
    })->name('billing.edit');

    Route::post('settings/billing/checkout', function (\Illuminate\Http\Request $request) {
        $request->validate([
            'plan_id' => 'required|exists:plans,id',
            'price_interval' => 'nullable|string|in:month,year',
        ]);

        $plan = \App\Models\Plan::with('prices')->findOrFail($request->plan_id);
        $tenant = auth()->user()->tenant;
        $priceInterval = $request->price_interval ?? 'month';

        \Log::info('[Checkout] Criando sessão', [
            'tenant_id' => $tenant->id,
            'plan_id' => $plan->id,
            'plan_name' => $plan->name,
            'price_interval' => $priceInterval,
            'user_email' => auth()->user()->email,
        ]);

        // Criar sessão do Stripe Checkout
        $stripe = new \Stripe\StripeClient(config('services.stripe.secret'));

        try {
            $stripeService = app(\App\Services\StripeService::class);
            $checkoutUrl = $stripeService->createCheckoutSession($tenant, $plan, $priceInterval);

            \Log::info('[Checkout] Sessão criada com sucesso', [
                'checkout_url' => $checkoutUrl,
            ]);

            return response()->json([
                'checkout_url' => $checkoutUrl,
            ]);
        } catch (\Exception $e) {
            \Log::error('[Checkout] Erro ao criar sessão: ' . $e->getMessage());
            return response()->json(['error' => 'Erro ao criar sessão de checkout'], 500);
        }
    })->name('billing.checkout');

    Route::get('settings/billing/success', function () {
        return Inertia::render('settings/billing-success');
    })->name('billing.success');

    Route::get('settings/two-factor', [TwoFactorAuthenticationController::class, 'show'])
        ->name('two-factor.show');

    Route::get('settings/integrations', [IntegrationsController::class, 'index'])
        ->name('integrations.index');

    Route::get('settings/general', [GeneralController::class, 'edit'])
        ->name('general.edit');

    Route::put('settings/general', [GeneralController::class, 'update'])
        ->name('general.update');
});
