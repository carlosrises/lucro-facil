<?php

namespace App\Http\Controllers;

use App\Models\Plan;
use App\Models\Subscription;
use App\Services\StripeService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class SubscriptionController extends Controller
{
    public function __construct(
        protected StripeService $stripe
    ) {}

    /**
     * Selecionar um plano (redirecionar para registro/checkout)
     */
    public function choose(Request $request, Plan $plan)
    {
        if (! $plan->active) {
            return redirect()->back()->withErrors(['error' => 'Este plano não está disponível.']);
        }

        // Se usuário já está autenticado, salvar na sessão e ir para checkout
        if (Auth::check()) {
            session(['selected_plan_id' => $plan->id]);
            return redirect()->route('subscription.checkout');
        }

        // Se não está autenticado, ir para registro com plan_id como query param
        return redirect()->route('register', ['plan' => $plan->id]);
    }

    /**
     * Criar Checkout Session do Stripe
     */
    public function checkout(Request $request)
    {
        $user = Auth::user();
        $tenant = $user->tenant;

        // Verificar se já tem assinatura ativa
        $activeSubscription = Subscription::where('tenant_id', $tenant->id)
            ->whereIn('status', ['active', 'trialing'])
            ->first();

        if ($activeSubscription) {
            return redirect()->route('dashboard')
                ->with('info', 'Você já possui uma assinatura ativa.');
        }

        // Pegar plano da sessão ou do request
        $planId = $request->input('plan_id') ?? session('selected_plan_id');
        $priceInterval = $request->input('price_interval', 'month'); // 'month' ou 'year'

        if (! $planId) {
            return redirect('/#pricing')
                ->withErrors(['error' => 'Selecione um plano para continuar.']);
        }

        $plan = Plan::with('prices')->findOrFail($planId);

        if (! $plan->active) {
            return redirect('/#pricing')
                ->withErrors(['error' => 'Este plano não está disponível.']);
        }

        try {
            // Criar Checkout Session no Stripe (com intervalo de preço)
            $checkoutUrl = $this->stripe->createCheckoutSession($tenant, $plan, $priceInterval);

            // Limpar plano da sessão
            session()->forget('selected_plan_id');

            // Redirecionar para Stripe Checkout
            return Inertia::location($checkoutUrl);
        } catch (\Exception $e) {
            return redirect('/#pricing')
                ->withErrors(['error' => 'Erro ao criar sessão de checkout: '.$e->getMessage()]);
        }
    }

    /**
     * Página de sucesso após checkout
     */
    public function success(Request $request)
    {
        $sessionId = $request->query('session_id');

        return Inertia::render('subscription/success', [
            'sessionId' => $sessionId,
        ]);
    }

    /**
     * Página de cancelamento do checkout
     */
    public function cancel()
    {
        return Inertia::render('subscription/cancel');
    }

    /**
     * Gerenciar assinatura (Customer Portal)
     */
    public function manage(Request $request)
    {
        $user = Auth::user();
        $tenant = $user->tenant;

        try {
            $portalUrl = $this->stripe->createCustomerPortalSession($tenant);

            return Inertia::location($portalUrl);
        } catch (\Exception $e) {
            return redirect()->back()
                ->withErrors(['error' => 'Erro ao acessar portal de assinatura: '.$e->getMessage()]);
        }
    }
}
