<?php

namespace App\Observers;

use App\Models\Plan;
use Illuminate\Support\Facades\Log;
use Stripe\StripeClient;

class PlanObserver
{
    protected StripeClient $stripe;

    public function __construct()
    {
        $this->stripe = new StripeClient(config('services.stripe.secret'));
    }

    /**
     * Handle the Plan "created" event.
     */
    public function created(Plan $plan): void
    {
        // Não sincronizar planos de contato (Enterprise)
        if ($plan->is_contact_plan) {
            return;
        }

        // Se o plano já possui preços configurados, a sincronização é feita via serviço
        if ($plan->prices()->exists()) {
            return;
        }

        try {
            // Criar produto no Stripe
            $product = $this->stripe->products->create([
                'name' => $plan->name,
                'description' => $plan->description,
                'metadata' => [
                    'plan_code' => $plan->code,
                    'plan_id' => $plan->id,
                ],
            ]);

            // Criar preço no Stripe
            $price = $this->stripe->prices->create([
                'product' => $product->id,
                'currency' => 'brl',
                'unit_amount' => (int)($plan->price_month * 100), // Centavos
                'recurring' => [
                    'interval' => 'month',
                ],
                'metadata' => [
                    'plan_id' => $plan->id,
                ],
            ]);

            // Salvar IDs do Stripe no plano (sem disparar observer novamente)
            $plan->withoutEvents(function () use ($plan, $product, $price) {
                $plan->update([
                    'stripe_product_id' => $product->id,
                    'stripe_price_id' => $price->id,
                ]);
            });

            Log::info('[PlanObserver] Plano criado no Stripe', [
                'plan_id' => $plan->id,
                'stripe_product_id' => $product->id,
                'stripe_price_id' => $price->id,
            ]);
        } catch (\Exception $e) {
            Log::error('[PlanObserver] Erro ao criar plano no Stripe: ' . $e->getMessage());
        }
    }

    /**
     * Handle the Plan "updated" event.
     */
    public function updated(Plan $plan): void
    {
        // Não sincronizar planos de contato
        if ($plan->is_contact_plan) {
            return;
        }

        // Se o plano possui preços configurados, a sincronização é feita via serviço
        if ($plan->prices()->exists()) {
            return;
        }

        // Se não tem stripe_product_id, não atualizar
        if (!$plan->stripe_product_id) {
            return;
        }

        try {
            // Atualizar produto no Stripe
            $this->stripe->products->update($plan->stripe_product_id, [
                'name' => $plan->name,
                'description' => $plan->description,
                'active' => $plan->active,
            ]);

            // Se o preço mudou, criar novo Price no Stripe (preços são imutáveis)
            if ($plan->isDirty('price_month') && $plan->stripe_price_id) {
                // Arquivar preço antigo
                $this->stripe->prices->update($plan->stripe_price_id, [
                    'active' => false,
                ]);

                // Criar novo preço
                $price = $this->stripe->prices->create([
                    'product' => $plan->stripe_product_id,
                    'currency' => 'brl',
                    'unit_amount' => (int)($plan->price_month * 100),
                    'recurring' => [
                        'interval' => 'month',
                    ],
                    'metadata' => [
                        'plan_id' => $plan->id,
                    ],
                ]);

                // Atualizar stripe_price_id
                $plan->withoutEvents(function () use ($plan, $price) {
                    $plan->update(['stripe_price_id' => $price->id]);
                });
            }

            Log::info('[PlanObserver] Plano atualizado no Stripe', [
                'plan_id' => $plan->id,
                'stripe_product_id' => $plan->stripe_product_id,
            ]);
        } catch (\Exception $e) {
            Log::error('[PlanObserver] Erro ao atualizar plano no Stripe: ' . $e->getMessage());
        }
    }

    /**
     * Handle the Plan "deleted" event.
     */
    public function deleted(Plan $plan): void
    {
        // Se não tem stripe_product_id, não fazer nada
        if (!$plan->stripe_product_id) {
            return;
        }

        try {
            // Arquivar produto no Stripe (não pode deletar produtos com subscriptions)
            $this->stripe->products->update($plan->stripe_product_id, [
                'active' => false,
            ]);

            Log::info('[PlanObserver] Plano arquivado no Stripe', [
                'plan_id' => $plan->id,
                'stripe_product_id' => $plan->stripe_product_id,
            ]);
        } catch (\Stripe\Exception\InvalidRequestException $e) {
            // Produto não existe na Stripe, apenas logar e continuar
            Log::warning('[PlanObserver] Produto não encontrado na Stripe ao arquivar (ignorado)', [
                'plan_id' => $plan->id,
                'stripe_product_id' => $plan->stripe_product_id,
                'error' => $e->getMessage(),
            ]);
        } catch (\Exception $e) {
            // Outros erros também não devem impedir a exclusão
            Log::error('[PlanObserver] Erro ao arquivar plano no Stripe (ignorado)', [
                'plan_id' => $plan->id,
                'stripe_product_id' => $plan->stripe_product_id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Handle the Plan "restored" event.
     */
    public function restored(Plan $plan): void
    {
        //
    }

    /**
     * Handle the Plan "force deleted" event.
     */
    public function forceDeleted(Plan $plan): void
    {
        //
    }
}
