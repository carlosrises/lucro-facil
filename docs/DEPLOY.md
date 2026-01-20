# 🚀 Deploy em Produção (aaPanel)

## 1️⃣ Configuração do aaPanel

### Document Root

Aponte o site para a pasta `public/`:

```
/www/wwwroot/seu-site/public
```

## 2️⃣ Permissões (executar via SSH)

```bash
# Navegar até a pasta do projeto
cd /www/wwwroot/seu-site

# Permissões das pastas storage e bootstrap/cache
chmod -R 775 storage
chmod -R 775 bootstrap/cache

# Dono das pastas (ajustar para o usuário do servidor web)
chown -R www:www storage
chown -R www:www bootstrap/cache

# Permissões dos assets compilados
chmod -R 755 public
```

## 3️⃣ Compilar Assets

```bash
# No servidor (ou localmente e depois enviar via FTP)
npm install
npm run build
```

## 4️⃣ Cache e Otimizações

```bash
# Limpar todos os caches
php artisan config:clear
php artisan cache:clear
php artisan route:clear
php artisan view:clear

# Otimizar para produção
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

## 5️⃣ Configuração do .env em Produção

Certifique-se que o `.env` está configurado:

```env
APP_ENV=production
APP_DEBUG=false
APP_URL=https://seu-dominio.com

# NÃO inclua variáveis VITE_DEV
```

## 6️⃣ Verificar Assets Compilados

Confirme que existe:

- `/public/build/manifest.json`
- `/public/build/assets/` com arquivos `.js` e `.css`

## 7️⃣ Configuração do Queue (se usar)

```bash
# Supervisor ou similar para manter o worker rodando
php artisan queue:work --queue=ifood-sync --tries=3 --timeout=90
```

## ✅ Checklist de Deploy

- [ ] Document Root aponta para `/public`
- [ ] Permissões 775 em `storage/` e `bootstrap/cache/`
- [ ] Assets compilados com `npm run build`
- [ ] `.env` configurado para produção
- [ ] Caches limpos e otimizados
- [ ] Arquivo `/public/build/manifest.json` existe
- [ ] Queue worker configurado (se necessário)

## 🔧 Troubleshooting

### Erro: ERR_CONNECTION_REFUSED (Vite)

- **Causa**: Laravel está tentando conectar ao servidor Vite
- **Solução**: `php artisan config:clear` ou verificar `APP_ENV=production`

### Erro: 500 Internal Server Error

- **Causa**: Permissões ou cache
- **Solução**: Verificar permissões e rodar `php artisan config:clear`

### Assets não carregam (404)

- **Causa**: Document Root incorreto ou build não feito
- **Solução**: Apontar para `/public` e rodar `npm run build`
