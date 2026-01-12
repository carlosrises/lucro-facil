# Vínculo em Massa de Taxas de Pagamento

## 📋 Funcionalidade Implementada

Permitir que o usuário vincule uma taxa de pagamento **não apenas a um pedido individual**, mas também a **todos os pedidos** que possuem o mesmo método de pagamento.

## 🎯 Objetivo

Facilitar o gerenciamento de taxas quando o usuário precisa aplicar retroativamente uma taxa para múltiplos pedidos já existentes, evitando ter que vincular manualmente pedido por pedido.

## 🔧 Implementação

### Backend

#### 1. PaymentFeeLinkService - Método `bulkLinkPaymentFeeByMethod()`

```php
public function bulkLinkPaymentFeeByMethod(
    int $tenantId,
    string $paymentMethod,
    int $costCommissionId
): int
```

**Fluxo:**

1. Valida que a taxa existe e pertence ao tenant
2. Busca TODOS os pedidos do tenant
3. Filtra apenas os que possuem o método de pagamento especificado
4. Para cada pedido:
    - Vincula a taxa usando `manuallyLinkPaymentFee()`
    - Recalcula os custos usando `OrderCostService`
    - Atualiza o registro no banco
5. Retorna o número de pedidos afetados

**Método auxiliar:** `getOrderPaymentsForBulk()` - Extrai os métodos de pagamento de cada pedido (suporta Takeat e iFood).

#### 2. OrdersController - Endpoint `linkPaymentFee()`

Ajustado para suportar o parâmetro opcional `apply_to_all`:

```php
$validated = $request->validate([
    'payment_method' => 'required|string',
    'cost_commission_id' => 'required|exists:cost_commissions,id',
    'apply_to_all' => 'nullable|boolean', // Nova opção
]);

if ($validated['apply_to_all'] ?? false) {
    $affectedCount = $linkService->bulkLinkPaymentFeeByMethod(...);
    return redirect()->back()->with('success', "Taxa vinculada a {$affectedCount} pedido(s)!");
}
```

### Frontend

#### LinkPaymentFeeDialog - Checkbox "Aplicar a todos"

Adicionado checkbox antes do footer:

```tsx
const [applyToAll, setApplyToAll] = useState(false);

// No dialog:
<Checkbox
    id="apply-to-all"
    checked={applyToAll}
    onCheckedChange={(checked) => setApplyToAll(checked === true)}
/>
<label htmlFor="apply-to-all">
    Aplicar a todos os pedidos com este método de pagamento
</label>
```

Quando o checkbox está marcado, o parâmetro `apply_to_all: true` é enviado ao backend.

## 📊 Exemplo de Uso

### Cenário Real Testado

- **Tenant:** 1
- **Método de Pagamento:** CREDIT_CARD
- **Taxa:** Taxa Crédito (3%) - ID 24
- **Resultado:** 161 pedidos vinculados automaticamente

### Amostras de Pedidos Afetados

| Pedido | Fee ID | Total Taxas |
| ------ | ------ | ----------- |
| #31    | 24     | R$ 2,55     |
| #66    | 24     | R$ 5,79     |
| #103   | 24     | R$ 3,15     |

## 🔒 Segurança

- ✅ Isolamento multi-tenant: Apenas pedidos do mesmo `tenant_id`
- ✅ Validação de taxa: Verifica que `cost_commission_id` pertence ao tenant
- ✅ Recálculo automático: Todos os pedidos têm custos recalculados após vínculo

## 🚀 Performance

Para grandes volumes de pedidos, o processo pode demorar alguns segundos:

- **161 pedidos:** ~2-3 segundos
- Cada pedido requer:
    - Atualização do campo `payment_fee_links`
    - Recálculo completo de custos
    - Update no banco de dados

## 💡 Melhorias Futuras (Opcional)

1. **Job Assíncrono:** Para volumes muito grandes (1000+ pedidos), processar em background
2. **Filtro de Data:** Permitir aplicar apenas para pedidos de um período específico
3. **Preview:** Mostrar quantos pedidos serão afetados antes de confirmar
4. **Histórico:** Log de operações em massa para auditoria

## 📁 Arquivos Modificados

- `app/Services/PaymentFeeLinkService.php` - Método `bulkLinkPaymentFeeByMethod()` e `getOrderPaymentsForBulk()`
- `app/Http/Controllers/OrdersController.php` - Parâmetro `apply_to_all` em `linkPaymentFee()`
- `resources/js/components/orders/link-payment-fee-dialog.tsx` - Checkbox e lógica de aplicação em massa

## 📅 Data de Implementação

12 de janeiro de 2026
