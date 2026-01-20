# 🚀 Deploy Automático - Guia Rápido

## 1️⃣ Escolha o Workflow

Você tem 2 opções:

### Opção A: `deploy.yml` (Recomendado)

- ✅ Compila assets no GitHub (mais rápido)
- ✅ Copia apenas arquivos compilados para o servidor
- ✅ Menor carga no servidor
- ⚠️ Requer configuração de SCP

### Opção B: `deploy-simple.yml`

- ✅ Mais simples
- ✅ Compila tudo no servidor
- ⚠️ Requer Node.js no servidor
- ⚠️ Deploy mais lento

**Decisão:** Se o servidor tiver Node.js e npm, use `deploy-simple.yml`. Caso contrário, use `deploy.yml`.

## 2️⃣ Desativar o Workflow Não Usado

```bash
# Renomear o workflow não usado para desativá-lo
# Por exemplo, se usar deploy-simple.yml:
git mv .github/workflows/deploy.yml .github/workflows/deploy.yml.disabled
```

## 3️⃣ Configurar Secrets no GitHub

Acesse: `https://github.com/carlosrises/lucro-facil/settings/secrets/actions`

Adicione estes secrets (clique em "New repository secret"):

```
SSH_HOST=seu-servidor.com (ou IP)
SSH_USER=root (ou seu usuário SSH)
SSH_PORT=22
SSH_PRIVATE_KEY=(conteúdo completo do ~/.ssh/id_rsa)
DEPLOY_PATH=/www/wwwroot/lucro-facil
```

### Como obter a chave SSH privada:

```bash
# No seu computador
cat ~/.ssh/id_rsa
```

Copie **TUDO** (incluindo as linhas BEGIN e END) e cole no secret `SSH_PRIVATE_KEY`.

## 4️⃣ Preparar o Servidor

```bash
# Conectar via SSH
ssh usuario@seu-servidor.com

# Navegar até o diretório do projeto
cd /www/wwwroot/lucro-facil

# Configurar Git
git init
git remote add origin https://github.com/carlosrises/lucro-facil.git
git pull origin main

# Configurar .env (se ainda não tiver)
cp .env.example .env
nano .env
```

## 5️⃣ Testar Deploy

```bash
# No seu computador
git add .
git commit -m "test: configure github actions deploy"
git push origin main
```

Então acesse: `https://github.com/carlosrises/lucro-facil/actions`

## 6️⃣ Verificar Deploy

1. Veja os logs no GitHub Actions
2. Se houver erro, leia a mensagem
3. Acesse o site para confirmar

## ❓ Erros Comuns

### "Permission denied (publickey)"

- Verifique se copiou a chave SSH privada correta
- Teste SSH manualmente: `ssh usuario@servidor`

### "Git pull failed"

```bash
# No servidor
cd /www/wwwroot/lucro-facil
git reset --hard origin/main
```

### "npm: command not found" (se usar deploy-simple.yml)

- Instale Node.js no servidor
- Ou use `deploy.yml` ao invés

### Assets não atualizam

- Limpe cache do navegador (Ctrl + Shift + R)
- Verifique se `public/build/` tem os arquivos novos

## 📝 Resumo dos Passos

1. ✅ Escolher workflow (deploy.yml ou deploy-simple.yml)
2. ✅ Desativar o outro workflow
3. ✅ Configurar 5 secrets no GitHub
4. ✅ Preparar Git no servidor
5. ✅ Fazer commit e push
6. ✅ Monitorar deploy no GitHub Actions

---

**Pronto!** Agora cada push para `main` fará deploy automático! 🎉
