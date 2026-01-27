<?php

namespace App\Services;

use App\Models\Plan;
use App\Models\Subscription;
use App\Models\Tenant;
use Stripe\StripeClient;
use Stripe\Exception\ApiErrorException;

class StripeService
{
    protected StripeClient $stripe;

    public function __construct()
    {
        $this->stripe = new StripeClient(config('services.stripe.secret'));
    }

    /**
     * Criar produto e preço no Stripe ao criar um plano
     */
    public function createPlanInStripe(Plan $plan): array
    {
        try {
            // Criar produto no Stripe
            $product = $this->stripe->products->create([
                'name' => $plan->name,
                'description' => "Plano {$plan->name} - {$plan->max_stores} lojas",
                'metadata' => [
                    'plan_id' => $plan->id,
                    'plan_code' => $plan->code,
                ],
            ]);

            // Criar preço recorrente
            $price = $this->stripe->prices->create([
                'product' => $product->id,
                'unit_amount' => (int) ($plan->price_month * 100), // Converter para centavos
                'currency' => 'brl',
                'recurring' => [
                    'interval' => 'month',
                ],
                'metadata' => [
                    'plan_id' => $plan->id,
                ],
            ]);

            return [
                'stripe_product_id' => $product->id,
                'stripe_price_id' => $price->id,
            ];
        } catch (ApiErrorException $e) {
            logger()->error('Erro ao criar plano no Stripe', [
                'plan_id' => $plan->id,
                'error' => $e->getMessage(),
            ]);
            throw $e;
        }
    }

    /**
     * Atualizar produto e preço no Stripe
     */
    public function updatePlanInStripe(Plan $plan): void
    {
        try {
            // Atualizar produto
            if ($plan->stripe_product_id) {
                $this->stripe->products->update($plan->stripe_product_id, [
                    'name' => $plan->name,
                    'description' => "Plano {$plan->name} - {$plan->max_stores} lojas",
                    'active' => $plan->active,
                ]);
            }

            // Se o preço mudou, criar novo preço e arquivar o antigo
            if ($plan->stripe_price_id && $plan->isDirty('price_month')) {
                // Arquivar preço antigo
                $this->stripe->prices->update($plan->stripe_price_id, [
                    'active' => false,
                ]);

                // Criar novo preço
                $price = $this->stripe->prices->create([
                    'product' => $plan->stripe_product_id,
                    'unit_amount' => (int) ($plan->price_month * 100),
                    'currency' => 'brl',
                    'recurring' => [
                        'interval' => 'month',
                    ],
                    'metadata' => [
                        'plan_id' => $plan->id,
                    ],
                ]);

                $plan->update(['stripe_price_id' => $price->id]);
            }
        } catch (ApiErrorException $e) {
            logger()->error('Erro ao atualizar plano no Stripe', [
                'plan_id' => $plan->id,
                'error' => $e->getMessage(),
            ]);
            throw $e;
        }
    }

    /**
     * Criar sessão de checkout para assinatura
     */
    public function createCheckoutSession(Plan $plan, Tenant $tenant, string $successUrl, string $cancelUrl): string
    {
        try {
            $session = $this->stripe->checkout->sessions->create([
                'mode' => 'subscription',
                'customer_email' => $tenant->owner->email ?? null,
                'line_items' => [[
                    'price' => $plan->stripe_price_id,
                    'quantity' => 1,
                ]],
                'success_url' => $successUrl,
                'cancel_url' => $cancelUrl,
                'metadata' => [
                    'tenant_id' => $tenant->id,
                    'plan_id' => $plan->id,
                ],
                'subscription_data' => [
                    'metadata' => [
                        'tenant_id' => $tenant->id,
                        'plan_id' => $plan->id,
                    ],
                ],
            ]);

            return $session->url;
        } catch (ApiErrorException $e) {
            logger()->error('Erro ao criar sessão de checkout', [
                'plan_id' => $plan->id,
                'tenant_id' => $tenant->id,
                'error' => $e->getMessage(),
            ]);
            throw $e;
        }
    }

    /**
     * Cancelar assinatura no Stripe
     */
    public function cancelSubscription(Subscription $subscription): void
    {
        try {
            if ($subscription->stripe_subscription_id) {
                $this->stripe->subscriptions->cancel($subscription->stripe_subscription_id);
            }
        } catch (ApiErrorException $e) {
            logger()->error('Erro ao cancelar assinatura no Stripe', [
                'subscription_id' => $subscription->id,
                'error' => $e->getMessage(),
            ]);
            throw $e;
        }
    }

    /**
     * Criar portal do cliente para gerenciar assinatura
     */
    public function createCustomerPortalSession(Subscription $subscription, string $returnUrl): string
    {
        try {
            $session = $this->stripe->billingPortal->sessions->create([
                'customer' => $subscription->stripe_customer_id,
                'return_url' => $returnUrl,
            ]);

            return $session->url;
        } catch (ApiErrorException $e) {
            logger()->error('Erro ao criar portal do cliente', [
                'subscription_id' => $subscription->id,
                'error' => $e->getMessage(),
            ]);
            throw $e;
        }
    }
}
