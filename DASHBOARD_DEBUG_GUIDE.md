# Guia de Debug - Dashboard 500

## 🔍 Como Verificar os Logs Agora

Após o deploy, se o erro 500 persistir, você encontrará logs detalhados em:

```bash
# No servidor, verificar logs do Laravel
tail -f storage/logs/laravel.log | grep "Dashboard"
```

### Mensagens de Log Esperadas:

1. **❌ Dashboard - Erro ao buscar pedidos do período**
    - Indica problema na query principal (joins, relacionamentos)
    - Verifique: migrações pendentes, foreign keys quebradas

2. **❌ Dashboard - Erro ao calcular revenue do pedido**
    - Indica estrutura `raw` inconsistente entre providers
    - Verifique: pedidos com campo `raw` NULL ou malformado

3. **❌ Dashboard - Erro ao calcular CMV/impostos dos itens**
    - Indica problema em `items.mappings` ou `items.internalProduct`
    - Verifique: relacionamentos órfãos, eager loading incompleto

4. **❌ Dashboard - Erro ao calcular subsídios**
    - Indica problema na estrutura `raw.session.payments`
    - Verifique: pedidos Takeat com estrutura diferente

5. **❌ Dashboard - Erro fatal ao processar dashboard**
    - Captura QUALQUER outro erro não previsto
    - Log inclui: arquivo, linha, stack trace completo

## 🛠️ Possíveis Causas Identificadas

### 1. Problema com TaxCategory

```php
// Se a migration tax_categories não existe ou FK está quebrada
$item->internalProduct->taxCategory // pode falhar
```

**Solução**: Verificar se a tabela `tax_categories` existe e se o relacionamento está definido em `InternalProduct.php`

### 2. Campo `raw` NULL ou Inválido

```php
// Se o pedido não tem campo raw preenchido
$order->raw['session']['payments'] // falha com erro 500
```

**Solução**: Garantir que todos os pedidos tenham `raw` como JSON válido

### 3. Eager Loading Faltando

```php
// Se taxCategory não está no eager loading
->with(['items.internalProduct.taxCategory']) // CORRETO
->with(['items.internalProduct']) // INCORRETO - faltando taxCategory
```

**Solução**: Garantir que o eager loading está completo

## 🔧 Comandos Úteis para Diagnóstico

```bash
# Verificar pedidos sem campo raw
php artisan tinker
Order::whereNull('raw')->count()
Order::whereNull('raw')->pluck('id')

# Verificar relacionamentos órfãos
InternalProduct::whereHas('items')->whereDoesntHave('taxCategory')->count()

# Testar query da dashboard isoladamente
$user = User::first();
$tenantId = $user->tenant_id;
$orders = Order::where('tenant_id', $tenantId)
    ->with(['items.internalProduct.taxCategory', 'items.mappings.internalProduct'])
    ->take(1)
    ->get();

# Verificar se há erros no eager loading
$orders->first()->items->first()->internalProduct->taxCategory
```

## 📊 Como Testar Localmente

1. **Simular ambiente de produção**:

    ```bash
    # Copiar dados de produção (sanitizados)
    # Executar dashboard com mesmos filtros
    ```

2. **Executar query isolada**:
    ```php
    // No tinker
    $user = User::where('email', 'admin@tenant.com')->first();
    app('App\Http\Controllers\DashboardController')->index(
        new Illuminate\Http\Request([
            'start_date' => '2026-01-01',
            'end_date' => '2026-01-31'
        ])
    );
    ```

## 🚨 Solução Rápida se Persistir

Se após ver os logs ainda não conseguir identificar, adicione logging mais granular:

```php
// Em DashboardController.php, dentro do foreach de orders
logger()->info('🔍 Processando pedido', [
    'order_id' => $order->id,
    'provider' => $order->provider,
    'has_raw' => !empty($order->raw),
    'items_count' => $order->items->count(),
    'has_calculated_costs' => !empty($order->calculated_costs)
]);
```

Isso ajudará a identificar EXATAMENTE qual pedido está causando o problema.
