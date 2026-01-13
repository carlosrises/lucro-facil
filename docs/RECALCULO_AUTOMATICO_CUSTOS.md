# Sistema de Recálculo Automático de CMV em Cascata

## 📋 Escopo e Regras de Negócio

### ✅ O que o sistema FAZ:

**Atualização exclusiva de CMV no cadastro de produtos:**
- Quando um insumo (`Ingredient`) tem seu `unit_price` alterado
- Quando um produto usado como insumo (`InternalProduct`) tem seu `unit_cost` alterado  
- Recalcula automaticamente o CMV de todos os produtos dependentes
- Aplica em cascata respeitando a hierarquia de composição
- Atualiza apenas o campo `unit_cost` da tabela `internal_products`

### ❌ O que o sistema NÃO FAZ:

**Não altera histórico financeiro:**
- ❌ Não reprocessa pedidos existentes
- ❌ Não altera custos em `orders` ou `order_items`  
- ❌ Não interfere em dados financeiros consolidados
- ❌ Não afeta Dashboard, DRE ou relatórios passados

**Apenas novos pedidos usarão os custos atualizados**

## 🛡️ Proteções Implementadas

### 1. Proteção contra Loops Infinitos ✅

**Problema:** Produto A usa B, e B usa A (dependência circular)

**Solução:**
```php
private static array $processedProducts = [];
```
- Rastreia produtos já processados na cadeia atual
- Interrompe cascata se produto já foi processado
- Log warning quando detecta ciclo
- Reset automático após conclusão ou erro

### 2. Transações Database ✅
- Todo recálculo em `DB::transaction()`
- Rollback automático em erros
- Garante consistência

### 3. Tolerância a Diferenças Mínimas ✅
```php
if (abs($product->unit_cost - $newCmv) > 0.01) {
    // Atualiza apenas se > R$ 0,01
}
```

### 4. Verificação Automática de Dependências ✅
- Não depende do campo `is_ingredient`
- Verifica dinamicamente em `product_costs`
- Cascata apenas quando necessária

### 5. Logs Detalhados ✅
- `INFO`: Atualizações bem-sucedidas
- `WARNING`: Dependências circulares
- `DEBUG`: Mudanças insignificantes
- `ERROR`: Falhas com stack trace

## 🎯 Arquitetura

### Fluxo
```
Insumo/Produto Atualizado → Event → Listener → Recalcula Dependentes → Cascata
```

### Componentes

**Events:**
- `IngredientCostChanged`: Quando ingredient.unit_price muda
- `ProductCostChanged`: Quando product.unit_cost muda

**Listener:**
- `RecalculateDependentProductCosts`: Processa ambos eventos

**Controllers:**
- `IngredientsController::update()`: Dispara evento ingredient
- `ProductsController::update()`: Dispara evento product

## 📊 Exemplo Prático

```
Queijo Mussarela → R$ 50/kg → R$ 60/kg
  ↓
Base 4 Queijos → R$ 39,90 → R$ 46,82 (recalculado)
  ↓  
Pizza 4 Queijos → R$ 65,00 → R$ 71,82 (recalculado)
```

✅ Tudo automático em cascata!

## 🔧 Comando Manual

```bash
# Todos produtos do tenant
php artisan products:recalculate-costs --tenant=1

# Produto específico  
php artisan products:recalculate-costs --tenant=1 --product=123
```

## 📝 Exemplo de Log

```
[INFO] Recalculando custos de produtos dependentes
[INFO] CMV atualizado no cadastro de produtos
    product_name: Base 4 Queijos
    old_cost: 39.90 → new_cost: 46.82
[INFO] Produto é usado como insumo - disparando cascata
[INFO] CMV atualizado no cadastro de produtos  
    product_name: Pizza 4 Queijos
    old_cost: 65.00 → new_cost: 71.82
[INFO] Recalculo concluído - 2 produtos atualizados
```

## 🎯 Garantias

- ✅ **Idempotente**: Executar múltiplas vezes = mesmo resultado
- ✅ **Isolado por tenant**: Respeita tenant_id
- ✅ **Não afeta histórico**: Apenas cadastro atual
- ✅ **Sem loops infinitos**: Proteção integrada
- ✅ **Síncrono**: Executa imediatamente
