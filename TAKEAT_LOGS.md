# 📋 Logs da Integração Takeat

## 🔍 Como Visualizar os Logs

### Opção 1: Tempo Real (Recomendado)

```powershell
Get-Content storage\logs\laravel.log -Wait -Tail 50
```

### Opção 2: Filtrar apenas logs Takeat

```powershell
Get-Content storage\logs\laravel.log | Select-String "Takeat"
```

### Opção 3: Últimas 100 linhas

```powershell
Get-Content storage\logs\laravel.log -Tail 100
```

### Opção 4: Limpar log e começar novo teste

```powershell
Clear-Content storage\logs\laravel.log
Get-Content storage\logs\laravel.log -Wait -Tail 50
```

---

## 📊 Eventos Logados

### 🔐 **Login/Autenticação**

```
🔐 Takeat: Iniciando autenticação
   - url: Base URL + /public/api/sessions
   - email: Email do usuário

🔐 Takeat: Tentativa de login
   - tenant_id, user_id, email

✅ Takeat: Autenticação bem-sucedida
   - restaurant_id, restaurant_name, fantasy_name
   - token_length (tamanho do token JWT)

✅ Takeat: Login concluído com sucesso
   - tenant_id, store_id, restaurant_id, restaurant_name
   - token_expires_at (data de expiração - 15 dias)

❌ Takeat: Falha na autenticação
   - status HTTP, body da resposta, error message
```

### 📦 **Buscar Table Sessions (Pedidos)**

```
📦 Takeat: Buscando table_sessions
   - tenant_id, store_id, store_name
   - url, start_date, end_date

✅ Takeat: table_sessions recebidos
   - tenant_id, store_id
   - total_sessions (quantidade de sessões)
   - response_size (tamanho da resposta)

❌ Takeat: Falha ao buscar table_sessions
   - status HTTP, body, error
```

### 💳 **Buscar Métodos de Pagamento**

```
💳 Takeat: Buscando payment_methods
   - tenant_id, store_id, url

✅ Takeat: payment_methods recebidos
   - total_methods (quantidade)
```

### 🍔 **Buscar Produtos**

```
🍔 Takeat: Buscando products
   - tenant_id, store_id, url

✅ Takeat: products recebidos
   - total_categories (quantidade de categorias)
```

### 🧩 **Buscar Complementos**

```
🧩 Takeat: Buscando complements
   - tenant_id, store_id, url

✅ Takeat: complements recebidos
   - total_categories
```

### ⚙️ **Atualizar Canais Excluídos**

```
⚙️ Takeat: Atualizando canais excluídos
   - tenant_id, store_id
   - excluded_channels: array de canais

✅ Takeat: Canais atualizados
   - store_name, excluded_channels
```

### 🗑️ **Remover Loja**

```
🗑️ Takeat: Tentativa de remover loja
   - tenant_id, store_id

✅ Takeat: Loja removida
   - store_name
```

---

## 🧪 Fluxo de Teste Completo

### 1. **Preparar Terminal**

```powershell
# Limpar log anterior
Clear-Content storage\logs\laravel.log

# Iniciar monitoramento
Get-Content storage\logs\laravel.log -Wait -Tail 50
```

### 2. **Testar Autenticação**

- Acesse: http://localhost/settings/integrations
- Clique no card **Takeat**
- Preencha email e senha
- Clique em **Entrar**

**Logs esperados:**

```
[timestamp] local.INFO: 🔐 Takeat: Iniciando autenticação
[timestamp] local.INFO: 🔐 Takeat: Tentativa de login
[timestamp] local.INFO: ✅ Takeat: Autenticação bem-sucedida
[timestamp] local.INFO: ✅ Takeat: Login concluído com sucesso
```

### 3. **Testar Configuração de Canais**

- Na lista de restaurantes, clique em **⚙️**
- Marque canais para excluir (ex: iFood, 99Food)
- Clique em **Salvar**

**Logs esperados:**

```
[timestamp] local.INFO: ⚙️ Takeat: Atualizando canais excluídos
[timestamp] local.INFO: ✅ Takeat: Canais atualizados
```

### 4. **Testar Sincronização (Dry-Run)**

```powershell
php artisan takeat:sync-orders --dry-run --hours=24
```

**Logs esperados:**

```
[timestamp] local.INFO: 📦 Takeat: Buscando table_sessions
[timestamp] local.INFO: ✅ Takeat: table_sessions recebidos
```

### 5. **Testar Remoção de Loja**

- Clique no ícone **🗑️** do restaurante
- Confirme a exclusão

**Logs esperados:**

```
[timestamp] local.INFO: 🗑️ Takeat: Tentativa de remover loja
[timestamp] local.INFO: ✅ Takeat: Loja removida
```

---

## 🔴 Logs de Erro Comuns

### ❌ Token Expirado

```
[timestamp] local.ERROR: Token Takeat expirado ou não encontrado. Faça login novamente.
```

**Solução:** Fazer login novamente pelo drawer

### ❌ Credenciais Inválidas

```
[timestamp] local.ERROR: ❌ Takeat: Falha na autenticação
    "status": 401,
    "body": "Unauthorized"
```

**Solução:** Verificar email/senha

### ❌ API Indisponível

```
[timestamp] local.ERROR: ❌ Takeat: Falha ao buscar table_sessions
    "status": 500
```

**Solução:** Verificar se API Takeat está online

---

## 📌 Informações Importantes

- **Token expira em:** 15 dias
- **Máximo de dias na consulta:** 3 dias (72 horas)
- **Timezone da API:** UTC-0 (horário de Brasília = UTC-0 + 3h)
- **Campos logados são seguros:** Senha nunca é logada, apenas email e IDs

---

## 💡 Dicas

1. **Use `--dry-run` primeiro** para testar sem salvar dados
2. **Monitore em tempo real** com `-Wait` para debug interativo
3. **Filtre por emoji** para encontrar rapidamente: `Select-String "🔐"`
4. **Limpe o log** antes de cada teste importante
5. **Copie os logs** de erro para análise posterior
