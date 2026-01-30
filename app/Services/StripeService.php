<?php

namespace App\Services;

use App\Models\Plan;
use App\Models\PlanPrice;
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
     * Criar produto e múltiplos preços no Stripe
     */
    public function createPlanWithPrices(Plan $plan): void
    {
        try {
            $product = $this->stripe->products->create([
                'name' => $plan->name,
                'description' => $plan->description,
                'metadata' => [
                    'plan_id' => $plan->id,
                    'plan_code' => $plan->code,
                ],
            ]);

            $plan->withoutEvents(function () use ($plan, $product) {
                $plan->update([
                    'stripe_product_id' => $product->id,
                ]);
            });

            $this->syncPlanPrices($plan->fresh('prices'), [], $product->id);
        } catch (ApiErrorException $e) {
            logger()->error('Erro ao criar plano com preços no Stripe', [
                'plan_id' => $plan->id,
                'error' => $e->getMessage(),
            ]);
            throw $e;
        }
    }

    /**
     * Sincronizar preços do plano no Stripe
     *
     * @param array<int, string> $oldStripePriceIds
     */
    public function syncPlanPrices(Plan $plan, array $oldStripePriceIds = [], ?string $productId = null): void
    {
        $productId = $productId ?? $plan->stripe_product_id;

        if (!$productId) {
            return;
        }

        try {
            foreach ($plan->prices as $price) {
                if ($price->amount === null) {
                    continue;
                }

                if ($price->stripe_price_id) {
                    continue;
                }

                $interval = $price->interval ?: 'month';
                if (!in_array($interval, ['month', 'year'], true)) {
                    continue;
                }

                $stripePrice = $this->stripe->prices->create([
                    'product' => $productId,
                    'unit_amount' => (int) ($price->amount * 100),
                    'currency' => 'brl',
                    'recurring' => [
                        'interval' => $interval,
                    ],
                    'metadata' => [
                        'plan_id' => $plan->id,
                        'plan_price_id' => $price->id,
                        'plan_price_key' => $price->key,
                    ],
                ]);

                $price->update(['stripe_price_id' => $stripePrice->id]);
            }

            foreach ($oldStripePriceIds as $oldStripePriceId) {
                if (!$oldStripePriceId) {
                    continue;
                }

                $this->stripe->prices->update($oldStripePriceId, [
                    'active' => false,
                ]);
            }

            $firstStripePrice = $plan->prices()->whereNotNull('stripe_price_id')->first();
            if ($firstStripePrice && !$plan->stripe_price_id) {
                $plan->withoutEvents(function () use ($plan, $firstStripePrice) {
                    $plan->update(['stripe_price_id' => $firstStripePrice->stripe_price_id]);
                });
            }
        } catch (\Stripe\Exception\InvalidRequestException $e) {
            // Se o produto não existe, limpar referências
            if (str_contains($e->getMessage(), 'No such product')) {
                logger()->warning('Produto não existe na Stripe ao sincronizar preços', [
                    'plan_id' => $plan->id,
                    'stripe_product_id' => $productId,
                ]);

                $plan->update([
                    'stripe_product_id' => null,
                    'stripe_price_id' => null,
                ]);

                $plan->prices()->update(['stripe_price_id' => null]);

                throw $e;
            }
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
     * Atualizar apenas o produto no Stripe
     */
    public function updatePlanProduct(Plan $plan): void
    {
        if (!$plan->stripe_product_id) {
            return;
        }

        try {
            $this->stripe->products->update($plan->stripe_product_id, [
                'name' => $plan->name,
                'description' => $plan->description,
                'active' => $plan->active,
            ]);
        } catch (\Stripe\Exception\InvalidRequestException $e) {
            // Produto não existe mais na Stripe, limpar e recriar
            if (str_contains($e->getMessage(), 'No such product')) {
                logger()->warning('Produto não existe na Stripe, limpando referência', [
                    'plan_id' => $plan->id,
                    'stripe_product_id' => $plan->stripe_product_id,
                ]);

                $plan->update([
                    'stripe_product_id' => null,
                    'stripe_price_id' => null,
                ]);

                // Limpar também os stripe_price_ids dos preços relacionados
                $plan->prices()->update(['stripe_price_id' => null]);

                throw $e; // Re-lança para ser tratado no controller
            }
            throw $e;
        } catch (ApiErrorException $e) {
            logger()->error('Erro ao atualizar produto do plano no Stripe', [
                'plan_id' => $plan->id,
                'error' => $e->getMessage(),
            ]);
            throw $e;
        }
    }

    /**
     * Criar sessão de checkout para assinatura
     *
     * @param string|null $priceInterval 'month' ou 'year'
     */
    public function createCheckoutSession(Tenant $tenant, Plan $plan, ?string $priceInterval = 'month'): string
    {
        $successUrl = url('/subscription/success?session_id={CHECKOUT_SESSION_ID}');
        $cancelUrl = url('/subscription/cancel');

        // Buscar o preço correto (mensal ou anual)
        $planPrice = $plan->prices()
            ->where('interval', $priceInterval)
            ->whereNotNull('stripe_price_id')
            ->first();

        // Se não encontrar preço específico, tentar usar o stripe_price_id do plano
        $stripePriceId = $planPrice?->stripe_price_id ?? $plan->stripe_price_id;

        if (!$stripePriceId) {
            throw new \Exception("Nenhum preço válido encontrado para o plano {$plan->code}");
        }

        try {
            $session = $this->stripe->checkout->sessions->create([
                'mode' => 'subscription',
                'customer_email' => auth()->user()->email ?? $tenant->owner->email ?? null,
                'line_items' => [[
                    'price' => $stripePriceId,
                    'quantity' => 1,
                ]],
                'success_url' => $successUrl,
                'cancel_url' => $cancelUrl,
                'metadata' => [
                    'tenant_id' => $tenant->id,
                    'plan_id' => $plan->id,
                    'price_interval' => $priceInterval,
                ],
                'subscription_data' => [
                    'metadata' => [
                        'tenant_id' => $tenant->id,
                        'plan_id' => $plan->id,
                        'price_interval' => $priceInterval,
                    ],
                    'trial_period_days' => 7, // 7 dias grátis
                ],
            ]);

            return $session->url;
        } catch (ApiErrorException $e) {
            logger()->error('Erro ao criar sessão de checkout', [
                'plan_id' => $plan->id,
                'tenant_id' => $tenant->id,
                'price_interval' => $priceInterval,
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
