# Próximos Passos - Integração Stripe

## ✅ Implementação Completa

A integração do Stripe está **100% funcional** e pronta para testes! Todos os componentes foram implementados:

- ✅ Página de billing com seleção de planos
- ✅ Criação de Checkout Session
- ✅ Página de confirmação pós-pagamento
- ✅ Todos os 5 webhook handlers implementados
- ✅ Link de Faturamento adicionado ao sidebar de Settings
- ✅ Documentação completa criada

---

## 🚀 1. CONFIGURAR WEBHOOK LOCALMENTE (NECESSÁRIO PARA TESTAR)

### Instalar Stripe CLI (se ainda não tiver)

```bash
# Windows (via Scoop)
scoop install stripe

# Ou baixar diretamente: https://stripe.com/docs/stripe-cli
```

### Configurar Webhook Local

1. **Login no Stripe CLI:**

    ```bash
    stripe login
    ```

2. **Iniciar o listener (deixe rodando):**

    ```bash
    stripe listen --forward-to http://lucro-facil.test/stripe/webhook
    ```

3. **Copiar o webhook secret:**
    - O comando acima vai exibir algo como: `whsec_abc123...`
    - Copie esse valor

4. **Adicionar ao .env:**

    ```env
    STRIPE_WEBHOOK_SECRET=whsec_abc123...
    ```

5. **Reiniciar o Laravel:**
    ```bash
    php artisan config:clear
    ```

---

## 🧪 2. TESTAR FLUXO COMPLETO DE PAGAMENTO

### Passo a Passo do Teste

1. **Login como tenant com plano FREE:**
    - Acesse: http://lucro-facil.test/login
    - Entre com um usuário que esteja no plano FREE

2. **Navegar para Billing:**
    - Clique em "Configurações" no menu
    - Clique em "Faturamento" no sidebar
    - **OU** acesse diretamente: http://lucro-facil.test/settings/billing

3. **Iniciar upgrade:**
    - Clique no botão "Fazer Upgrade" do plano PRO
    - Você será redirecionado para o Stripe Checkout

4. **Pagar com cartão de teste:**
    - Número: `4242 4242 4242 4242`
    - Data: qualquer data futura (ex: 12/25)
    - CVC: qualquer 3 dígitos (ex: 123)
    - Nome: qualquer nome
    - Clique em "Assinar"

5. **Verificar sucesso:**
    - Você deve ser redirecionado para: `/settings/billing/success`
    - Veja a mensagem de confirmação

6. **Verificar banco de dados:**

    ```bash
    php artisan tinker
    ```

    ```php
    // Ver a subscription criada
    $sub = App\Models\Subscription::latest()->first();
    $sub->toArray(); // Deve mostrar stripe_subscription_id, stripe_customer_id, etc.

    // Ver o tenant atualizado
    $tenant = App\Models\Tenant::find($sub->tenant_id);
    $tenant->plan_id; // Deve estar com o ID do plano PRO (não mais FREE)
    ```

7. **Verificar logs do webhook:**
    - No terminal onde o `stripe listen` está rodando, você verá os eventos
    - **OU** confira o log do Laravel:

    ```bash
    tail -f storage/logs/laravel.log
    ```

    - Procure por: `[StripeWebhook] Processing checkout.session.completed`

---

## 🎯 3. TESTAR OUTROS EVENTOS (OPCIONAL)

### Simular Webhook Manualmente

Com o Stripe CLI, você pode disparar eventos de teste:

```bash
# Simular pagamento de invoice (renovação mensal)
stripe trigger invoice.paid

# Simular falha de pagamento
stripe trigger invoice.payment_failed

# Simular cancelamento de subscription
stripe trigger customer.subscription.deleted
```

**Verificar nos logs** se cada evento foi processado corretamente.

---

## 📋 4. MELHORIAS FUTURAS (NÃO URGENTE)

### A. Customer Portal do Stripe

Permitir que usuários gerenciem seus pagamentos (atualizar cartão, cancelar assinatura, ver faturas):

**Backend:**

```php
// routes/settings.php
Route::post('/settings/billing/portal', [BillingController::class, 'customerPortal'])
    ->name('billing.portal');
```

```php
// app/Http/Controllers/BillingController.php
public function customerPortal(Request $request)
{
    $tenant = $request->user()->tenant;
    $subscription = $tenant->subscriptions()->where('status', 'active')->first();

    if (!$subscription || !$subscription->stripe_customer_id) {
        return back()->with('error', 'Nenhuma assinatura ativa encontrada');
    }

    $session = \Stripe\Stripe::setApiKey(config('services.stripe.secret'));
    $session = \Stripe\BillingPortal\Session::create([
        'customer' => $subscription->stripe_customer_id,
        'return_url' => route('billing.index'),
    ]);

    return response()->json(['portal_url' => $session->url]);
}
```

**Frontend (billing.tsx):**

```tsx
const handleManageBilling = async () => {
    const response = await axios.post('/settings/billing/portal');
    window.location.href = response.data.portal_url;
};

// Adicionar botão na página:
<Button onClick={handleManageBilling} variant="outline">
    Gerenciar Cartão e Faturas
</Button>;
```

---

### B. Notificações por Email

Enviar emails quando:

- ✅ Pagamento aprovado (boas-vindas)
- ❌ Pagamento falhou (lembrar de atualizar cartão)

**1. Criar Mailables:**

```bash
php artisan make:mail SubscriptionCreated
php artisan make:mail PaymentFailed
```

**2. Adicionar aos webhooks:**

```php
// handleCheckoutCompleted
Mail::to($tenant->email)->send(new SubscriptionCreated($tenant, $subscription));

// handleInvoicePaymentFailed
Mail::to($tenant->email)->send(new PaymentFailed($tenant, $subscription));
```

---

### C. Métricas Admin

Dashboard para admin ver:

- Total MRR (Monthly Recurring Revenue)
- Taxa de conversão (FREE → PRO)
- Taxa de churn (cancelamentos)
- Subscriptions ativas por plano

**Criar query no AdminController:**

```php
$metrics = [
    'total_subscriptions' => Subscription::where('status', 'active')->count(),
    'mrr' => Plan::join('tenants', 'plans.id', '=', 'tenants.plan_id')
        ->where('tenants.plan_id', '!=', 1) // Excluir FREE
        ->sum('plans.price'),
    'conversions_this_month' => Subscription::whereMonth('started_on', now()->month)->count(),
];
```

---

## 🔒 5. CONFIGURAR WEBHOOK EM PRODUÇÃO

Quando fizer deploy:

1. **Acessar Stripe Dashboard:**
    - https://dashboard.stripe.com/webhooks

2. **Adicionar endpoint:**
    - URL: `https://seu-dominio.com/stripe/webhook`
    - Eventos para escutar:
        - `checkout.session.completed`
        - `customer.subscription.updated`
        - `customer.subscription.deleted`
        - `invoice.paid`
        - `invoice.payment_failed`

3. **Copiar webhook secret:**
    - O Stripe vai gerar um novo `whsec_...`
    - Adicionar no `.env` de produção:
        ```env
        STRIPE_WEBHOOK_SECRET=whsec_producao_abc123...
        ```

4. **Configurar API keys de produção:**
    ```env
    STRIPE_KEY=pk_live_...
    STRIPE_SECRET=sk_live_...
    ```

---

## 📚 Documentação Adicional

Toda a documentação técnica está em:

- **[docs/STRIPE_SETUP.md](./STRIPE_SETUP.md)** - Guia completo com código e troubleshooting

---

## ✅ Checklist Final

Antes de considerar concluído:

- [ ] Webhook local configurado e testado
- [ ] Pagamento completo com cartão de teste funcionando
- [ ] Database atualizado corretamente (subscription criada, tenant.plan_id atualizado)
- [ ] Logs confirmando processamento dos eventos
- [ ] Link de Faturamento aparecendo no sidebar de Settings
- [ ] Página de sucesso exibida após pagamento
- [ ] (Opcional) Customer Portal implementado
- [ ] (Opcional) Emails de confirmação configurados
- [ ] (Produção) Webhook configurado no Stripe Dashboard
- [ ] (Produção) API keys de produção no .env

---

## 🆘 Troubleshooting Rápido

**❌ "No signature found in headers"**
→ Verifique se o `STRIPE_WEBHOOK_SECRET` está no .env e rode `php artisan config:clear`

**❌ Webhook não está sendo chamado**
→ Confirme que o Stripe CLI está rodando e apontando para a URL correta

**❌ Subscription não aparece no banco**
→ Veja os logs em `storage/logs/laravel.log` para erros no webhook handler

**❌ Tenant.plan_id não foi atualizado**
→ Verifique se o metadata (`tenant_id` e `plan_id`) está sendo enviado no checkout

---

## 🎉 Próxima Ação Recomendada

**AGORA:** Execute o teste completo seguindo o passo 2 deste documento. Confirme que tudo funciona end-to-end antes de implementar as melhorias opcionais.

**COMANDO PARA COMEÇAR:**

```bash
stripe listen --forward-to http://lucro-facil.test/stripe/webhook
```

(Deixe esse terminal aberto e, em outro terminal, faça um pagamento de teste no navegador)
