# 📊 Sincronização Histórica de Vendas (Sales)

## 🎯 Problema Resolvido

A API de Sales do iFood (`financial/v3.0/merchants/{id}/sales`) **não possui sistema de polling/eventos**, então precisamos buscar vendas por período de datas. Este comando permite:

✅ Buscar vendas retroativas (ex: últimos 30, 60, 90 dias)  
✅ Evitar duplicação mesmo em múltiplas execuções  
✅ Sincronizar lojas específicas ou todas  
✅ Dividir períodos longos em chunks menores  
✅ Controlar rate limit com delay entre requisições

---

## 🚀 Como Usar

### 1️⃣ Sincronizar Todas as Lojas (últimos 30 dias)

```bash
php artisan ifood:sync-historical-sales
```

### 2️⃣ Sincronizar Loja Específica

```bash
php artisan ifood:sync-historical-sales --store=1
```

### 3️⃣ Período Customizado (últimos 90 dias)

```bash
php artisan ifood:sync-historical-sales --from=2025-07-20 --to=2025-10-20
```

### 4️⃣ Com Controle de Rate Limit (delay de 2s entre páginas)

```bash
php artisan ifood:sync-historical-sales --delay=2
```

### 5️⃣ Aumentar tamanho da página (máx: 50)

```bash
php artisan ifood:sync-historical-sales --page-size=50
```

---

## 📋 Parâmetros

| Parâmetro     | Descrição               | Padrão        | Exemplo             |
| ------------- | ----------------------- | ------------- | ------------------- |
| `--store`     | ID da loja (opcional)   | todas         | `--store=1`         |
| `--from`      | Data inicial (Y-m-d)    | 30 dias atrás | `--from=2025-01-01` |
| `--to`        | Data final (Y-m-d)      | hoje          | `--to=2025-10-20`   |
| `--page-size` | Vendas por página       | 50            | `--page-size=30`    |
| `--delay`     | Segundos entre requests | 1             | `--delay=2`         |

---

## 🛡️ Proteção Contra Duplicação

### 1. Índice Único no Banco

```sql
UNIQUE KEY `sales_unique_per_tenant_store`
    (`tenant_id`, `store_id`, `sale_uuid`)
```

### 2. `updateOrCreate` no Eloquent

```php
Sale::updateOrCreate(
    ['tenant_id' => $x, 'store_id' => $y, 'sale_uuid' => $z],
    [...dados...]
);
```

**Resultado**: Mesmo executando o comando 10 vezes, cada venda só existe **UMA VEZ** no banco.

---

## 📊 Exemplo de Saída

```
🚀 Iniciando sincronização histórica de vendas...
📅 Período: 2025-09-20 até 2025-10-20
📄 Tamanho da página: 50
⏱️  Delay entre requisições: 1s
🏪 Lojas a sincronizar: 2

🏪 Loja: Pizzaria Central (ID: 1)
  📅 Buscando: 2025-09-20 até 2025-09-26
    📄 Página 1: 50 vendas
    📄 Página 2: 32 vendas
  📅 Buscando: 2025-09-27 até 2025-10-03
    📄 Página 1: 45 vendas
  ✅ 127 vendas processadas (120 novas, 7 atualizadas)

🏪 Loja: Hamburgueria Express (ID: 2)
  📅 Buscando: 2025-09-20 até 2025-09-26
    📄 Página 1: 28 vendas
  ✅ 28 vendas processadas (28 novas, 0 atualizadas)

✅ Sincronização concluída!
┌────────────────────┬────────┐
│ Métrica            │ Valor  │
├────────────────────┼────────┤
│ Total Processado   │ 155    │
│ Novas Vendas       │ 148    │
│ Atualizadas        │ 7      │
└────────────────────┴────────┘
```

---

## 🔄 Estratégia de Sincronização Recomendada

### **Inicial** (primeira vez)

```bash
# Busca últimos 90 dias
php artisan ifood:sync-historical-sales --from=2025-07-20 --to=2025-10-20 --delay=2
```

### **Periódica** (agendada via cron/scheduler)

```php
// routes/console.php (Laravel 12)

use App\Jobs\SyncSalesJob;
use Illuminate\Support\Facades\Schedule;

// Job automático a cada 2 minutos (janela de 10 min)
Schedule::job(new SyncSalesJob)->everyTwoMinutes();

// OU comando manual diário (últimos 7 dias para garantir)
Schedule::command('ifood:sync-historical-sales --from=-7days')->daily();
```

---

## 🐛 Troubleshooting

### Erro: `Duplicate entry for key 'sales_unique_per_tenant_store'`

✅ **Normal!** O índice único está impedindo duplicação. A venda já existe e foi atualizada.

### Erro: `404 Not Found`

✅ **Normal!** Não há vendas no período especificado. O comando continua normalmente.

### Erro: `401 Unauthorized` ou `Invalid token`

❌ Token expirou. Execute:

```bash
# Re-autentique a loja
php artisan ifood:auth {store_id}
```

### Timeout em períodos longos

Divida em períodos menores:

```bash
php artisan ifood:sync-historical-sales --from=2025-01-01 --to=2025-03-31
php artisan ifood:sync-historical-sales --from=2025-04-01 --to=2025-06-30
php artisan ifood:sync-historical-sales --from=2025-07-01 --to=2025-10-20
```

---

## 💡 Dicas

1. **Primeira execução**: Use delay maior (2-3s) para evitar rate limit
2. **Manutenção diária**: Execute com período curto (últimos 7 dias)
3. **Verificação**: Compare total de vendas com relatório do iFood
4. **Performance**: Aumentar `page-size` reduz quantidade de requests mas aumenta uso de memória

---

## 🔗 Relacionamento Sale ↔ Order

O comando vincula automaticamente `sale.order_id` se encontrar um pedido com mesmo `order_uuid`:

```php
if ($orderUuid && !$saleModel->order_id) {
    $order = Order::where('order_uuid', $orderUuid)->first();
    if ($order) {
        $saleModel->order_id = $order->id;
        $saleModel->save();
    }
}
```

Isso permite navegação bidirecional: Order → Sale e Sale → Order.
