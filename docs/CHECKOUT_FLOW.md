# Fluxo de Checkout - Stripe Integration

## Visão Geral

Este documento descreve o fluxo completo de checkout e assinatura implementado com o Stripe.

## Fluxo do Usuário

### 1. Seleção do Plano (Landing Page ou /plans)

**Landing Page (`/`)**

- Mostra os planos disponíveis na seção de pricing
- Botão "Começar agora" no hero redireciona para `/plans`
- Cada card de plano tem botão que redireciona para `/plans/{plan_id}/choose`

**Página de Planos (`/plans`)**

- Lista todos os planos ativos
- Visual idêntico à landing page
- Botões "Começar agora" que redirecionam para `/plans/{plan_id}/choose`

### 2. Escolha do Plano (`/plans/{plan_id}/choose`)

**Controller:** `SubscriptionController@choose`

**Lógica:**

```php
1. Valida se o plano está ativo
2. Salva o plan_id na sessão
3. Verifica se usuário está autenticado:
   - SIM: Redireciona para /subscription/checkout
   - NÃO: Redireciona para /register
```

### 3. Registro (se não autenticado)

**Página:** `/register` (Laravel Fortify)

**Fluxo:**

1. Usuário preenche formulário de registro
2. Após registro bem-sucedido, é redirecionado automaticamente
3. Sistema detecta `selected_plan_id` na sessão
4. Redireciona automaticamente para `/subscription/checkout`

### 4. Checkout Stripe (`/subscription/checkout`)

**Controller:** `SubscriptionController@checkout`

**Validações:**

- Verifica se usuário está autenticado
- Verifica se não tem assinatura ativa
- Verifica se tem plano selecionado (sessão ou query param)
- Valida se o plano existe e está ativo

**Ações:**

1. Busca o plano selecionado
2. Chama `StripeService->createCheckoutSession($tenant, $plan)`
3. Limpa `selected_plan_id` da sessão
4. Redireciona para URL do Stripe Checkout

**StripeService - createCheckoutSession:**

```php
- Mode: 'subscription'
- Customer Email: email do owner do tenant
- Price: stripe_price_id do plano
- Trial: 14 dias grátis
- Success URL: /subscription/success?session_id={CHECKOUT_SESSION_ID}
- Cancel URL: /subscription/cancel
- Metadata: tenant_id, plan_id
```

### 5. Pagamento no Stripe

**O que acontece:**

1. Usuário é levado para página de checkout do Stripe
2. Preenche dados de cartão de crédito
3. Stripe processa o pagamento
4. Inicia período de trial de 14 dias

**Redirecionamentos:**

- **Sucesso:** `/subscription/success?session_id=xxx`
- **Cancelamento:** `/subscription/cancel`

### 6. Webhook do Stripe (Futuro - Phase 5)

**Evento:** `checkout.session.completed`

**Ações (a implementar):**

```php
1. Validar signature do webhook
2. Extrair metadata (tenant_id, plan_id)
3. Buscar/criar Stripe Customer
4. Criar registro na tabela subscriptions:
   - tenant_id
   - plan_id
   - stripe_customer_id
   - stripe_subscription_id
   - status: 'trialing' ou 'active'
   - trial_ends_at: +14 dias
5. Enviar notificação para o usuário
```

### 7. Página de Sucesso (`/subscription/success`)

**Componente:** `resources/js/pages/subscription/success.tsx`

**Conteúdo:**

- Ícone de sucesso (verde)
- Mensagem de confirmação
- Botão "Ir para o Dashboard"
- Session ID (para debug)

### 8. Página de Cancelamento (`/subscription/cancel`)

**Componente:** `resources/js/pages/subscription/cancel.tsx`

**Conteúdo:**

- Ícone de erro (vermelho)
- Mensagem explicativa
- Botões: "Ver Planos" e "Voltar ao Início"

## Estrutura de Arquivos

### Backend

```
app/
├── Http/Controllers/
│   └── SubscriptionController.php    # Rotas de checkout e gerenciamento
├── Services/
│   └── StripeService.php             # Lógica de integração Stripe
└── Models/
    ├── Plan.php                      # Model de planos
    └── Subscription.php              # Model de assinaturas
```

### Frontend

```
resources/js/pages/
├── welcome.tsx                       # Landing page (botões de plano)
├── plans.tsx                         # Página pública de seleção
└── subscription/
    ├── success.tsx                   # Sucesso do checkout
    └── cancel.tsx                    # Cancelamento do checkout
```

### Rotas

```php
// Públicas
GET  /plans                           → subscription.plans
GET  /plans/{plan}/choose             → subscription.choose

// Autenticadas
GET  /subscription/checkout           → subscription.checkout
GET  /subscription/success            → subscription.success
GET  /subscription/cancel             → subscription.cancel
GET  /subscription/manage             → subscription.manage (Customer Portal)
```

## Sessão e Estado

### Variáveis de Sessão

**`selected_plan_id`**

- Salvo em: `SubscriptionController@choose`
- Usado em: `SubscriptionController@checkout`
- Limpo em: `SubscriptionController@checkout` (após criar checkout session)

### Metadata do Stripe

**Checkout Session:**

```json
{
    "tenant_id": 1,
    "plan_id": 2
}
```

**Subscription:**

```json
{
    "tenant_id": 1,
    "plan_id": 2
}
```

## Customer Portal (Gerenciamento)

**Rota:** `/subscription/manage`

**Função:** Redireciona para o Customer Portal do Stripe onde o cliente pode:

- Ver faturas
- Atualizar método de pagamento
- Cancelar assinatura
- Ver histórico de cobranças

## Próximos Passos (Phase 5 & 6)

### Phase 5 - Webhooks

1. Implementar `StripeWebhookController`
2. Tratar eventos:
    - `checkout.session.completed`
    - `customer.subscription.created`
    - `customer.subscription.updated`
    - `customer.subscription.deleted`
    - `invoice.payment_succeeded`
    - `invoice.payment_failed`
3. Atualizar status das subscriptions

### Phase 6 - Middleware de Acesso

1. Criar `CheckSubscription` middleware
2. Verificar status e validade da assinatura
3. Bloquear acesso se inativo/expirado
4. Aplicar em rotas tenant (exceto admin)

## Testes Locais

### Stripe CLI para Webhooks

```bash
# Instalar Stripe CLI
scoop install stripe

# Login
stripe login

# Forward webhooks para local
stripe listen --forward-to localhost:8000/stripe/webhook

# Testar checkout
stripe trigger checkout.session.completed
```

### URLs de Teste

- Landing: http://localhost:8000/
- Planos: http://localhost:8000/plans
- Checkout: http://localhost:8000/subscription/checkout (requer auth + plan selecionado)

## Variáveis de Ambiente

```env
STRIPE_KEY=pk_test_...
STRIPE_SECRET=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

## Observações Importantes

1. **Trial Period:** 14 dias configurado no `createCheckoutSession`
2. **Customer Email:** Usa o email do owner do tenant
3. **Metadata:** Sempre inclui `tenant_id` e `plan_id` para rastreamento
4. **Session Cleanup:** `selected_plan_id` é limpo após criar checkout session
5. **Validações:** Sempre valida plano ativo e ausência de assinatura ativa
6. **URLs:** Success e Cancel URLs são absolutas com `url()` helper
