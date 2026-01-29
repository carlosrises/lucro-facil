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
            ->orderBy('display_order', 'asc')
            ->orderBy('price_month', 'asc')
            ->get();
        $currentPlan = auth()->user()->tenant->plan ?? null;
        $subscription = auth()->user()->tenant->subscriptions()->where('status', 'active')->first();

        return Inertia::render('settings/billing', [
            'plans' => $plans,
            'currentPlan' => $currentPlan,
            'subscription' => $subscription,
        ]);
    })->name('billing.edit');

    Route::post('settings/billing/checkout', function (\Illuminate\Http\Request $request) {
        $request->validate([
            'plan_id' => 'required|exists:plans,id',
        ]);

        $plan = \App\Models\Plan::findOrFail($request->plan_id);
        $tenant = auth()->user()->tenant;

        \Log::info('[Checkout] Criando sessão', [
            'tenant_id' => $tenant->id,
            'plan_id' => $plan->id,
            'plan_name' => $plan->name,
            'user_email' => auth()->user()->email,
        ]);

        // Criar sessão do Stripe Checkout
        $stripe = new \Stripe\StripeClient(config('services.stripe.secret'));

        try {
            $session = $stripe->checkout->sessions->create([
                'payment_method_types' => ['card'],
                'line_items' => [[
                    'price_data' => [
                        'currency' => 'brl',
                        'product_data' => [
                            'name' => $plan->name,
                            'description' => $plan->description,
                        ],
                        'unit_amount' => (int)($plan->price_month * 100), // Centavos
                        'recurring' => [
                            'interval' => 'month',
                        ],
                    ],
                    'quantity' => 1,
                ]],
                'mode' => 'subscription',
                'success_url' => route('billing.success') . '?session_id={CHECKOUT_SESSION_ID}',
                'cancel_url' => route('billing.edit'),
                'client_reference_id' => $tenant->id,
                'customer_email' => auth()->user()->email,
                'metadata' => [
                    'tenant_id' => $tenant->id,
                    'plan_id' => $plan->id,
                    'user_id' => auth()->id(),
                ],
            ]);

            \Log::info('[Checkout] Sessão criada com sucesso', [
                'session_id' => $session->id,
                'checkout_url' => $session->url,
            ]);

            return response()->json([
                'checkout_url' => $session->url,
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
