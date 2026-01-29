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

        $plans = $query->with('prices')->orderBy('display_order')->orderBy('price_month')->paginate(15);

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
            'prices' => 'nullable|array',
            'prices.*.key' => 'required|string|max:50',
            'prices.*.label' => 'required|string|max:50',
            'prices.*.amount' => 'nullable|numeric|min:0',
            'prices.*.interval' => 'nullable|string|in:month,year',
            'prices.*.period_label' => 'nullable|string|max:50',
            'prices.*.is_annual' => 'nullable|boolean',
            'features' => 'nullable|array',
            'active' => 'boolean',
            'is_visible' => 'boolean',
            'is_contact_plan' => 'boolean',
            'contact_url' => 'nullable|url',
        ]);

        // Validação customizada: contact_url obrigatório se is_contact_plan
        if (($validated['is_contact_plan'] ?? false) && empty($validated['contact_url'])) {
            return redirect()->back()->withErrors([
                'contact_url' => 'URL de contato é obrigatória para planos sob consulta.',
            ]);
        }

        $prices = collect($validated['prices'] ?? [])->filter(function ($price) {
            return in_array($price['interval'] ?? null, ['month', 'year'], true)
                || in_array($price['key'] ?? null, ['monthly', 'annual'], true);
        });
        unset($validated['prices']);

        $priceMonth = $prices->firstWhere('interval', 'month')['amount'] ??
            $prices->firstWhere('key', 'monthly')['amount'] ??
            $prices->first()['amount'] ?? null;

        $validated['price_month'] = $validated['is_contact_plan'] ? null : $priceMonth;

        $plan = Plan::withoutEvents(function () use ($validated) {
            return Plan::create($validated);
        });

        if (!$validated['is_contact_plan'] && $prices->isNotEmpty()) {
            $plan->prices()->createMany($prices->toArray());
            $this->stripe->createPlanWithPrices($plan->fresh('prices'));
        }

        return redirect()->back()->with('success', 'Plano criado com sucesso!');
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
            'prices' => 'nullable|array',
            'prices.*.id' => 'nullable|integer',
            'prices.*.key' => 'required|string|max:50',
            'prices.*.label' => 'required|string|max:50',
            'prices.*.amount' => 'nullable|numeric|min:0',
            'prices.*.interval' => 'nullable|string|in:month,year',
            'prices.*.period_label' => 'nullable|string|max:50',
            'prices.*.is_annual' => 'nullable|boolean',
            'features' => 'nullable|array',
            'active' => 'boolean',
            'is_visible' => 'boolean',
            'is_contact_plan' => 'boolean',
            'contact_url' => 'nullable|url',
        ]);

        // Validação customizada: contact_url obrigatório se is_contact_plan
        if (($validated['is_contact_plan'] ?? false) && empty($validated['contact_url'])) {
            return redirect()->back()->withErrors([
                'contact_url' => 'URL de contato é obrigatória para planos sob consulta.',
            ]);
        }

        $prices = collect($validated['prices'] ?? [])->filter(function ($price) {
            return in_array($price['interval'] ?? null, ['month', 'year'], true)
                || in_array($price['key'] ?? null, ['monthly', 'annual'], true);
        });
        unset($validated['prices']);

        $priceMonth = $prices->firstWhere('interval', 'month')['amount'] ??
            $prices->firstWhere('key', 'monthly')['amount'] ??
            $prices->first()['amount'] ?? null;

        $validated['price_month'] = $validated['is_contact_plan'] ? null : $priceMonth;

        $oldStripePriceIds = $plan->prices()->pluck('stripe_price_id')->filter()->all();

        $plan = Plan::withoutEvents(function () use ($plan, $validated) {
            $plan->update($validated);
            return $plan;
        });

        $plan->prices()->delete();

        if (!$validated['is_contact_plan'] && $prices->isNotEmpty()) {
            $plan->prices()->createMany($prices->toArray());

            $plan = $plan->fresh('prices');

            if (!$plan->stripe_product_id) {
                $this->stripe->createPlanWithPrices($plan);
            } else {
                $this->stripe->updatePlanProduct($plan);
                $this->stripe->syncPlanPrices($plan, $oldStripePriceIds);
            }
        }

        return redirect()->back()->with('success', 'Plano atualizado com sucesso!');
    }

    /**
     * Update the display order of plans.
     */
    public function updateOrder(Request $request)
    {
        $validated = $request->validate([
            'plans' => 'required|array',
            'plans.*.id' => 'required|exists:plans,id',
            'plans.*.display_order' => 'required|integer|min:0',
        ]);

        DB::beginTransaction();
        try {
            foreach ($validated['plans'] as $planData) {
                Plan::where('id', $planData['id'])
                    ->update(['display_order' => $planData['display_order']]);
            }

            DB::commit();

            return back();
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Erro ao atualizar ordem dos planos', [
                'error' => $e->getMessage(),
            ]);

            return back()->with('error', 'Erro ao atualizar ordem.');
        }
    }

    /**
     * Toggle the featured status of a plan.
     */
    public function toggleFeatured(Plan $plan)
    {
        try {
            $plan->update(['is_featured' => !$plan->is_featured]);

            return back();
        } catch (\Exception $e) {
            Log::error('Erro ao alternar destaque do plano', [
                'plan_id' => $plan->id,
                'error' => $e->getMessage(),
            ]);

            return back()->with('error', 'Erro ao atualizar plano.');
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
                // Buscar preços do produto
                $prices = $stripe->prices->all([
                    'product' => $product->id,
                    'active' => true,
                    'type' => 'recurring',
                    'limit' => 100,
                ]);

                if (count($prices->data) === 0) {
                    continue; // Pular produtos sem preços recorrentes
                }

                // Código do plano (tentar pegar do metadata, senão usar primeiras 3 letras do nome)
                $planCode = strtoupper($product->metadata['plan_code'] ?? substr($product->name, 0, 3));

                // Verificar se já existe um plano com esse stripe_product_id OU código
                $plan = Plan::where('stripe_product_id', $product->id)
                    ->orWhere('code', $planCode)
                    ->first();

                $monthlyPrice = collect($prices->data)->firstWhere('recurring.interval', 'month');
                $fallbackPrice = $prices->data[0];
                $priceMonth = $monthlyPrice ? ($monthlyPrice->unit_amount / 100) : ($fallbackPrice->unit_amount / 100);

                $planData = [
                    'name' => $product->name,
                    'description' => $product->description ?? '',
                    'price_month' => $priceMonth, // Converter de centavos
                    'stripe_product_id' => $product->id,
                    'stripe_price_id' => $fallbackPrice->id,
                    'active' => $product->active,
                ];

                if ($plan) {
                    // Atualizar plano existente (e garantir que tenha os IDs do Stripe)
                    Plan::withoutEvents(function () use ($plan, $planData) {
                        $plan->update($planData);
                    });
                    $synced++;
                } else {
                    // Criar novo plano
                    $planData['code'] = $planCode;
                    $plan = Plan::withoutEvents(function () use ($planData) {
                        return Plan::create($planData);
                    });
                    $created++;
                }

                // Atualizar preços do plano
                $plan->prices()->delete();

                $priceRows = collect($prices->data)
                    ->filter(function ($price) {
                        $interval = $price->recurring->interval ?? 'month';
                        return in_array($interval, ['month', 'year'], true);
                    })
                    ->map(function ($price) {
                    $interval = $price->recurring->interval ?? 'month';
                    $label = match ($interval) {
                        'month' => 'Mensal',
                        'year' => 'Anual',
                        default => 'Outro',
                    };

                    return [
                        'key' => $price->nickname ?: $interval,
                        'label' => $label,
                        'amount' => $price->unit_amount ? ($price->unit_amount / 100) : null,
                        'interval' => $interval,
                        'period_label' => $interval === 'year' ? 'por ano' : 'por mês',
                        'is_annual' => $interval === 'year',
                        'stripe_price_id' => $price->id,
                        'active' => $price->active,
                    ];
                })->toArray();

                $plan->prices()->createMany($priceRows);
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
                if ($plan->is_contact_plan) {
                    continue;
                }
                if ($plan->prices()->exists()) {
                    $this->stripe->createPlanWithPrices($plan->load('prices'));
                } else {
                    $stripeIds = $this->stripe->createPlanInStripe($plan);
                    $plan->update($stripeIds);
                }
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
