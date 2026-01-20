# Deploy WebSocket (Laravel Reverb) em Produção

## 📋 Pré-requisitos

- Servidor com Nginx configurado
- Supervisor instalado
- Queue worker já rodando
- SSL/HTTPS configurado (Let's Encrypt)

## 🔧 1. Configurar Variáveis de Ambiente

No `.env` de produção:

```bash
# Broadcasting
BROADCAST_CONNECTION=reverb

# Reverb - Backend (Laravel se conecta aqui)
REVERB_APP_ID=420608
REVERB_APP_KEY=iztwwm21nfzut6peulkh
REVERB_APP_SECRET=5de1unlf2gsqdgzzchud
REVERB_HOST="127.0.0.1"
REVERB_PORT=8080
REVERB_SCHEME=http

# Reverb - Frontend (navegador se conecta aqui)
VITE_REVERB_APP_KEY="${REVERB_APP_KEY}"
VITE_REVERB_HOST="seudominio.com"  # ⚠️ Trocar pelo domínio real
VITE_REVERB_PORT=443
VITE_REVERB_SCHEME="https"
```

## 🚀 2. Configurar Supervisor para Reverb

Criar arquivo `/etc/supervisor/conf.d/lucro-facil-reverb.conf`:

```ini
[program:lucro-facil-reverb]
command=php /caminho/para/projeto/artisan reverb:start
directory=/caminho/para/projeto
user=www-data
autostart=true
autorestart=true
stopasgroup=true
killasgroup=true
redirect_stderr=true
stdout_logfile=/caminho/para/projeto/storage/logs/reverb.log
stdout_logfile_maxbytes=10MB
stdout_logfile_backups=10
```

**Ativar no Supervisor:**

```bash
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start lucro-facil-reverb
sudo supervisorctl status
```

## 🌐 3. Configurar Proxy WebSocket no Nginx

Editar o arquivo de configuração do site (geralmente em `/etc/nginx/sites-available/seusite`):

Adicionar **antes** do bloco `location /`:

```nginx
# WebSocket Proxy para Laravel Reverb
location /app/ {
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "Upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 86400;
}
```

**Testar e recarregar Nginx:**

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## ✅ 4. Verificar Funcionamento

### 4.1. Verificar Reverb rodando

```bash
sudo supervisorctl status lucro-facil-reverb
# Deve mostrar: RUNNING
```

### 4.2. Verificar logs do Reverb

```bash
tail -f storage/logs/reverb.log
```

Deve mostrar:
```
INFO  Starting server on 0.0.0.0:8080
```

### 4.3. Testar proxy do Nginx

Acessar no navegador:
```
https://seudominio.com/app/iztwwm21nfzut6peulkh
```

Deve retornar erro 400 ou 426 (esperado, significa que o proxy está funcionando).

### 4.4. Testar conexão completa

1. Abrir DevTools (F12) → Console
2. Acessar página de Pedidos
3. Deve aparecer no console:
   ```
   [WebSocket] Conectando ao canal orders.tenant.1
   [WebSocket] Listeners registrados com sucesso
   ```

4. Verificar log do Reverb - deve aparecer:
   ```
   Connection id xyz subscribed to channel orders.tenant.1
   ```

5. Classificar um item na Triagem
6. Deve aparecer toast na página de Pedidos
7. Tabela deve recarregar automaticamente

## 🐛 Troubleshooting

### Erro: "WebSocket connection failed"

**Causa:** Proxy do Nginx não configurado ou SSL inválido

**Solução:**
```bash
# Verificar configuração Nginx
sudo nginx -t

# Ver logs do Nginx
sudo tail -f /var/log/nginx/error.log

# Verificar se Reverb está escutando
netstat -tlnp | grep 8080
```

### Erro: "Connection refused"

**Causa:** Reverb não está rodando

**Solução:**
```bash
# Verificar status
sudo supervisorctl status lucro-facil-reverb

# Ver logs
tail -f storage/logs/reverb.log

# Reiniciar
sudo supervisorctl restart lucro-facil-reverb
```

### Broadcast não chega no frontend

**Causa:** Queue worker não está processando

**Solução:**
```bash
# Verificar queue worker
sudo supervisorctl status lucro-facil-queue

# Ver logs do Laravel
tail -f storage/logs/laravel.log | grep "broadcast\|ItemTriaged"

# Deve aparecer:
# Broadcasting [item.triaged] on channels [orders.tenant.1]
```

### Eventos duplicados

**Causa:** Múltiplos workers ou reconexões

**Solução:**
- Verificar se há apenas 1 worker do Reverb rodando
- Limpar cache do navegador
- Verificar se `toOthers()` está no broadcast

## 📊 Monitoramento

### Logs importantes

```bash
# Reverb
tail -f storage/logs/reverb.log

# Queue (broadcasts)
tail -f storage/logs/laravel.log | grep "BroadcastEvent\|ItemTriaged"

# Laravel (eventos)
tail -f storage/logs/laravel.log | grep "ItemTriaged"

# Nginx (proxy)
sudo tail -f /var/log/nginx/access.log | grep "/app/"
```

### Métricas

- Conexões ativas: Ver logs do Reverb
- Broadcasts enviados: Ver logs do Laravel
- Erros de conexão: Ver logs do Nginx

## 🔄 Atualização/Deploy

Após deploy com `git pull`:

```bash
# Recompilar assets (se alterou frontend)
npm run build

# Reiniciar Reverb (se alterou backend)
sudo supervisorctl restart lucro-facil-reverb

# Reiniciar queue worker (sempre)
sudo supervisorctl restart lucro-facil-queue
```

## 📝 Checklist de Deploy

- [ ] `.env` configurado com domínio correto
- [ ] Supervisor configurado e rodando
- [ ] Nginx com proxy WebSocket configurado
- [ ] SSL/HTTPS funcionando
- [ ] Queue worker rodando
- [ ] Porta 8080 acessível (localhost apenas)
- [ ] Testado: conexão WebSocket
- [ ] Testado: broadcast funcionando
- [ ] Testado: notificação aparecendo
- [ ] Logs monitorados por 24h

## 🎯 Resultado Esperado

Quando tudo estiver funcionando:
1. Usuário classifica item na **Triagem**
2. Backend dispara broadcast `ItemTriaged`
3. Queue worker processa o evento
4. Reverb transmite via WebSocket
5. Frontend recebe o evento
6. **Toast aparece** na página de Pedidos
7. **Tabela recarrega** automaticamente
8. Tudo em **tempo real** (< 1 segundo)
