<?php

namespace App\Http\Controllers;

use App\Models\Plan;
use App\Models\Subscription;
use App\Models\Tenant;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Stripe\Webhook;

class StripeWebhookController extends Controller
{
    /**
     * Handle incoming Stripe webhooks.
     */
    public function handle(Request $request)
    {
        $payload = $request->getContent();
        $sigHeader = $request->header('Stripe-Signature');
        $webhookSecret = config('services.stripe.webhook.secret');

        try {
            // Verificar assinatura do webhook
            $event = Webhook::constructEvent(
                $payload,
                $sigHeader,
                $webhookSecret
            );

            // Log do evento
            Log::info('Stripe webhook received', [
                'type' => $event->type,
                'id' => $event->id,
            ]);

            // Processar diferentes tipos de eventos
            switch ($event->type) {
                case 'checkout.session.completed':
                    $this->handleCheckoutCompleted($event->data->object);
                    break;

                case 'customer.subscription.created':
                case 'customer.subscription.updated':
                    $this->handleSubscriptionUpdated($event->data->object);
                    break;

                case 'customer.subscription.deleted':
                    $this->handleSubscriptionDeleted($event->data->object);
                    break;

                case 'invoice.paid':
                    $this->handleInvoicePaid($event->data->object);
                    break;

                case 'invoice.payment_failed':
                    $this->handleInvoicePaymentFailed($event->data->object);
                    break;

                case 'product.created':
                case 'product.updated':
                    $this->handleProductUpdated($event->data->object);
                    break;

                case 'product.deleted':
                    $this->handleProductDeleted($event->data->object);
                    break;

                case 'price.created':
                case 'price.updated':
                    $this->handlePriceUpdated($event->data->object);
                    break;

                default:
                    Log::info('Unhandled webhook event type', ['type' => $event->type]);
            }

            return response()->json(['status' => 'success']);
        } catch (\Exception $e) {
            Log::error('Webhook error', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json(['error' => $e->getMessage()], 400);
        }
    }

    /**
     * Handle checkout.session.completed event.
     */
    protected function handleCheckoutCompleted($session)
    {
        Log::info('Checkout completed', [
            'session_id' => $session->id,
            'payment_status' => $session->payment_status ?? 'unknown',
            'metadata' => $session->metadata ?? [],
        ]);

        try {
            // VERIFICAR SE O PAGAMENTO FOI REALMENTE CONCLUÍDO
            // checkout.session.completed é disparado quando o usuário completa o fluxo,
            // mas não garante que o pagamento foi processado com sucesso
            if ($session->payment_status !== 'paid') {
                Log::info('Checkout session completed but payment not paid yet', [
                    'session_id' => $session->id,
                    'payment_status' => $session->payment_status,
                ]);

                // Não atualizar o plano ainda - aguardar confirmação do pagamento
                return;
            }

            // Buscar tenant pelos metadados
            $tenantId = $session->metadata->tenant_id ?? $session->client_reference_id;
            $planId = $session->metadata->plan_id ?? null;

            if (! $tenantId || ! $planId) {
                Log::error('Missing tenant_id or plan_id in checkout session', [
                    'session_id' => $session->id,
                ]);

                return;
            }

            $tenant = Tenant::find($tenantId);
            $plan = Plan::find($planId);

            if (! $tenant || ! $plan) {
                Log::error('Tenant or Plan not found', [
                    'tenant_id' => $tenantId,
                    'plan_id' => $planId,
                ]);

                return;
            }

            // Atualizar tenant com plan_id e marcar onboarding como completo
            // SOMENTE APÓS CONFIRMAÇÃO DO PAGAMENTO
            $tenant->update([
                'plan_id' => $plan->id,
                'onboarding_completed_at' => $tenant->onboarding_completed_at ?? now(),
            ]);

            // Buscar subscription do Stripe
            if ($session->subscription) {
                $stripe = new \Stripe\StripeClient(config('services.stripe.secret'));
                $stripeSubscription = $stripe->subscriptions->retrieve($session->subscription);

                // Cancelar subscription antiga se existir
                $tenant->subscriptions()
                    ->where('status', 'active')
                    ->update(['status' => 'replaced']);

                // Criar nova subscription
                Subscription::create([
                    'tenant_id' => $tenant->id,
                    'plan_id' => $plan->id,
                    'price_interval' => $session->metadata->price_interval ?? 'month',
                    'status' => $stripeSubscription->status,
                    'stripe_subscription_id' => $stripeSubscription->id,
                    'stripe_customer_id' => $session->customer,
                    'stripe_payment_method' => $stripeSubscription->default_payment_method ?? null,
                    'started_on' => now(),
                    'ends_on' => $stripeSubscription->current_period_end ?
                        \Carbon\Carbon::createFromTimestamp($stripeSubscription->current_period_end) :
                        null,
                    'trial_ends_at' => $stripeSubscription->trial_end ?
                        \Carbon\Carbon::createFromTimestamp($stripeSubscription->trial_end) :
                        null,
                ]);

                Log::info('Subscription created successfully', [
                    'tenant_id' => $tenant->id,
                    'plan_id' => $plan->id,
                    'subscription_id' => $stripeSubscription->id,
                ]);
            }
        } catch (\Exception $e) {
            Log::error('Error handling checkout completed', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }

    /**
     * Handle subscription updated event.
     */
    protected function handleSubscriptionUpdated($subscription)
    {
        Log::info('Subscription updated', [
            'subscription_id' => $subscription->id,
            'status' => $subscription->status,
        ]);

        try {
            // Buscar subscription no banco pelo stripe_subscription_id
            $dbSubscription = Subscription::where('stripe_subscription_id', $subscription->id)->first();

            if (! $dbSubscription) {
                Log::warning('Subscription not found in database', [
                    'stripe_subscription_id' => $subscription->id,
                ]);

                return;
            }

            // Atualizar dados da subscription
            $dbSubscription->update([
                'status' => $subscription->status,
                'stripe_payment_method' => $subscription->default_payment_method ?? $dbSubscription->stripe_payment_method,
                'ends_on' => $subscription->current_period_end ?
                    \Carbon\Carbon::createFromTimestamp($subscription->current_period_end) :
                    null,
                'trial_ends_at' => $subscription->trial_end ?
                    \Carbon\Carbon::createFromTimestamp($subscription->trial_end) :
                    null,
            ]);

            Log::info('Subscription updated successfully', [
                'subscription_id' => $dbSubscription->id,
                'status' => $subscription->status,
            ]);
        } catch (\Exception $e) {
            Log::error('Error handling subscription updated', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }

    /**
     * Handle subscription deleted event.
     */
    protected function handleSubscriptionDeleted($subscription)
    {
        Log::info('Subscription deleted', ['subscription_id' => $subscription->id]);

        try {
            // Buscar subscription no banco
            $dbSubscription = Subscription::where('stripe_subscription_id', $subscription->id)->first();

            if (! $dbSubscription) {
                Log::warning('Subscription not found in database for deletion', [
                    'stripe_subscription_id' => $subscription->id,
                ]);

                return;
            }

            // Atualizar status para canceled (mantém acesso até ends_on)
            $dbSubscription->update([
                'status' => 'canceled',
            ]);

            // Se já passou da data de término, voltar para plano FREE
            if ($dbSubscription->ends_on && $dbSubscription->ends_on->isPast()) {
                $freePlan = Plan::where('code', 'FREE')->first();
                if ($freePlan) {
                    $dbSubscription->tenant->update(['plan_id' => $freePlan->id]);
                }
            }

            Log::info('Subscription canceled successfully', [
                'subscription_id' => $dbSubscription->id,
            ]);
        } catch (\Exception $e) {
            Log::error('Error handling subscription deleted', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }

    /**
     * Handle invoice.paid event.
     */
    protected function handleInvoicePaid($invoice)
    {
        Log::info('Invoice paid', [
            'invoice_id' => $invoice->id,
            'amount' => $invoice->amount_paid / 100,
        ]);

        try {
            // Buscar subscription pelo stripe_subscription_id
            if ($invoice->subscription) {
                $dbSubscription = Subscription::where('stripe_subscription_id', $invoice->subscription)->first();

                if ($dbSubscription) {
                    // Garantir que o status está ativo após pagamento bem-sucedido
                    $dbSubscription->update([
                        'status' => 'active',
                    ]);

                    Log::info('Subscription status updated to active after payment', [
                        'subscription_id' => $dbSubscription->id,
                    ]);
                }
            }
        } catch (\Exception $e) {
            Log::error('Error handling invoice paid', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }

    /**
     * Handle invoice.payment_failed event.
     */
    protected function handleInvoicePaymentFailed($invoice)
    {
        Log::info('Invoice payment failed', [
            'invoice_id' => $invoice->id,
            'attempt' => $invoice->attempt_count,
        ]);

        try {
            // Buscar subscription pelo stripe_subscription_id
            if ($invoice->subscription) {
                $dbSubscription = Subscription::where('stripe_subscription_id', $invoice->subscription)->first();

                if ($dbSubscription) {
                    // Atualizar status para past_due
                    $dbSubscription->update([
                        'status' => 'past_due',
                    ]);

                    Log::warning('Subscription status updated to past_due after payment failure', [
                        'subscription_id' => $dbSubscription->id,
                        'attempt' => $invoice->attempt_count,
                    ]);

                    // TODO: Enviar notificação ao usuário
                    // - Email informando falha no pagamento
                    // - Banner no dashboard
                }
            }
        } catch (\Exception $e) {
            Log::error('Error handling invoice payment failed', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }

    /**
     * Handle product created/updated event from Stripe.
     * Syncs Stripe product changes back to local plans.
     */
    protected function handleProductUpdated($product)
    {
        Log::info('[StripeWebhook] Product updated', [
            'product_id' => $product->id,
            'name' => $product->name,
            'active' => $product->active,
        ]);

        try {
            // Buscar plano pelo stripe_product_id
            $plan = Plan::where('stripe_product_id', $product->id)->first();

            if (! $plan) {
                Log::warning('[StripeWebhook] Product not linked to any plan', [
                    'product_id' => $product->id,
                ]);

                return;
            }

            // Atualizar dados do plano (sem disparar observer)
            $plan->withoutEvents(function () use ($plan, $product) {
                $plan->update([
                    'name' => $product->name,
                    'description' => $product->description ?? $plan->description,
                    'active' => $product->active,
                ]);
            });

            Log::info('[StripeWebhook] Plan updated from Stripe product', [
                'plan_id' => $plan->id,
                'plan_code' => $plan->code,
            ]);
        } catch (\Exception $e) {
            Log::error('[StripeWebhook] Error handling product updated', [
                'product_id' => $product->id,
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }

    /**
     * Handle product deleted event from Stripe.
     * Marks the plan as inactive.
     */
    protected function handleProductDeleted($product)
    {
        Log::info('[StripeWebhook] Product deleted', [
            'product_id' => $product->id,
        ]);

        try {
            // Buscar plano pelo stripe_product_id
            $plan = Plan::where('stripe_product_id', $product->id)->first();

            if (! $plan) {
                Log::warning('[StripeWebhook] Product not linked to any plan', [
                    'product_id' => $product->id,
                ]);

                return;
            }

            // Marcar plano como inativo (sem disparar observer)
            $plan->withoutEvents(function () use ($plan) {
                $plan->update(['active' => false]);
            });

            Log::info('[StripeWebhook] Plan marked as inactive from Stripe product deletion', [
                'plan_id' => $plan->id,
                'plan_code' => $plan->code,
            ]);
        } catch (\Exception $e) {
            Log::error('[StripeWebhook] Error handling product deleted', [
                'product_id' => $product->id,
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }

    /**
     * Handle price created/updated event from Stripe.
     * Updates the plan's price_month field.
     */
    protected function handlePriceUpdated($price)
    {
        Log::info('[StripeWebhook] Price updated', [
            'price_id' => $price->id,
            'product_id' => $price->product,
            'unit_amount' => $price->unit_amount,
        ]);

        try {
            // Buscar plano pelo stripe_product_id (price está vinculado a um product)
            $plan = Plan::where('stripe_product_id', $price->product)->first();

            if (! $plan) {
                Log::warning('[StripeWebhook] Price product not linked to any plan', [
                    'price_id' => $price->id,
                    'product_id' => $price->product,
                ]);

                return;
            }

            // Se este price é o ativo, atualizar o plano
            if ($price->active && $price->recurring && $price->recurring->interval === 'month') {
                // Converter de centavos para reais
                $priceInReais = $price->unit_amount / 100;

                // Atualizar plano (sem disparar observer)
                $plan->withoutEvents(function () use ($plan, $price, $priceInReais) {
                    $plan->update([
                        'stripe_price_id' => $price->id,
                        'price_month' => $priceInReais,
                    ]);
                });

                Log::info('[StripeWebhook] Plan price updated from Stripe', [
                    'plan_id' => $plan->id,
                    'plan_code' => $plan->code,
                    'new_price' => $priceInReais,
                ]);
            }
        } catch (\Exception $e) {
            Log::error('[StripeWebhook] Error handling price updated', [
                'price_id' => $price->id,
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }
}
