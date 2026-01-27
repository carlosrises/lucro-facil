<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Plan;
use App\Services\StripeService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Stripe\StripeClient;

class PlansController extends Controller
{
    protected $stripe;

    public function __construct(StripeService $stripe)
    {
        $this->stripe = $stripe;
    }

    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $query = Plan::query();

        // Filtro de busca
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('code', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%");
            });
        }

        // Filtro de status
        if ($request->filled('active')) {
            $query->where('active', $request->active === 'true');
        }

        $plans = $query->orderBy('price_month')->paginate(15);

        return inertia('admin/plans', [
            'plans' => $plans,
            'filters' => [
                'search' => $request->search,
                'active' => $request->active,
            ],
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'code' => 'required|string|max:255|unique:plans,code',
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'price' => 'required|numeric|min:0',
            'features' => 'nullable|array',
            'active' => 'boolean',
        ]);

        // Converter price para price_month
        $validated['price_month'] = $validated['price'];
        unset($validated['price']);

        DB::beginTransaction();
        try {
            // Criar plano no banco
            $plan = Plan::create($validated);

            // Criar produto e preço no Stripe
            $stripeIds = $this->stripe->createPlanInStripe($plan);
            $plan->update($stripeIds);

            DB::commit();

            return redirect()->back()->with('success', 'Plano criado com sucesso!');
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Erro ao criar plano', [
                'error' => $e->getMessage(),
                'data' => $validated,
            ]);

            return redirect()->back()->withErrors(['error' => 'Erro ao criar plano: '.$e->getMessage()]);
        }
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Plan $plan)
    {
        $validated = $request->validate([
            'code' => 'required|string|max:255|unique:plans,code,'.$plan->id,
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'price' => 'required|numeric|min:0',
            'features' => 'nullable|array',
            'active' => 'boolean',
        ]);

        // Converter price para price_month
        $validated['price_month'] = $validated['price'];
        unset($validated['price']);

        DB::beginTransaction();
        try {
            // Atualizar plano no banco
            $plan->update($validated);

            // Atualizar produto/preço no Stripe
            if ($plan->stripe_product_id) {
                $this->stripe->updatePlanInStripe($plan);
            } else {
                // Se não tinha IDs do Stripe, criar agora
                $stripeIds = $this->stripe->createPlanInStripe($plan);
                $plan->update($stripeIds);
            }

            DB::commit();

            return redirect()->back()->with('success', 'Plano atualizado com sucesso!');
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Erro ao atualizar plano', [
                'plan_id' => $plan->id,
                'error' => $e->getMessage(),
                'data' => $validated,
            ]);

            return redirect()->back()->withErrors(['error' => 'Erro ao atualizar plano: '.$e->getMessage()]);
        }
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Plan $plan)
    {
        DB::beginTransaction();
        try {
            // Verificar se existem assinaturas (ativas ou não)
            $subscriptionsCount = $plan->subscriptions()->count();

            if ($subscriptionsCount > 0) {
                return redirect()->back()->withErrors([
                    'error' => "Não é possível excluir o plano. Existem {$subscriptionsCount} assinatura(s) vinculada(s). Desative o plano ao invés de excluí-lo.",
                ]);
            }

            // Arquivar produto no Stripe
            if ($plan->stripe_product_id) {
                try {
                    \Stripe\Stripe::setApiKey(config('services.stripe.secret'));
                    \Stripe\Product::update($plan->stripe_product_id, ['active' => false]);
                } catch (\Exception $e) {
                    Log::warning('Erro ao arquivar produto no Stripe', [
                        'plan_id' => $plan->id,
                        'stripe_product_id' => $plan->stripe_product_id,
                        'error' => $e->getMessage(),
                    ]);
                }
            }

            // Deletar plano
            $plan->delete();

            DB::commit();

            return redirect()->back()->with('success', 'Plano excluído com sucesso!');
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Erro ao desativar plano', [
                'plan_id' => $plan->id,
                'error' => $e->getMessage(),
            ]);

            return redirect()->back()->withErrors(['error' => 'Erro ao desativar plano: '.$e->getMessage()]);
        }
    }

    /**
     * Sincronizar planos do Stripe para o sistema
     */
    public function syncFromStripe()
    {
        try {
            $stripe = new StripeClient(config('services.stripe.secret'));

            // Buscar todos os produtos ativos do Stripe
            $products = $stripe->products->all([
                'active' => true,
                'limit' => 100,
            ]);

            $synced = 0;
            $created = 0;

            DB::beginTransaction();

            foreach ($products->data as $product) {
                // Buscar preço do produto
                $prices = $stripe->prices->all([
                    'product' => $product->id,
                    'active' => true,
                    'type' => 'recurring',
                    'limit' => 1,
                ]);

                if (count($prices->data) === 0) {
                    continue; // Pular produtos sem preço recorrente
                }

                $price = $prices->data[0];

                // Código do plano (tentar pegar do metadata, senão usar primeiras 3 letras do nome)
                $planCode = strtoupper($product->metadata['plan_code'] ?? substr($product->name, 0, 3));

                // Verificar se já existe um plano com esse stripe_product_id OU código
                $plan = Plan::where('stripe_product_id', $product->id)
                    ->orWhere('code', $planCode)
                    ->first();

                $planData = [
                    'name' => $product->name,
                    'description' => $product->description ?? '',
                    'price_month' => $price->unit_amount / 100, // Converter de centavos
                    'stripe_product_id' => $product->id,
                    'stripe_price_id' => $price->id,
                    'active' => $product->active,
                ];

                if ($plan) {
                    // Atualizar plano existente (e garantir que tenha os IDs do Stripe)
                    $plan->update($planData);
                    $synced++;
                } else {
                    // Criar novo plano
                    $planData['code'] = $planCode;
                    Plan::create($planData);
                    $created++;
                }
            }

            // Buscar planos do sistema que têm stripe_product_id mas não existem mais no Stripe
            $stripeProductIds = collect($products->data)->pluck('id')->toArray();
            $plansToDeactivate = Plan::whereNotNull('stripe_product_id')
                ->whereNotIn('stripe_product_id', $stripeProductIds)
                ->get();

            $deactivated = 0;
            foreach ($plansToDeactivate as $plan) {
                // Desativar plano que não existe mais no Stripe
                $plan->update(['active' => false]);
                $deactivated++;
            }

            DB::commit();

            $message = "Sincronização concluída! {$created} plano(s) criado(s), {$synced} atualizado(s)";
            if ($deactivated > 0) {
                $message .= ", {$deactivated} desativado(s)";
            }

            return redirect()->back()->with('success', $message.'.');
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Erro ao sincronizar do Stripe', [
                'error' => $e->getMessage(),
            ]);

            return redirect()->back()->withErrors(['error' => 'Erro ao sincronizar: '.$e->getMessage()]);
        }
    }

    /**
     * Sincronizar planos do sistema para o Stripe
     */
    public function syncToStripe()
    {
        try {
            // Buscar planos que não têm stripe_product_id
            $plansWithoutStripe = Plan::whereNull('stripe_product_id')->get();

            $synced = 0;

            DB::beginTransaction();

            foreach ($plansWithoutStripe as $plan) {
                $stripeIds = $this->stripe->createPlanInStripe($plan);
                $plan->update($stripeIds);
                $synced++;
            }

            DB::commit();

            return redirect()->back()->with('success', "{$synced} plano(s) enviado(s) para o Stripe.");
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Erro ao sincronizar para o Stripe', [
                'error' => $e->getMessage(),
            ]);

            return redirect()->back()->withErrors(['error' => 'Erro ao sincronizar: '.$e->getMessage()]);
        }
    }
}
