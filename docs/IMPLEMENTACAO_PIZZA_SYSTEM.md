# Sistema de Tipagem de Opções e Frações Automáticas de Pizza

## 📋 Resumo da Implementação

Sistema implementado com sucesso para permitir tipagem de opções de pedidos (especialmente pizzas com múltiplos sabores) e cálculo automático de frações.

## ✅ Componentes Implementados

### 1. **Database (Migration)**

- **Arquivo**: `database/migrations/2025_01_09_000001_add_option_type_to_product_mappings.php`
- **Tabela**: `order_item_mappings`
- **Novos Campos**:
    - `option_type` (VARCHAR 50): Tipo da opção
    - `auto_fraction` (BOOLEAN): Ativa cálculo automático
    - `notes` (TEXT): Observações

### 2. **Model**

- **Arquivo**: `app/Models/OrderItemMapping.php`
- **Constantes**:
    ```php
    OPTION_TYPE_PIZZA_FLAVOR = 'pizza_flavor'
    OPTION_TYPE_REGULAR = 'regular'
    OPTION_TYPE_ADDON = 'addon'
    OPTION_TYPE_OBSERVATION = 'observation'
    OPTION_TYPE_DRINK = 'drink'
    ```
- **Novos Métodos**:
    - `isPizzaFlavor()`: Verifica se é sabor de pizza
    - `usesAutoFraction()`: Verifica se usa fração automática
    - `getOptionTypeLabel()`: Retorna label do tipo

### 3. **Service**

- **Arquivo**: `app/Services/PizzaFractionService.php`
- **Funcionalidades**:
    - `recalculateFractions(OrderItem)`: Recalcula frações de um item
    - `calculateFraction(int)`: Calcula fração com base no número de sabores
    - `applyAutoFractions(OrderItem, array)`: Aplica frações antes de salvar
    - `hasPizzaFlavors(OrderItem)`: Verifica se tem sabores de pizza
    - `getPizzaFlavorsSummary(OrderItem)`: Retorna resumo dos sabores

### 4. **Controller**

- **Arquivo**: `app/Http/Controllers/OrderItemMappingsController.php`
- **Alterações**:
    - Integração com `PizzaFractionService`
    - Validação dos novos campos (`option_type`, `auto_fraction`, `notes`)
    - Aplicação automática de frações antes de salvar

### 5. **Frontend**

- **Arquivo**: `resources/js/components/orders/item-mappings-dialog.tsx`
- **Novos Campos UI**:
    - **Select de Tipo**: Dropdown com 5 opções (🍕 Sabor de Pizza, 📦 Item Regular, ➕ Complemento, 🥤 Bebida, 📝 Observação)
    - **Checkbox Auto-Fração**: Aparece quando tipo é "pizza_flavor", com aviso visual em azul
    - **Input Quantidade**: Desabilitado quando auto_fraction está ativo

## 🎯 Como Funciona

### Fluxo de Cálculo Automático:

1. **Usuário marca opções como "Sabor de Pizza"** e ativa "Fração Automática"
2. **Ao salvar**, o service conta quantos sabores têm `auto_fraction: true`
3. **Calcula fração**: `1 / número_de_sabores`
    - 2 sabores = 0.5 (50%) cada
    - 3 sabores = 0.333... (33.3%) cada
    - 4 sabores = 0.25 (25%) cada
4. **Atualiza automaticamente** a quantidade de cada sabor
5. **Cálculo de custo** usa a fração: `unit_cost × quantity`

### Exemplo Real (Pedido #92):

**Item**: Pizza Grande 2 Sabores + Coca-Cola

**Complementos**:

- Pizza De Frango Com Catupiry → Marcado como `pizza_flavor` com `auto_fraction: true` → Fração: 0.5
- Pizza De Mozarela → Marcado como `pizza_flavor` com `auto_fraction: true` → Fração: 0.5
- Refrigerante Coca Cola → Marcado como `drink` → Quantidade: 1.0 (inteiro)

**Resultado**:

- Custo Frango: R$ 15,01 × 0.5 = R$ 7,51
- Custo Mozarela: R$ 16,00 × 0.5 = R$ 8,00
- Custo Coca: R$ 3,50 × 1.0 = R$ 3,50
- **Total**: R$ 19,01

## 🔧 Uso no Sistema

### Na Página de Pedidos:

1. Abrir detalhes do pedido
2. Clicar em "Associar Produtos" em um item com complementos
3. Para cada complemento:
    - Selecionar produto interno
    - **NOVO**: Escolher tipo de opção
    - **NOVO**: Se for sabor de pizza, marcar "Fração Automática"
    - Quantidade será calculada automaticamente
4. Salvar → Sistema calcula e aplica frações

### Tipos de Opções Disponíveis:

| Tipo           | Ícone | Uso                     | Auto-Fração   |
| -------------- | ----- | ----------------------- | ------------- |
| `pizza_flavor` | 🍕    | Sabores de pizza        | ✅ Disponível |
| `regular`      | 📦    | Items normais           | ❌            |
| `addon`        | ➕    | Complementos/adicionais | ❌            |
| `drink`        | 🥤    | Bebidas                 | ❌            |
| `observation`  | 📝    | Observações/instruções  | ❌            |

## 📊 Estrutura de Dados

### Banco de Dados:

```sql
order_item_mappings
├── id
├── tenant_id
├── order_item_id
├── internal_product_id
├── quantity (DECIMAL 10,4)
├── mapping_type (ENUM: main, option, addon)
├── option_type (VARCHAR 50) ← NOVO
├── auto_fraction (BOOLEAN) ← NOVO
├── notes (TEXT) ← NOVO
├── external_reference
├── external_name
└── timestamps
```

### JSON enviado ao backend:

```json
{
    "mappings": [
        {
            "internal_product_id": 1,
            "quantity": 0.5,
            "mapping_type": "addon",
            "option_type": "pizza_flavor",
            "auto_fraction": true,
            "notes": null,
            "external_reference": "0",
            "external_name": "Pizza De Frango Com Catupiry"
        }
    ]
}
```

## 🚀 Próximos Passos (Futuro)

### Possíveis Melhorias:

1. **Tamanhos de Pizza**:
    - Adicionar campo `pizza_size` (P/M/G/GG)
    - Cada tamanho pode ter produto interno diferente
    - Custos variam por tamanho

2. **Cálculo por Borda**:
    - Considerar borda recheada como adicional
    - Soma ao custo base da pizza

3. **Relatório de Sabores Mais Vendidos**:
    - Análise dos sabores com `option_type: pizza_flavor`
    - Ranking por período

4. **Sugestão Automática de Tipo**:
    - ML para detectar padrões em nomes
    - Auto-sugerir tipo baseado em histórico

5. **Templates de Pizza**:
    - Salvar combinações comuns
    - Aplicar template com um clique

## 📝 Testes Realizados

### Teste 1: Pedido #92

- ✅ Migration executada
- ✅ Model atualizado com constantes
- ✅ Service criado e testado
- ✅ Controller integrado
- ✅ UI compilada sem erros
- ✅ Frações calculadas corretamente (0.5 para 2 sabores)

### Cobertura:

- ✅ Estrutura de dados
- ✅ Lógica de cálculo
- ✅ Interface de usuário
- ✅ Validação backend
- ✅ Testes manuais com pedido real

## 📚 Arquivos Criados/Modificados

### Criados:

1. `database/migrations/2025_01_09_000001_add_option_type_to_product_mappings.php`
2. `app/Services/PizzaFractionService.php`
3. `IMPLEMENTACAO_PIZZA_SYSTEM.md` (este arquivo)

### Modificados:

1. `app/Models/OrderItemMapping.php`
2. `app/Http/Controllers/OrderItemMappingsController.php`
3. `resources/js/components/orders/item-mappings-dialog.tsx`

## 💡 Notas Importantes

- Sistema é **opt-in**: Funcionalidade só é ativada quando usuário marca "Fração Automática"
- **Compatibilidade**: Mappings existentes continuam funcionando normalmente
- **Flexibilidade**: Usuário pode desativar auto-fração e definir quantidade manual
- **Performance**: Cálculo é feito apenas ao salvar, não impacta listagens

---

**Status**: ✅ **IMPLEMENTADO E TESTADO**
**Data**: 09/01/2025
**Versão**: 1.0
