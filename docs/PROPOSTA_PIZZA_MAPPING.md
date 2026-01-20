# Proposta: Sistema de Mapeamento Inteligente para Pizzas

## 1. Problema Atual

### 1.1. Cenário Real - Exemplo de Pedido

```json
{
    "item": {
        "name": "Pizza Família (8 fatias)",
        "sku": "PIZZA-FAM-001",
        "options": [
            { "name": "Mussarela", "external_id": "SAB-001" },
            { "name": "Calabresa", "external_id": "SAB-002" },
            { "name": "Frango Catupiry", "external_id": "SAB-003" },
            { "name": "Borda Recheada", "external_id": "ADD-001" },
            { "name": "Coca-Cola 2L", "external_id": "BEB-001" },
            { "name": "Sem cebola", "external_id": "OBS-001" }
        ]
    }
}
```

**Problema:** Como diferenciar sabores (que devem ter fração 1/3) de adicionais e observações?

---

## 2. Solução Proposta: Tipagem de Options

### 2.1. Estrutura de Dados

#### Nova coluna em `product_mappings`:

```sql
ALTER TABLE product_mappings ADD COLUMN option_type VARCHAR(50) DEFAULT 'regular';
ALTER TABLE product_mappings ADD COLUMN auto_fraction BOOLEAN DEFAULT FALSE;
ALTER TABLE product_mappings ADD COLUMN notes TEXT;
```

**Valores de `option_type`:**

- `pizza_flavor`: Sabor de pizza (calcula fração automaticamente)
- `regular`: Complemento/ingrediente normal (quantity fixa)
- `addon`: Adicional pago (quantity fixa, ex: borda recheada, bebidas)
- `observation`: Observação sem custo (quantity = 0)

### 2.2. Lógica de Cálculo Automático

#### Algoritmo para calcular frações:

```php
function calculatePizzaItemCosts(OrderItem $item): array
{
    $mappings = $item->mappings; // Todos os mappings (main + options)

    // Separar por tipo
    $mainMapping = $mappings->firstWhere('mapping_type', 'main');
    $flavorMappings = $mappings->where('option_type', 'pizza_flavor');
    $regularMappings = $mappings->where('option_type', 'regular');
    $addonMappings = $mappings->where('option_type', 'addon');
    // observations são ignoradas (quantity = 0)

    $costs = [];

    // 1. Custo do produto principal (massa, embalagem, etc)
    if ($mainMapping) {
        $costs[] = [
            'mapping_id' => $mainMapping->id,
            'quantity' => 1, // Pizza inteira
            'unit_cost' => $mainMapping->internal_product->unit_cost,
            'total_cost' => $mainMapping->internal_product->unit_cost
        ];
    }

    // 2. Custos dos sabores (FRAÇÃO AUTOMÁTICA)
    if ($flavorMappings->isNotEmpty()) {
        $flavorCount = $flavorMappings->count();
        $fractionPerFlavor = 1 / $flavorCount; // Ex: 3 sabores = 0.333...

        foreach ($flavorMappings as $flavor) {
            $costs[] = [
                'mapping_id' => $flavor->id,
                'quantity' => $fractionPerFlavor, // FRAÇÃO CALCULADA
                'unit_cost' => $flavor->internal_product->unit_cost,
                'total_cost' => $flavor->internal_product->unit_cost * $fractionPerFlavor
            ];
        }
    }

    // 3. Custos regulares e adicionais (quantity original)
    foreach ($regularMappings->merge($addonMappings) as $extra) {
        $costs[] = [
            'mapping_id' => $extra->id,
            'quantity' => $extra->quantity, // Quantity original do mapping
            'unit_cost' => $extra->internal_product->unit_cost,
            'total_cost' => $extra->internal_product->unit_cost * $extra->quantity
        ];
    }

    return $costs;
}
```

---

## 3. Interface de Usuário

### 3.1. Dialog de Associação (ItemMappingsDialog)

**Campos atuais:**

- Produto Principal (main)
- Options/Complementos (lista)

**Novos campos por option:**

```tsx
<Select>
    <SelectItem value="pizza_flavor">
        🍕 Sabor de Pizza (fração automática)
    </SelectItem>
    <SelectItem value="regular">📦 Complemento Regular</SelectItem>
    <SelectItem value="addon">➕ Adicional Pago</SelectItem>
    <SelectItem value="observation">📝 Observação (sem custo)</SelectItem>
</Select>
```

**Comportamento:**

- Se `pizza_flavor`: Campo quantity desabilitado (será calculado)
- Se `regular` ou `addon`: Campo quantity editável
- Se `observation`: Campo quantity = 0 e disabled

### 3.2. Exibição Visual

```
Pizza Família (8 fatias)
├─ 🏠 Base: Massa + Embalagem (R$ 8,00) [1x]
├─ 🍕 Mussarela (R$ 5,00) [1/3 = R$ 1,67]
├─ 🍕 Calabresa (R$ 6,00) [1/3 = R$ 2,00]
├─ 🍕 Frango Catupiry (R$ 7,00) [1/3 = R$ 2,33]
├─ ➕ Borda Recheada (R$ 4,00) [1x]
├─ ➕ Coca-Cola 2L (R$ 8,00) [1x]
└─ 📝 Sem cebola (R$ 0,00) [observação]

TOTAL: R$ 30,00
```

---

## 4. Fluxo Completo

### 4.1. Primeiro Pedido (Configuração Manual)

1. Pedido chega com Pizza + 3 sabores + 2 adicionais + 1 observação
2. Usuário abre dialog de associação
3. Para cada option, usuário define o tipo:
    - Mussarela → `pizza_flavor`
    - Calabresa → `pizza_flavor`
    - Frango → `pizza_flavor`
    - Borda → `addon`
    - Coca → `addon`
    - Sem cebola → `observation`
4. Sistema salva mappings com `option_type`
5. **Cálculo automático:** 3 sabores detectados → cada um recebe 1/3

### 4.2. Segundo Pedido (Automação Parcial)

1. Novo pedido com mesma Pizza + **2 sabores** (Mussarela + Calabresa)
2. Sistema detecta SKUs já mapeados
3. **Cálculo automático:** 2 sabores detectados → cada um recebe 1/2
4. ✅ Fração ajustada automaticamente!

### 4.3. Terceiro Pedido (Novo Sabor)

1. Pedido com Pizza + Mussarela + Calabresa + **Portuguesa** (novo)
2. Mussarela e Calabresa já mapeados como `pizza_flavor`
3. Portuguesa aparece como não mapeado
4. Usuário mapeia Portuguesa → `pizza_flavor`
5. **Cálculo:** 3 sabores → cada um 1/3

---

## 5. Validações e Regras

### 5.1. Regras de Negócio

- ✅ Um item pode ter **múltiplos sabores** (pizza_flavor)
- ✅ Sabores sempre somam 100% da pizza (1/2 + 1/2, 1/3 + 1/3 + 1/3...)
- ✅ Adicionais e complementos têm quantity fixa
- ✅ Observações sempre têm cost = 0
- ⚠️ Se nenhum sabor for detectado, não aplicar lógica de fração

### 5.2. Casos Especiais

**Caso 1: Pizza meio a meio com preço diferente**

- Sistema calcula média ponderada automaticamente:
    ```
    Mussarela (R$ 5,00) × 1/2 = R$ 2,50
    Calabresa (R$ 6,00) × 1/2 = R$ 3,00
    Total sabores: R$ 5,50
    ```

**Caso 2: Pizza com apenas 1 sabor**

- Sabor recebe 100% (1/1)
    ```
    Mussarela (R$ 5,00) × 1 = R$ 5,00
    ```

**Caso 3: Adicional que é sabor (ex: queijo extra em apenas 1 fatia)**

- Se for adicional localizado → usar `addon` com quantity
- Se for sabor que cobre toda pizza → usar `pizza_flavor`

---

## 6. Implementação Técnica

### 6.1. Migration

```php
Schema::table('product_mappings', function (Blueprint $table) {
    $table->string('option_type', 50)->default('regular')->after('mapping_type');
    $table->boolean('auto_fraction')->default(false)->after('option_type');
    $table->text('notes')->nullable()->after('auto_fraction');

    $table->index('option_type');
});
```

### 6.2. Model

```php
class ProductMapping extends Model
{
    const OPTION_TYPE_PIZZA_FLAVOR = 'pizza_flavor';
    const OPTION_TYPE_REGULAR = 'regular';
    const OPTION_TYPE_ADDON = 'addon';
    const OPTION_TYPE_OBSERVATION = 'observation';

    protected $casts = [
        'auto_fraction' => 'boolean',
    ];

    public function isPizzaFlavor(): bool
    {
        return $this->option_type === self::OPTION_TYPE_PIZZA_FLAVOR;
    }

    public function isObservation(): bool
    {
        return $this->option_type === self::OPTION_TYPE_OBSERVATION;
    }
}
```

### 6.3. Service

```php
class PizzaCostCalculationService
{
    public function calculateItemCost(OrderItem $item): float
    {
        $mappings = $item->mappings;

        // Detectar se é pizza
        $hasPizzaFlavors = $mappings->contains('option_type', 'pizza_flavor');

        if (!$hasPizzaFlavors) {
            // Cálculo normal (não é pizza)
            return $this->calculateRegularItemCost($item);
        }

        // Cálculo especial para pizza
        return $this->calculatePizzaCost($item);
    }

    private function calculatePizzaCost(OrderItem $item): float
    {
        // Implementação do algoritmo da seção 2.2
    }
}
```

---

## 7. Benefícios da Solução

✅ **Automação:** Fração calculada automaticamente<br>
✅ **Flexibilidade:** Aceita pizzas de 1, 2, 3, 4+ sabores<br>
✅ **Precisão:** Diferencia sabores, adicionais e observações<br>
✅ **Reutilização:** Mappings com tipo são reaproveitados<br>
✅ **Transparência:** Usuário vê claramente a fração de cada sabor<br>
✅ **Escalabilidade:** Funciona para qualquer produto com options (não só pizza)<br>

---

## 8. Roadmap de Implementação

### Fase 1: Estrutura de Dados ✅

- Migration para adicionar `option_type`
- Atualizar model `ProductMapping`
- Seeds de exemplo

### Fase 2: Lógica de Cálculo 🔨

- Service para calcular frações de pizza
- Integrar com `calculateItemCost` existente
- Testes unitários

### Fase 3: Interface 🎨

- Adicionar campo de tipo no dialog de associação
- Exibir fração calculada no detalhamento
- Feedback visual de sabores vs adicionais

### Fase 4: Automação 🤖

- Detectar automaticamente produtos já mapeados
- Recalcular frações em novos pedidos
- Sugestão inteligente de tipo baseado em padrões

---

## 9. Perguntas para Validação

1. **Tamanhos de pizza:** Existem tamanhos diferentes (P, M, G, GG)? Isso afeta o custo dos sabores?
2. **Regra de preço:** Quando pizza tem sabores com preços diferentes, qual regra aplicar?
    - Maior preço?
    - Média dos preços?
    - Soma proporcional?
3. **Produtos não-pizza:** Essa lógica deve se aplicar a outros produtos com options? (ex: açaí com complementos)
4. **Histórico:** Ao mudar o tipo de um mapping, recalcular pedidos antigos ou só aplicar daqui pra frente?

---

## 10. Exemplo de Código Completo

```typescript
// Frontend - ItemMappingsDialog.tsx
const optionTypeOptions = [
    { value: 'pizza_flavor', label: '🍕 Sabor de Pizza', description: 'Fração automática' },
    { value: 'regular', label: '📦 Complemento', description: 'Quantidade fixa' },
    { value: 'addon', label: '➕ Adicional', description: 'Quantidade fixa' },
    { value: 'observation', label: '📝 Observação', description: 'Sem custo' },
];

// Backend - PizzaCostCalculationService.php
public function calculatePizzaCost(OrderItem $item): float
{
    $itemQuantity = $item->qty ?? $item->quantity ?? 1;

    // Base cost (massa, embalagem)
    $baseCost = $item->mappings
        ->where('mapping_type', 'main')
        ->sum(fn($m) => floatval($m->internal_product->unit_cost ?? 0));

    // Flavor costs (com fração)
    $flavors = $item->mappings->where('option_type', 'pizza_flavor');
    $flavorCount = $flavors->count();
    $fraction = $flavorCount > 0 ? (1 / $flavorCount) : 0;

    $flavorCost = $flavors->sum(fn($m) =>
        floatval($m->internal_product->unit_cost ?? 0) * $fraction
    );

    // Regular + addon costs (sem fração)
    $extraCost = $item->mappings
        ->whereIn('option_type', ['regular', 'addon'])
        ->sum(fn($m) =>
            floatval($m->internal_product->unit_cost ?? 0) * ($m->quantity ?? 1)
        );

    return ($baseCost + $flavorCost + $extraCost) * $itemQuantity;
}
```

---

**Conclusão:** Esta solução permite gerenciar pizzas e produtos com options de forma inteligente, calculando automaticamente as frações quando necessário e mantendo flexibilidade para casos especiais.
