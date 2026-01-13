# Debug: CMV mostrando R$ 0,00 em Produção

## Problema

Pizza 4 Queijos (ID 13) mostra CMV R$ 95,98 no formulário de edição, mas R$ 0,00 na tabela de listagem.

## Logs Adicionados

### Backend (ProductsController.php)

- Adicionado log temporário no método `index()` que registra os primeiros 3 produtos
- Log: `[PRODUCTS INDEX] ID: X | Nome: Y | unit_cost: Z`

### Frontend (columns.tsx)

- Adicionado `console.log` na coluna `unit_cost` especificamente para produto ID 13
- Mostra: valor original, tipo, valor parseado, valor final e objeto completo

## Passos para Investigar em Produção

### 1. Fazer Build e Deploy

```bash
# Localmente, fazer build dos assets
npm run build

# Fazer commit e push das alterações
git add .
git commit -m "debug: adicionar logs temporários para investigar unit_cost"
git push

# No servidor, fazer pull e rebuild (se necessário)
```

### 2. Verificar Logs do Backend

No servidor de produção:

```bash
# Ver logs em tempo real
tail -f storage/logs/laravel.log

# Ou buscar logs específicos
grep "\[PRODUCTS INDEX\]" storage/logs/laravel.log | tail -20
```

**O que procurar:**

- Verificar se `unit_cost` tem valor ou está vazio/null
- Comparar com o valor do banco de dados

### 3. Verificar no Browser (Produção)

1. Abrir DevTools (F12)
2. Ir para aba **Network**
3. Acessar página de produtos
4. Localizar requisição `GET /products`
5. Ver a resposta JSON na aba **Preview** ou **Response**
6. Procurar pelo produto ID 13 e verificar o valor de `unit_cost`

### 4. Verificar Console do Browser

1. Abrir DevTools (F12)
2. Ir para aba **Console**
3. Procurar por `[PRODUCTS TABLE DEBUG] Pizza 4 Queijos:`
4. Verificar os valores:
    - `costValue`: deve ser "95.98" (string)
    - `type`: deve ser "string"
    - `cost`: deve ser 95.98 (number)
    - `finalCost`: deve ser 95.98 (number)

## Possíveis Causas

### Causa 1: Cache do Browser

**Sintoma:** Network mostra valor correto, mas tabela mostra 0,00  
**Solução:** Hard refresh (Ctrl+Shift+R) ou limpar cache do browser

### Causa 2: Build Desatualizado

**Sintoma:** Código novo não está em produção  
**Solução:** Fazer novo build e deploy dos assets

### Causa 3: Backend Retornando Null/Vazio

**Sintoma:** Log backend mostra unit_cost vazio  
**Solução:** Verificar migration, casts do model, ou query

### Causa 4: Diferença entre Ambientes

**Sintoma:** Funciona localmente mas não em produção  
**Solução:** Verificar versão do PHP, Laravel, ou configurações do .env

### Causa 5: Erro de Parsing no Frontend

**Sintoma:** Console mostra NaN ou tipo incorreto  
**Solução:** Já corrigido no código (tratamento de NaN)

## Comandos Úteis no Servidor

### Verificar valor no banco de dados

```bash
php artisan tinker
```

```php
\App\Models\InternalProduct::find(13)->unit_cost
```

### Verificar query index

```bash
php artisan tinker
```

```php
$products = \App\Models\InternalProduct::where('tenant_id', 1)->paginate(10);
$product = $products->items()[0];
echo "ID: {$product->id} | Nome: {$product->name} | unit_cost: {$product->unit_cost}";
```

### Limpar caches

```bash
php artisan cache:clear
php artisan config:clear
php artisan view:clear
php artisan route:clear
```

## Após Identificar o Problema

### Remover Logs Temporários

Após descobrir a causa, remover os logs adicionados em:

- `app/Http/Controllers/ProductsController.php` (linhas com `DEBUG TEMPORÁRIO`)
- `resources/js/components/products/columns.tsx` (console.log com produto ID 13)

### Fazer novo build e deploy

```bash
npm run build
git add .
git commit -m "remove: logs temporários de debug"
git push
```

## Checklist de Verificação

- [ ] Build realizado localmente (`npm run build`)
- [ ] Código commitado e enviado para produção
- [ ] Deploy realizado no servidor
- [ ] Logs do backend verificados (`tail -f storage/logs/laravel.log`)
- [ ] Network tab verificado (resposta da API)
- [ ] Console do browser verificado (logs de debug)
- [ ] Hard refresh realizado (Ctrl+Shift+R)
- [ ] Problema identificado e documentado
- [ ] Logs temporários removidos
