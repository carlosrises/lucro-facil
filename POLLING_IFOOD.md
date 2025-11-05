# Polling iFood - Configuração para Homologação

## 🎯 Critério 2 de Homologação

**Requisito:** Fazer requests no endpoint `/polling` regularmente a cada 30 segundos.

## ✅ Implementação

### 1. Header `x-polling-merchants`

O job `SyncOrdersJob` agora envia automaticamente o header com os IDs de todos os merchants do tenant:

```php
$merchantIds = Store::where('tenant_id', $tenantId)
    ->where('provider', 'ifood')
    ->pluck('external_store_id')
    ->filter()
    ->unique()
    ->join(',');

$events = $client->get("events/v1.0/events:polling", [], [
    'x-polling-merchants' => $merchantIds,
]);
```

### 2. Comando de Polling Contínuo

#### Opção A: Polling Contínuo (Recomendado para Homologação)

Execute o comando que roda continuamente fazendo polling a cada 30 segundos:

```bash
php artisan ifood:polling
```

**Opções:**

- `--interval=30` - Intervalo em segundos (padrão: 30)

**Exemplo:**

```bash
# Polling padrão (30 segundos)
php artisan ifood:polling

# Polling customizado (60 segundos)
php artisan ifood:polling --interval=60
```

**Saída esperada:**

```
🔄 Iniciando polling iFood (intervalo: 30s)
Pressione Ctrl+C para parar

📡 [14:23:10] Iniciando polling para 2 loja(s)...
  ✓ Loja Principal (ID: 1)
  ✓ Loja Filial (ID: 2)
✅ Polling concluído em 1.2s
💤 Aguardando 28.8s até próximo polling...

📡 [14:23:40] Iniciando polling para 2 loja(s)...
  ✓ Loja Principal (ID: 1)
  ✓ Loja Filial (ID: 2)
✅ Polling concluído em 0.9s
💤 Aguardando 29.1s até próximo polling...
```

#### Opção B: Sincronização Manual

Para executar uma sincronização única:

```bash
php artisan ifood:sync-orders
```

## 🚀 Produção: Supervisor (Linux)

Para manter o polling rodando em background:

### 1. Instalar Supervisor

```bash
sudo apt-get install supervisor
```

### 2. Criar configuração

Arquivo: `/etc/supervisor/conf.d/ifood-polling.conf`

```ini
[program:ifood-polling]
process_name=%(program_name)s
command=php /path/to/lucro-facil2/artisan ifood:polling --interval=30
autostart=true
autorestart=true
redirect_stderr=true
stdout_logfile=/path/to/lucro-facil2/storage/logs/ifood-polling.log
stopwaitsecs=3600
user=www-data
```

### 3. Iniciar serviço

```bash
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start ifood-polling
```

### 4. Verificar status

```bash
sudo supervisorctl status ifood-polling
```

## 🪟 Produção: Windows (NSSM)

### 1. Baixar NSSM

https://nssm.cc/download

### 2. Instalar serviço

```powershell
nssm install IfoodPolling "C:\Path\To\PHP\php.exe" "C:\Path\To\lucro-facil2\artisan ifood:polling --interval=30"
```

### 3. Configurar serviço

```powershell
nssm set IfoodPolling AppDirectory "C:\Path\To\lucro-facil2"
nssm set IfoodPolling AppStdout "C:\Path\To\lucro-facil2\storage\logs\ifood-polling.log"
nssm set IfoodPolling AppStderr "C:\Path\To\lucro-facil2\storage\logs\ifood-polling-error.log"
```

### 4. Iniciar serviço

```powershell
nssm start IfoodPolling
```

## 🔍 Logs

### Ver logs do polling

```bash
tail -f storage/logs/laravel.log | grep "SyncOrdersJob"
```

### Filtrar por tenant/loja

```bash
tail -f storage/logs/laravel.log | grep "tenant.*1.*store.*2"
```

## ⚡ Laravel Scheduler (Fallback)

O Laravel Scheduler está configurado para executar `ifood:sync-orders` a cada 1 minuto como fallback.

**IMPORTANTE:** O Scheduler precisa do cron job:

```bash
* * * * * cd /path/to/lucro-facil2 && php artisan schedule:run >> /dev/null 2>&1
```

## 📊 Monitoramento

### Verificar última sincronização

```php
use App\Models\SyncCursor;

SyncCursor::where('module', 'orders')
    ->orderBy('updated_at', 'desc')
    ->get(['tenant_id', 'store_id', 'updated_at']);
```

### Contar eventos processados

```bash
tail -1000 storage/logs/laravel.log | grep "Eventos para processar" | wc -l
```

## 🧪 Teste de Homologação

1. **Iniciar polling:**

    ```bash
    php artisan ifood:polling
    ```

2. **Criar pedido de teste no iFood:**
    - Fazer pedido via app iFood
    - Aguardar até 30 segundos

3. **Verificar processamento:**
    - Log deve mostrar evento recebido
    - Pedido deve aparecer na tela de Orders

4. **Validar header:**
    - Verificar logs do IfoodClient
    - Header `x-polling-merchants` deve estar presente

## ❓ Troubleshooting

### Polling não detecta pedidos

- Verificar se lojas têm `external_store_id` configurado
- Verificar token OAuth válido
- Verificar logs: `storage/logs/laravel.log`

### Erro "No query results for model [OauthToken]"

- Loja não tem token configurado
- Executar integração OAuth primeiro

### Polling muito lento

- Reduzir número de lojas processadas simultaneamente
- Aumentar intervalo: `--interval=60`
- Usar queue assíncrona para processamento

## 📚 Documentação iFood

- [Events API](https://developer.ifood.com.br/docs/events-api)
- [Polling Endpoint](https://developer.ifood.com.br/docs/eventos#polling)
- [Header x-polling-merchants](https://developer.ifood.com.br/docs/eventos#header-x-polling-merchants)
