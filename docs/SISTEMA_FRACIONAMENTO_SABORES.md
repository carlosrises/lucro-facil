# Sistema de Fracionamento Automático de Sabores de Pizza

## 🎯 Objetivo

Automatizar o cálculo de custos de sabores de pizza baseado na quantidade de sabores escolhidos pelo cliente, permitindo que um único produto interno (ex: "Frango com Catupiry") seja associado a todos os produtos do marketplace com o mesmo sabor.

## 📋 Como Funciona

### 1. Configuração de Produtos Internos

Na página de **Produtos Internos**, configure:

- **Categoria**: Selecione "Pizza" para bases de pizza
- **Quantidade de Sabores**: Defina quantos sabores a pizza suporta (ex: 2, 3, 4 sabores)

**Exemplo:**

- Produto: "PIZZA GRANDE ATÉ 2 SABORES (10 PEDAÇOS)"
- Categoria: `pizza`
- Quantidade de Sabores: `2`

### 2. Triagem de Items

Na página de **Triagem de Itens** (`/item-triage`):

#### Para Bases de Pizza:

1. Selecione o item (ex: "PIZZA GRANDE ATÉ 2 SABORES (10 PEDAÇOS)")
2. Classifique como **"Produto Pai"**
3. Associe ao produto interno correspondente

#### Para Sabores:

1. Selecione o sabor (ex: "Frango com Catupiry")
2. Classifique como **"Sabor"**
3. Associe a UM ÚNICO produto interno (ex: "Frango c/ Catupiry")

**🔥 INTELIGÊNCIA DO SISTEMA:**
Ao classificar um sabor, o sistema automaticamente:

- Busca TODOS os pedidos que contém aquele sabor (em qualquer variação)
- Calcula a fração baseado no número de sabores de cada pedido
- Cria os mapeamentos automaticamente

### 3. Cálculo Automático de Frações

Quando um pedido chega:

**Cenário 1: Pizza Grande 2 Sabores com 1 sabor**

- Fração: 1/1 = 100% (1.0)
- Custo: CMV do sabor × 1.0

**Cenário 2: Pizza Grande 2 Sabores com 2 sabores**

- Fração: 1/2 = 50% (0.5)
- Custo: CMV do sabor × 0.5

**Cenário 3: Pizza Grande 4 Sabores com 3 sabores**

- Fração: 1/3 = 33.33% (0.333)
- Custo: CMV do sabor × 0.333

**Cenário 4: Pizza com extras/bebidas**

- Sabores: Fracionados conforme acima
- Extras (catupiry, borda): 100% (1.0)
- Bebidas: 100% (1.0)

## 🔧 Fluxo Técnico

### Ao Classificar um Sabor:

```php
// 1. Cria ProductMapping
$mapping = ProductMapping::create([
    'external_item_id' => 'addon_' . md5('Frango com Catupiry'),
    'external_item_name' => 'Frango com Catupiry',
    'item_type' => 'flavor',
    'internal_product_id' => 123, // ID do produto interno
]);

// 2. Chama FlavorMappingService
$service = new FlavorMappingService();
$mappedCount = $service->mapFlavorToAllOccurrences($mapping, $tenantId);

// 3. Para cada pedido com este sabor:
//    - Identifica o produto pai (base da pizza)
//    - Conta quantos sabores vieram no pedido
//    - Calcula fração: 1.0 / número_de_sabores
//    - Cria OrderItemMapping com quantity = fração calculada
```

### Ao Sincronizar Novos Pedidos:

Os novos pedidos virão automaticamente fracionados quando:

1. A base da pizza estiver classificada como "Produto Pai"
2. O produto interno da base tiver categoria = "pizza"
3. Os sabores estiverem classificados como "Sabor"

## 📊 Exemplo Prático

### Configuração:

**Produto Interno: "PIZZA GRANDE ATÉ 2 SABORES"**

- Categoria: `pizza`
- Max Sabores: `2`
- CMV: R$ 8,00

**Produto Interno: "Frango c/ Catupiry"**

- Tipo: Ingredient (Insumo)
- CMV: R$ 12,00

**Produto Interno: "4 Queijos"**

- Tipo: Ingredient (Insumo)
- CMV: R$ 15,00

### Pedido 1: Pizza com 1 sabor (Frango)

| Item                   | Tipo  | Quantidade | CMV Unit. | CMV Total    |
| ---------------------- | ----- | ---------- | --------- | ------------ |
| Pizza Grande 2 Sabores | Base  | 1          | R$ 8,00   | R$ 8,00      |
| Frango c/ Catupiry     | Sabor | 1.0 (100%) | R$ 12,00  | R$ 12,00     |
| **TOTAL**              |       |            |           | **R$ 20,00** |

### Pedido 2: Pizza com 2 sabores (Frango + 4 Queijos)

| Item                   | Tipo  | Quantidade | CMV Unit. | CMV Total    |
| ---------------------- | ----- | ---------- | --------- | ------------ |
| Pizza Grande 2 Sabores | Base  | 1          | R$ 8,00   | R$ 8,00      |
| Frango c/ Catupiry     | Sabor | 0.5 (50%)  | R$ 12,00  | R$ 6,00      |
| 4 Queijos              | Sabor | 0.5 (50%)  | R$ 15,00  | R$ 7,50      |
| **TOTAL**              |       |            |           | **R$ 21,50** |

## 🧪 Testando o Sistema

### Comando de Teste:

```bash
php artisan flavors:test {tenant_id}
```

Este comando mostra:

- ✅ Produtos internos com categoria "pizza"
- ✅ Sabores classificados
- ✅ Bases de pizza classificadas
- ✅ Análise de pedidos recentes
- ✅ Cálculo de frações esperadas
- ✅ Opção de aplicar fracionamento manualmente

### Checklist de Configuração:

- [ ] Produto interno da base configurado com categoria "pizza"
- [ ] Campo "Quantidade de Sabores" preenchido
- [ ] Base de pizza classificada como "Produto Pai" na triagem
- [ ] Base associada ao produto interno correto
- [ ] Sabores classificados como "Sabor" na triagem
- [ ] Cada sabor associado a um produto interno

## 🚨 Regras Importantes

1. **Apenas pizzas são fracionadas**: Outros produtos sempre usam 100% (1.0)
2. **Um sabor, múltiplas variações**: Crie UM produto interno e mapeie todas as variações do marketplace para ele
3. **Extras não são fracionados**: Borda recheada, catupiry extra, etc sempre são 100%
4. **Bebidas não são fracionadas**: Mesmo que venham junto com pizza em combo
5. **Contagem automática**: O sistema conta apenas add-ons classificados como "Sabor"

## 📁 Arquivos do Sistema

### Backend:

- `app/Services/FlavorMappingService.php` - Serviço de fracionamento
- `app/Http/Controllers/ItemTriageController.php` - Controller de triagem
- `app/Console/Commands/TestFlavorFractionation.php` - Comando de teste
- `database/migrations/2026_01_05_000003_add_auto_fraction_to_order_item_mappings.php`

### Frontend:

- `resources/js/pages/item-triage.tsx` - Página de triagem
- `resources/js/components/products/product-form-dialog.tsx` - Form com campos categoria/max_flavors

### Models:

- `app/Models/ProductMapping.php` - Mapeamento de produtos (com item_type)
- `app/Models/InternalProduct.php` - Produtos internos (com category e max_flavors)
- `app/Models/OrderItemMapping.php` - Mapeamento de itens de pedido (com auto_fraction)

## 💡 Exemplos de Uso

### Configurar uma nova pizza:

1. Vá em **Produtos** → Criar/Editar
2. Preencha:
    - Nome: "PIZZA GRANDE 3 SABORES"
    - Categoria: "Pizza"
    - Quantidade de Sabores: 3
    - CMV: (custo da massa, molho, etc)
3. Salve

### Mapear um novo sabor:

1. Vá em **Triagem de Itens**
2. Busque o sabor (ex: "Calabresa")
3. Classifique como "Sabor"
4. Associe ao produto interno "Calabresa"
5. O sistema aplicará automaticamente a todos os pedidos históricos

### Ver resultado:

1. Vá em **Pedidos**
2. Selecione um pedido com pizza
3. Clique em "Detalhes Financeiros"
4. Veja os custos fracionados por sabor
