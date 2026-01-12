# Correção: Aplicação de Taxas em Múltiplos Pagamentos

## 🐛 Problema Identificado

Quando um pedido possuía **múltiplos pagamentos do mesmo método** (ex: 2 pagamentos de crédito), o sistema aplicava a taxa apenas **uma vez** ao invés de aplicar para cada pagamento individual.

### Exemplo Real (Pedido #2122)

- **Pagamentos:**
    - Cashback Takeat: R$ 8,51
    - Crédito #1: R$ 39,24
    - Crédito #2: R$ 39,24
- **Taxa vinculada:** Taxa Crédito (3%)
- **Comportamento incorreto:** Taxa aplicada 1x = R$ 1,18 (3% de R$ 39,24)
- **Comportamento correto:** Taxa aplicada 2x = R$ 2,36 (1,18 + 1,18)

## 🔧 Causa Raiz

No método `OrderCostService::calculatePaymentMethodTaxes()`, a linha 217 usava:

```php
$matchedPayment = collect($payments)->firstWhere('method', $method);
```

O método `firstWhere()` retorna apenas o **primeiro** pagamento que corresponde ao critério, ignorando os demais pagamentos do mesmo método.

## ✅ Solução Implementada

Alterado para usar `where()` (que retorna uma collection) e iterar sobre **TODOS** os pagamentos correspondentes:

```php
// ANTES: Pegava apenas o primeiro pagamento
$matchedPayment = collect($payments)->firstWhere('method', $method);

// DEPOIS: Pega TODOS os pagamentos do método
$matchedPayments = collect($payments)->where('method', $method);

foreach ($matchedPayments as $matchedPayment) {
    // Aplicar taxa individual para cada pagamento
}
```

### Lógica de Cálculo

Para cada pagamento individual:

1. **Taxa Percentual:** Aplica sobre o **valor do pagamento** (não sobre subtotal)

    ```php
    $calculatedValue = ($paymentValue * $tax->value) / 100;
    ```

2. **Taxa Fixa:** Aplica o **valor fixo** para cada pagamento
    ```php
    $calculatedValue = (float) $tax->value;
    ```

## 📊 Resultado

Após a correção, o pedido #2122 calcula corretamente:

```json
{
    "payment_methods": [
        {
            "name": "Taxa Crédito (Crédito)",
            "calculated_value": 1.18,
            "payment_value": 39.24,
            "payment_method": "CREDIT_CARD"
        },
        {
            "name": "Taxa Crédito (Crédito)",
            "calculated_value": 1.18,
            "payment_value": 39.24,
            "payment_method": "CREDIT_CARD"
        }
    ],
    "total_payment_methods": 2.36
}
```

## 🧪 Testes Realizados

- ✅ Pedido #2122 (2 pagamentos de crédito): Taxa aplicada 2x
- ✅ Pedidos #2120 e #2121: Recálculo funcionando normalmente
- ✅ Não houve regressão em pedidos com pagamento único

## 📁 Arquivos Modificados

- `app/Services/OrderCostService.php` - Método `calculatePaymentMethodTaxes()`

## 📅 Data da Correção

12 de janeiro de 2025
