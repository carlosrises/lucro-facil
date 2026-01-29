# Configuração do Stripe

## Setup Inicial

### 1. Variáveis de Ambiente

Adicione no `.env`:

```env
STRIPE_KEY=pk_test_...
STRIPE_SECRET=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### 2. Obter Webhook Secret

Para desenvolvimento local com Stripe CLI:

```bash
# Instalar Stripe CLI
# https://stripe.com/docs/stripe-cli

# Login
stripe login

# Forward webhooks para local
stripe listen --forward-to http://lucro-facil.test/stripe/webhook

# Copiar o webhook secret exibido e adicionar ao .env
```

Para produção:

1. Acessar Dashboard Stripe → Developers → Webhooks
2. Adicionar endpoint: `https://seu-dominio.com/stripe/webhook`
3. Selecionar eventos:
    - `checkout.session.completed`
    - `customer.subscription.created`
    - `customer.subscription.updated`
    - `customer.subscription.deleted`
    - `invoice.paid`
    - `invoice.payment_failed`
4. Copiar o webhook secret

## Fluxo de Pagamento

### 1. Usuário Clica "Fazer Upgrade"

Frontend (`billing.tsx`):

```typescript
const handleUpgrade = async (planId: number) => {
    const response = await axios.post('/settings/billing/checkout', {
        plan_id: planId,
    });
    window.location.href = response.data.checkout_url;
};
```

### 2. Backend Cria Sessão Checkout

Route (`routes/settings.php`):

```php
Route::post('settings/billing/checkout', function (Request $request) {
    $plan = Plan::findOrFail($request->plan_id);

    $session = $stripe->checkout->sessions->create([
        'line_items' => [[
            'price_data' => [
                'currency' => 'brl',
                'product_data' => ['name' => $plan->name],
                'unit_amount' => (int)($plan->price_month * 100),
                'recurring' => ['interval' => 'month'],
            ],
            'quantity' => 1,
        ]],
        'mode' => 'subscription',
        'success_url' => route('billing.success'),
        'cancel_url' => route('billing.edit'),
        'metadata' => [
            'tenant_id' => $tenant->id,
            'plan_id' => $plan->id,
        ],
    ]);

    return response()->json(['checkout_url' => $session->url]);
});
```

### 3. Stripe Processa Pagamento

Após pagamento bem-sucedido, Stripe envia webhook para:

- URL: `POST /stripe/webhook`
- Evento: `checkout.session.completed`

### 4. Webhook Atualiza Banco de Dados

Controller (`StripeWebhookController.php`):

```php
protected function handleCheckoutCompleted($session) {
    // 1. Buscar tenant pelos metadados
    $tenant = Tenant::find($session->metadata->tenant_id);

    // 2. Atualizar plan_id do tenant
    $tenant->update(['plan_id' => $planId]);

    // 3. Criar subscription no banco
    Subscription::create([
        'tenant_id' => $tenant->id,
        'plan_id' => $planId,
        'status' => 'active',
        'stripe_subscription_id' => $stripeSubscription->id,
        'stripe_customer_id' => $session->customer,
        'started_on' => now(),
        'ends_on' => Carbon::createFromTimestamp($stripeSubscription->current_period_end),
    ]);
}
```

### 5. Usuário Redirecionado para Success Page

URL: `/settings/billing/success`

- Mostra confirmação de pagamento
- Botões para Dashboard ou Billing

## Eventos do Webhook

### checkout.session.completed

- **Quando:** Pagamento inicial concluído
- **Ação:** Criar subscription, atualizar tenant

### customer.subscription.updated

- **Quando:** Status da assinatura muda
- **Ação:** Atualizar status e datas no banco

### customer.subscription.deleted

- **Quando:** Assinatura cancelada
- **Ação:** Atualizar status para 'canceled', voltar para FREE após period_end

### invoice.paid

- **Quando:** Fatura paga (renovação mensal)
- **Ação:** Garantir status 'active'

### invoice.payment_failed

- **Quando:** Falha no pagamento
- **Ação:** Atualizar status para 'past_due', notificar usuário

## Testando Webhooks Localmente

### Opção 1: Stripe CLI (Recomendado)

```bash
# Terminal 1: Laravel
php artisan serve

# Terminal 2: Stripe CLI
stripe listen --forward-to http://localhost:8000/stripe/webhook

# Terminal 3: Trigger eventos de teste
stripe trigger checkout.session.completed
stripe trigger invoice.payment_succeeded
stripe trigger invoice.payment_failed
```

### Opção 2: Ngrok

```bash
# Terminal 1: Laravel
php artisan serve

# Terminal 2: Ngrok
ngrok http 8000

# Usar URL do ngrok no dashboard Stripe
# Exemplo: https://abc123.ngrok.io/stripe/webhook
```

## Verificando Logs

```bash
# Logs do Laravel
tail -f storage/logs/laravel.log | grep -i stripe

# Ver último webhook recebido
php artisan tinker
>>> \App\Models\Subscription::latest()->first()
```

## Status das Subscriptions

- `active` - Assinatura ativa e em dia
- `past_due` - Pagamento falhou, tentando novamente
- `canceled` - Cancelada, acesso até period_end
- `replaced` - Substituída por nova assinatura (upgrade/downgrade)
- `trialing` - Em período de teste

## Troubleshooting

### Webhook não está sendo recebido

1. Verificar URL no dashboard Stripe
2. Verificar se CSRF está desabilitado (`bootstrap/app.php`)
3. Verificar logs: `storage/logs/laravel.log`

### Erro de assinatura inválida

1. Verificar `STRIPE_WEBHOOK_SECRET` no `.env`
2. Regenerar webhook secret no Stripe

### Subscription não é criada

1. Verificar metadados na sessão checkout
2. Verificar logs do webhook
3. Verificar se tenant_id e plan_id estão corretos

## Segurança

- ✅ Webhook secret valida assinatura do Stripe
- ✅ CSRF desabilitado apenas para rota do webhook
- ✅ Todos os eventos são logados
- ✅ Tratamento de erros em cada handler

## Próximos Passos

- [ ] Implementar notificações por email (pagamento falhou, sucesso)
- [ ] Portal do cliente Stripe (gerenciar cartão, cancelar)
- [ ] Métricas de conversão (dashboard admin)
- [ ] Cupons e descontos
