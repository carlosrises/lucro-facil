# Integração Stripe - Plataforma de Assinatura

## 📋 Visão Geral

Integração completa com Stripe para gerenciar assinaturas recorrentes, com:

- Gestão de planos pelo admin
- Checkout de assinatura
- Webhook para atualização de status
- Middleware para bloqueio de acesso expirado
- Portal do cliente para gerenciar assinatura

## 🗂️ Estrutura Atual

### Tabelas Existentes

- **plans**: Planos de assinatura (código, nome, preço, features)
- **subscriptions**: Assinaturas dos tenants (status, datas, payload gateway)

### Campos Necessários (Migration)

```php
// Adicionar em plans table:
$table->string('stripe_product_id')->nullable()->after('code');
$table->string('stripe_price_id')->nullable()->after('price_month');

// Adicionar em subscriptions table:
$table->string('stripe_subscription_id')->nullable()->after('plan_id');
$table->string('stripe_customer_id')->nullable()->after('tenant_id');
$table->string('stripe_payment_method')->nullable()->after('stripe_subscription_id');
$table->timestamp('trial_ends_at')->nullable()->after('ends_on');
```

## 📦 Pacotes Necessários

```bash
composer require stripe/stripe-php
```

## 🔧 Configuração

### 1. Variáveis de Ambiente (.env)

```env
STRIPE_KEY=pk_test_...
STRIPE_SECRET=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### 2. Config (config/services.php)

```php
'stripe' => [
    'key' => env('STRIPE_KEY'),
    'secret' => env('STRIPE_SECRET'),
    'webhook' => [
        'secret' => env('STRIPE_WEBHOOK_SECRET'),
        'tolerance' => env('STRIPE_WEBHOOK_TOLERANCE', 300),
    ],
],
```

## 🏗️ Implementação

### Fase 1: Migration e Models ✅

- [x] Verificar estrutura existente
- [ ] Criar migration para adicionar campos Stripe
- [ ] Atualizar models Plan e Subscription

### Fase 2: CRUD de Planos (Admin)

- [ ] Controller: PlansController (admin)
- [ ] Rotas admin para gestão de planos
- [ ] Página React para listar/criar/editar planos
- [ ] Sincronização automática com Stripe ao criar/editar plano

### Fase 3: Checkout e Assinatura

- [ ] Controller: SubscriptionController
- [ ] Página de seleção de planos (público/tenant)
- [ ] Checkout Session do Stripe
- [ ] Redirect após sucesso

### Fase 4: Webhooks

- [ ] Controller: StripeWebhookController
- [ ] Eventos:
    - `customer.subscription.created`
    - `customer.subscription.updated`
    - `customer.subscription.deleted`
    - `invoice.payment_succeeded`
    - `invoice.payment_failed`
- [ ] Atualização de status da subscription

### Fase 5: Controle de Acesso

- [ ] Middleware: CheckSubscription
- [ ] Aplicar em rotas protegidas
- [ ] Página de assinatura expirada
- [ ] Grace period configurável

### Fase 6: Portal do Cliente

- [ ] Link para Customer Portal do Stripe
- [ ] Gerenciar forma de pagamento
- [ ] Cancelar assinatura
- [ ] Ver faturas

## 🎯 Fluxo de Uso

### Para o Admin

1. Criar plano no painel admin (nome, preço, features)
2. Sistema cria automaticamente Product e Price no Stripe
3. Plano fica disponível para clientes

### Para o Cliente (Tenant)

1. Acessa página de planos
2. Seleciona plano desejado
3. Redirecionado para Checkout Stripe
4. Preenche dados de pagamento
5. Stripe processa e envia webhook
6. Sistema ativa assinatura
7. Cliente ganha acesso completo

### Renovação Automática

1. Stripe cobra mensalmente
2. Webhook atualiza subscription
3. Se pagamento falha → status "past_due"
4. Após X dias → bloqueia acesso

## 📝 Próximos Passos

Deseja que eu implemente:

1. **Migration** para adicionar campos Stripe
2. **Service StripeService** para encapsular API
3. **CRUD de Planos (Admin)** com sincronização Stripe
4. **Checkout Flow** completo
5. **Webhook Handler** robusto
6. **Middleware de verificação** de assinatura

Qual fase começamos?
