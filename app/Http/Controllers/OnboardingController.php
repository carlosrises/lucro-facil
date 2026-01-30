<?php

namespace App\Http\Controllers;

use App\Models\Plan;
use App\Services\BusinessPresetsService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class OnboardingController extends Controller
{
    public function __construct(
        protected BusinessPresetsService $presetsService
    ) {}

    /**
     * Mostrar wizard de onboarding
     */
    public function show(Request $request)
    {
        $user = Auth::user();
        $tenant = $user->tenant;

        // Se já completou onboarding, redirecionar para dashboard
        if ($tenant->onboarding_completed_at || $tenant->onboarding_skipped) {
            return redirect()->route('dashboard');
        }

        $step = $request->query('step', 1);

        // Determinar step atual baseado no progresso
        if ($tenant->business_type && $step == 1) {
            // Se já escolheu business_type, pular para step 3 (escolha de plano)
            $step = 3;
        }

        $data = [
            'currentStep' => (int) $step,
            'tenant' => $tenant,
        ];

        // Step 1: Selecionar tipo de negócio
        if ($step == 1) {
            $data['presets'] = $this->presetsService->getAvailablePresets();
        }

        // Step 2: Confirmação dos presets (se business_type foi escolhido)
        if ($step == 2 && $tenant->business_type) {
            $data['presetDetails'] = $this->presetsService->getPresetDetails($tenant->business_type);
        }

        // Step 3: Escolha do plano
        if ($step == 3) {
            $data['plans'] = Plan::where('active', true)
                ->where('is_visible', true)
                ->where('is_contact_plan', false)
                ->with('prices')
                ->orderBy('display_order')
                ->orderBy('price_month')
                ->get();
            $data['currentPlan'] = $tenant->plan;
        }

        return Inertia::render('onboarding/wizard', $data);
    }

    /**
     * Definir tipo de negócio e avançar para step 2
     */
    public function setBusinessType(Request $request)
    {
        // \Log::info('setBusinessType chamado', ['data' => $request->all()]);

        // $request->validate([
        //     'business_type' => 'required|string|in:pizzaria,hamburgueria,restaurante,lanchonete',
        // ]);

        $user = Auth::user();
        $tenant = $user->tenant;

        // \Log::info('Tenant atual', ['tenant_id' => $tenant->id, 'business_type_atual' => $tenant->business_type]);

        // Salvar tipo de negócio
        $tenant->update([
            'business_type' => $request->business_type,
        ]);

        // \Log::info('Tenant atualizado', ['tenant_id' => $tenant->id, 'novo_business_type' => $tenant->business_type]);

        // Aplicar presets
        try {
            $stats = $this->presetsService->applyPreset($tenant, $request->business_type);

            // \Log::info('Preset aplicado com sucesso', ['stats' => $stats]);

            return redirect()
                ->route('onboarding', ['step' => 2])
                ->with('success', "Criamos {$stats['products']} produtos, {$stats['ingredients']} ingredientes e {$stats['categories']} categorias para você!");
        } catch (\Exception $e) {
            \Log::error('Erro ao aplicar preset', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);

            return redirect()
                ->back()
                ->withErrors(['error' => 'Erro ao aplicar preset: '.$e->getMessage()]);
        }
    }

    /**
     * Completar onboarding
     */
    public function complete(Request $request)
    {
        $user = Auth::user();
        $tenant = $user->tenant;

        $tenant->update([
            'onboarding_completed_at' => now(),
        ]);

        return redirect()
            ->route('dashboard')
            ->with('success', 'Bem-vindo ao Lucro Fácil! 🎉');
    }

    /**
     * Pular onboarding
     */
    public function skip(Request $request)
    {
        $user = Auth::user();
        $tenant = $user->tenant;

        $tenant->update([
            'onboarding_skipped' => true,
            'onboarding_completed_at' => now(),
        ]);

        return redirect()
            ->route('dashboard')
            ->with('info', 'Você pode configurar seus produtos e planos a qualquer momento.');
    }
}
