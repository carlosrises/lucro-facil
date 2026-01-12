# Correção: Vínculo Manual de Taxas de Pagamento

## 🎯 Problema Identificado

O sistema estava bloqueando o vínculo manual de taxas devido a validações muito restritivas de compatibilidade. Mesmo existindo taxas cadastradas, elas não apareciam como opções para seleção se não atendessem a critérios específicos de provider, tipo de pagamento ou método.

### Exemplo do Problema

- **Pedido ID 2122** com meio de pagamento "Crédito"
- **Taxa de crédito cadastrada** no sistema
- **Resultado**: Taxa não aparecia para seleção
- **Mensagem exibida**: "Nenhuma taxa de pagamento cadastrada é compatível com este método"

## ✅ Solução Implementada

### Separação Clara de Fluxos

#### 1. **Vínculo Automático** (Regras Restritivas Mantidas)

- Ocorre automaticamente ao criar/recalcular pedidos
- Usa critérios de compatibilidade rigorosos
- Prioriza taxas específicas para provider/método
- **NÃO foi alterado** - mantém comportamento atual

#### 2. **Vínculo Manual** (Totalmente Flexível - NOVO)

- Usuário pode vincular **qualquer taxa cadastrada**
- Lista **todas** as taxas do tenant
- Mostra análise de compatibilidade **sem bloquear** a seleção
- Taxas recomendadas aparecem primeiro, mas todas são selecionáveis

## 📦 Alterações Realizadas

### Backend (PHP)

#### `app/Services/PaymentFeeLinkService.php`

**Novos Métodos:**

1. **`listAllPaymentFeesForManualLink(int $tenantId): Collection`**
    - Lista TODAS as taxas do tenant sem filtros
    - Usado exclusivamente para vínculo manual
    - Ordenação: provider → name

2. **`checkFeeCompatibility(CostCommission $fee, string $paymentMethod, string $paymentType, Order $order): array`**
    - Analisa compatibilidade sem bloquear
    - Retorna score (0-100) e razões detalhadas
    - Resultado usado apenas para ordenação/feedback visual
    - Estrutura retornada:
        ```php
        [
            'is_compatible' => bool,
            'compatibility_score' => int,
            'reasons' => string[],
            'recommendation' => string
        ]
        ```

3. **`manuallyLinkPaymentFee(Order $order, string $paymentMethod, int $costCommissionId): bool`**
    - Vínculo manual sem validações de compatibilidade
    - Verifica apenas: taxa existe + mesmo tenant
    - Retorna true/false para sucesso

**Método Existente (sem alteração):**

- `listAvailablePaymentFees()` - mantido para vínculo automático

#### `app/Http/Controllers/OrdersController.php`

**Método Atualizado:**

1. **`availablePaymentFees($id, Request $request)`**

    ```php
    // ANTES: Listava apenas taxas compatíveis
    $fees = $linkService->listAvailablePaymentFees(tenant_id(), $provider, $origin);

    // DEPOIS: Lista TODAS as taxas + análise de compatibilidade
    $fees = $linkService->listAllPaymentFeesForManualLink(tenant_id());

    // Se passou paymentMethod, adiciona análise de compatibilidade
    $fees = $fees->map(function ($fee) use (...) {
        $compatibility = $linkService->checkFeeCompatibility(...);
        return array_merge($fee->toArray(), ['compatibility' => $compatibility]);
    });
    ```

2. **`linkPaymentFee($id, Request $request)`**

    ```php
    // ANTES: Validação manual + update direto
    $costCommission = CostCommission::where(...)->firstOrFail();
    $order->update(['payment_fee_links' => ...]);

    // DEPOIS: Usa método dedicado do service
    $success = $linkService->manuallyLinkPaymentFee($order, $method, $id);
    ```

### Frontend (TypeScript/React)

#### `resources/js/components/orders/link-payment-fee-dialog.tsx`

**Interface Atualizada:**

```typescript
interface PaymentFee {
    // ... campos existentes
    compatibility?: {
        is_compatible: boolean;
        compatibility_score: number;
        reasons: string[];
        recommendation: string;
    };
}
```

**Lógica de Listagem:**

```typescript
// ANTES: Filtrava taxas compatíveis
const compatibleFees = availableFees.filter((fee) => {
    if (fee.condition_values?.length > 0) {
        return fee.condition_values.includes(paymentMethod);
    }
    return true;
});

// DEPOIS: Mostra TODAS, ordenadas por score
const allFees = [...availableFees].sort((a, b) => {
    const scoreA = a.compatibility?.compatibility_score ?? 0;
    const scoreB = b.compatibility?.compatibility_score ?? 0;
    return scoreB - scoreA; // Mais compatíveis primeiro
});

const recommendedFees = allFees.filter(
    (fee) => fee.compatibility?.is_compatible !== false,
);
const otherFees = allFees.filter(
    (fee) => fee.compatibility?.is_compatible === false,
);
```

**UI Melhorada:**

- ✅ Separação visual: "✓ Recomendadas" e "Outras Taxas"
- ✅ Badge de compatibilidade: Verde (recomendada) ou Amarelo (verificar)
- ✅ Análise detalhada ao selecionar taxa
- ✅ Mensagem explicativa: "Você pode vincular qualquer taxa manualmente"
- ✅ Remove mensagem de erro restritiva

#### `resources/js/components/orders/order-financial-card.tsx`

**Chamada API Atualizada:**

```typescript
// Passa paymentMethod e paymentType para análise
const response = await fetch(
    `/orders/${order.id}/available-payment-fees?payment_method=${paymentMethod}&payment_type=offline`,
);
```

## 🎨 Fluxo de Uso

### 1. Usuário Clica em "+"

```
order-financial-card.tsx
  ↓ (fetch com payment_method + payment_type)
GET /orders/{id}/available-payment-fees?payment_method=CREDIT&payment_type=offline
  ↓
OrdersController::availablePaymentFees()
  ↓
PaymentFeeLinkService::listAllPaymentFeesForManualLink(tenant_id)
  ↓ (retorna TODAS as taxas)
  ↓ (para cada taxa)
PaymentFeeLinkService::checkFeeCompatibility()
  ↓ (análise de compatibilidade)
  ↓
Retorna taxas + compatibility { score, reasons, recommendation }
```

### 2. Dialog Exibe Taxas

```
LinkPaymentFeeDialog
  ↓
Ordena por compatibility_score (maior primeiro)
  ↓
Separa em:
  - ✓ Recomendadas (score >= 50)
  - Outras Taxas (score < 50)
  ↓
Usuário seleciona QUALQUER taxa (sem bloqueio)
  ↓
Mostra análise detalhada (reasons)
```

### 3. Usuário Confirma Vínculo

```
LinkPaymentFeeDialog::handleLink()
  ↓
POST /orders/{id}/link-payment-fee { payment_method, cost_commission_id }
  ↓
OrdersController::linkPaymentFee()
  ↓
PaymentFeeLinkService::manuallyLinkPaymentFee()
  ↓ (valida: taxa existe + mesmo tenant)
  ↓ (atualiza payment_fee_links)
  ↓
OrderCostService::calculateCosts() [recalcula custos]
  ↓
Toast: "Taxa vinculada manualmente com sucesso!"
```

## 📊 Exemplo de Análise de Compatibilidade

### Taxa Recomendada (Score 90)

```json
{
    "is_compatible": true,
    "compatibility_score": 90,
    "reasons": [
        "Provider exato: takeat",
        "Tipo de pagamento correto: offline",
        "Método específico: CREDIT"
    ],
    "recommendation": "Recomendada"
}
```

### Taxa Não Recomendada (Score 30)

```json
{
    "is_compatible": false,
    "compatibility_score": 30,
    "reasons": [
        "⚠️ Provider diferente: taxa=ifood, pedido=takeat",
        "Tipo de pagamento correto: offline",
        "⚠️ Método não incluído (esperado: PIX, DEBIT_CARD)"
    ],
    "recommendation": "Pode ser vinculada manualmente"
}
```

## ✅ Garantias

### Vínculo Manual

- ✅ Lista **100% das taxas** cadastradas no tenant
- ✅ **Zero bloqueios** por incompatibilidade
- ✅ Análise visual de compatibilidade (informativa apenas)
- ✅ Usuário tem **total controle** da decisão

### Vínculo Automático

- ✅ Mantém regras restritivas (não afetado)
- ✅ Continua priorizando taxas específicas
- ✅ Comportamento inalterado

### Multi-tenant

- ✅ Validação de `tenant_id` em todas operações
- ✅ Isolamento completo entre tenants

### Performance

- ✅ Query otimizada: apenas 1 SELECT para listar taxas
- ✅ Análise de compatibilidade em memória (PHP)
- ✅ Sem N+1 queries

## 🧪 Testes Recomendados

1. **Caso do Pedido 2122**
    - Abrir pedido ID 2122
    - Clicar "+" no meio de pagamento "Crédito"
    - Verificar que taxa de crédito aparece na lista
    - Vincular manualmente
    - Confirmar aplicação da taxa

2. **Taxa Incompatível**
    - Criar taxa para "ifood" + "PIX"
    - Abrir pedido "takeat" + "Crédito"
    - Verificar que taxa aparece em "Outras Taxas"
    - Vincular manualmente (deve funcionar)

3. **Múltiplas Taxas**
    - Cadastrar 5+ taxas de pagamento
    - Abrir qualquer pedido
    - Verificar ordenação (recomendadas primeiro)
    - Verificar análise de compatibilidade

4. **Sem Taxas Cadastradas**
    - Remover todas as taxas de pagamento
    - Abrir pedido e clicar "+"
    - Verificar mensagem: "Nenhuma taxa cadastrada"
    - Verificar botão "Criar Nova Taxa"

## 📝 Resultado Final

### ANTES ❌

```
Usuário clica em "+"
  ↓
Sistema filtra taxas por provider/método
  ↓
Taxa de crédito cadastrada NÃO aparece
  ↓
Mensagem: "Nenhuma taxa compatível"
  ↓
Usuário bloqueado (não consegue vincular)
```

### DEPOIS ✅

```
Usuário clica em "+"
  ↓
Sistema lista TODAS as taxas
  ↓
Taxa de crédito aparece (com análise de compatibilidade)
  ↓
Usuário vê: "✓ Recomendada" ou "⚠ Verificar compatibilidade"
  ↓
Usuário seleciona e vincula (sem bloqueios)
  ↓
Taxa aplicada com sucesso!
```

---

**Status**: ✅ Implementado e Pronto para Teste  
**Impacto**: Zero breaking changes - vínculo automático não afetado  
**Flexibilidade**: 100% - usuário tem controle total no fluxo manual
