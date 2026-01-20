# 🚀 Configuração do Deploy Automático com GitHub Actions

## 📋 Pré-requisitos

1. Servidor com acesso SSH
2. Git instalado no servidor
3. Composer instalado no servidor
4. Node.js e npm instalados no servidor (ou compilar localmente)
5. Repositório GitHub configurado

## 🔐 Configurar Secrets no GitHub

Acesse o repositório no GitHub:

1. Vá em **Settings** → **Secrets and variables** → **Actions**
2. Clique em **New repository secret**
3. Adicione os seguintes secrets:

### Secrets Necessários:

| Secret            | Descrição                      | Exemplo                               |
| ----------------- | ------------------------------ | ------------------------------------- |
| `SSH_HOST`        | IP ou domínio do servidor      | `123.456.789.0` ou `seu-servidor.com` |
| `SSH_USER`        | Usuário SSH                    | `root` ou `ubuntu`                    |
| `SSH_PORT`        | Porta SSH (geralmente 22)      | `22`                                  |
| `SSH_PRIVATE_KEY` | Chave SSH privada              | Conteúdo do arquivo `~/.ssh/id_rsa`   |
| `DEPLOY_PATH`     | Caminho do projeto no servidor | `/www/wwwroot/lucro-facil`            |

## 🔑 Gerar Chave SSH (se não tiver)

### No seu computador local:

```bash
# Gerar par de chaves SSH
ssh-keygen -t rsa -b 4096 -C "seu-email@exemplo.com"

# Copiar chave pública para o servidor
ssh-copy-id usuario@seu-servidor.com

# Visualizar chave privada (para copiar no GitHub)
cat ~/.ssh/id_rsa
```

### Copiar chave privada para o GitHub:

1. Copie **TODO** o conteúdo do arquivo `~/.ssh/id_rsa` (incluindo `-----BEGIN` e `-----END`)
2. Cole no secret `SSH_PRIVATE_KEY` no GitHub

## 📦 Configurar Repositório Git no Servidor

### No servidor (via SSH):

```bash
# Navegar até o diretório do projeto
cd /www/wwwroot/lucro-facil

# Inicializar git se ainda não estiver
git init

# Adicionar remote (substitua pelo seu repositório)
git remote add origin https://github.com/carlosrises/lucro-facil.git

# Ou se usar SSH:
git remote add origin git@github.com:carlosrises/lucro-facil.git

# Pull inicial
git pull origin main
```

### Configurar Git para aceitar push sem conflitos:

```bash
# No servidor
cd /www/wwwroot/lucro-facil

# Permitir git pull sem conflitos
git config pull.rebase false

# Ou resetar para o remote antes de cada pull (no deploy.yml)
```

## 🔧 Configurar Permissões no Servidor

```bash
# No servidor
cd /www/wwwroot/lucro-facil

# Permissões corretas
chmod -R 775 storage
chmod -R 775 bootstrap/cache
chown -R www:www storage
chown -R www:www bootstrap/cache
```

## 🚀 Como Usar

### Deploy Automático:

1. Faça commit das suas alterações:

```bash
git add .
git commit -m "Sua mensagem de commit"
git push origin main
```

2. O GitHub Actions vai automaticamente:
    - ✅ Compilar os assets (npm run build)
    - ✅ Fazer SSH no servidor
    - ✅ Fazer git pull
    - ✅ Instalar dependências do Composer
    - ✅ Rodar migrations
    - ✅ Limpar e otimizar caches
    - ✅ Copiar assets compilados
    - ✅ Reiniciar queue workers

### Deploy Manual:

1. Acesse **Actions** no GitHub
2. Selecione **Deploy to Production**
3. Clique em **Run workflow**

## 📊 Monitorar Deploy

1. Acesse a aba **Actions** no GitHub
2. Veja o status do workflow em tempo real
3. Verifique os logs de cada step

## 🔍 Troubleshooting

### Erro: "Permission denied (publickey)"

**Solução:**

- Verifique se a chave SSH privada está correta no secret `SSH_PRIVATE_KEY`
- Teste SSH manualmente: `ssh usuario@servidor`

### Erro: "Git pull failed"

**Solução:**

```bash
# No servidor
cd /www/wwwroot/lucro-facil
git reset --hard origin/main
git pull origin main
```

### Erro: "Composer install failed"

**Solução:**

- Verifique se o Composer está instalado no servidor
- Execute manualmente: `composer install --no-dev --optimize-autoloader`

### Assets não atualizam

**Solução:**

- Verifique se o passo "Copy built assets" está executando
- Verifique permissões da pasta `public/build/`
- Limpe cache do navegador (Ctrl + Shift + R)

## 🛡️ Segurança

### ⚠️ Importante:

1. **Nunca** commite o arquivo `.env` com credenciais
2. Configure o `.env` diretamente no servidor
3. Use secrets do GitHub para informações sensíveis
4. Mantenha a chave SSH privada segura

### .env no Servidor:

```bash
# No servidor, edite o .env
nano /www/wwwroot/lucro-facil/.env

# Configure:
APP_ENV=production
APP_DEBUG=false
APP_URL=https://seu-dominio.com
```

## 📝 Workflow Alternativo (sem compilar assets no Actions)

Se preferir compilar assets no servidor:

```yaml
# Modificar .github/workflows/deploy.yml
# Remover steps de Node.js e adicionar no script SSH:

script: |
    cd ${{ secrets.DEPLOY_PATH }}
    git pull origin main
    npm install
    npm run build
    composer install --no-dev --optimize-autoloader
    # ... resto do script
```

## ✅ Checklist de Configuração

- [ ] Secrets configurados no GitHub
- [ ] Chave SSH gerada e adicionada ao servidor
- [ ] Git configurado no servidor
- [ ] Repositório remoto adicionado no servidor
- [ ] Permissões configuradas (storage, bootstrap/cache)
- [ ] .env configurado no servidor
- [ ] Testado deploy manual via Actions
- [ ] Verificado assets compilados no servidor

## 🎯 Próximos Passos

1. Configure os secrets no GitHub
2. Teste o deploy manual via Actions
3. Faça um commit de teste
4. Monitore o deploy automático
5. Acesse o site para verificar

---

**Dúvidas?** Verifique os logs do GitHub Actions para detalhes de qualquer erro.
