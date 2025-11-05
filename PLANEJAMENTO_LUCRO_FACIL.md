# Planejamento de Desenvolvimento - Projeto Lucro Fácil

## Decisão de Arquitetura (direto ao ponto)

Monolito Laravel único (Admin + App do cliente), com RBAC (Spatie Permissions) e multi-tenant leve por tenant_id.

**Por que assim?**

- Escalável o suficiente para dezenas/centenas de clientes.
- Menor complexidade operacional (um deploy, um pipeline).
- Isolamento lógico por tenant_id em todas as tabelas de domínio (Orders, Financial, etc.).
- Dá para evoluir (se necessário) para multi-database no futuro sem reescrever o domínio.

**Tenants e Stores:** cada cliente (tenant) pode ter múltiplas lojas (iFood/Takeat) com tokens/cursor próprios.
**Sincronização:** dois jobs incrementais por tenant+store: Orders + Financial, com cursor/overlap temporal e Horizon/Redis.
**Admin:** dentro do mesmo app, protegido por roles (admin:system, admin:tenant, etc.). Nada de projeto separado (evita "acoplamento distribuído").

## Linha do Tempo (04/09 → 19/10/2025)

Organização por fases/semana (datas reais de 2025, seg–dom Brasil, fuso America/São_Paulo). Inclui buffers explícitos.

## Fases e Checklist de Funcionalidades

### Fase 0 — Planejamento & Arquitetura

**04–06/09 (qui–sáb)**

- [x] Definição de escopo detalhado (MVP x Plus), KPIs do Dashboard
- [x] Diagrama de entidades (tenants, stores, orders, financial_events, mappings, etc.)
- [x] Plano de filas, rate limit, Horizon, logs, métricas
- [x] Documento de padrões (nomes, migrações, DTOs, camada Services/Actions, testes)
- [x] Backlog priorizado, Gantt/Board criado

**Entregas:** Documento de Arquitetura v1, backlog priorizado, Gantt/Board criado.
**Critério de aceite:** aprovamos a arquitetura tenant_id + módulos e o recorte MVP.

### Semana 1 — Fundação do Projeto

**08–14/09 (seg–dom)**

- [x] Bootstrap do Laravel 12, Spatie Permissions, Breeze/Fortify (com 2FA opcional), Policies
- [x] Migrations base: tenants, stores, oauth_tokens, sync_cursors, users_roles, plans, subscriptions, tickets
- [x] Layout base (React + Inertia.js + Tailwind) para área /app
- [ ] Separação de áreas: /admin x /app (admin ainda não implementado)
- [x] Config de Redis/Queues/Horizon, .env e systemd para Horizon
- [x] Área admin protegida, Horizon em pé

**Entregas:** app sobe com login, área admin protegida, Horizon em pé.
**Aceite:** criar tenant, criar usuário, atribuir role, ver /horizon autenticado.

### Semana 2 — Integração iFood (Orders) + Modelos de Vendas

**15–21/09 (seg–dom)**

- [x] Cliente iFood (service) + refresh de token; config endpoints
- [x] Jobs: SyncSalesJob (baseado em Sales ao invés de Orders), sync_cursors
- [x] Tabelas: sales, sale_items (+ campos brutos em raw)
- [x] Página Vendas: lista por período, filtros
- [ ] Auto-atualização: SSE/Livewire/Pusher opcional

**Entregas:** vendas chegando por loja (store), UI de Vendas funcional.
**Aceite:** criar store com token e ver vendas surgindo; filtros por data/loja.

### Semana 3 — Integração iFood (Financial) + Cálculo Líquido

**22–28/09 (seg–dom)**

- [x] Cliente iFood Financial v3 (events), job SyncFinancialJob com overlap 36–48h
- [x] Tabelas: financial_events, settlements (estrutura)
- [ ] Recompute sales.net_total por sale_uuid (somente hasTransferImpact=true)
- [ ] Validador de divergências (venda sem evento e vice-versa)
- [ ] Relatório básico financeiro por período

**Entregas:** líquido por venda consolidado, relatório básico financeiro por período.
**Aceite:** comparar amostras com extrato/planilha; ver net_total coerente.

### Fase 4 — Produtos Internos, Insumos e Mapeamento

- [x] Módulo Produtos Internos & Insumos: internal_products, ingredients, product_costs
- [x] Associação product_mappings ↔ produtos iFood (por SKU/código)
- [x] UI de mapeamento com busca
- [x] Margem de contribuição customizável por produto/categoria
- [x] Cadastro completo + tela de mapeamento + custo unitário por item

### Fase 5 — Curva ABC + Bandeiras e Custo Financeiro

- [x] Curva ABC (por receita líquida/volume): cálculo e relatório
- [x] Custo por bandeira: regras fixas aplicadas por pedido
- [x] Painel Dashboard MVP: KPIs (pedidos, bruto, líquido, ticket médio, top produtos)
- [x] Relatórios ABC; dashboard inicial ligado ao dado “líquido”

### Fase 6 — Módulo Financeiro Interno (Operacional)

- [x] Cadastros: Categorias de Despesa e Receita
- [x] Movimentações Operacionais com vínculo à categoria (CRUD + import CSV)
- [x] Resumo Financeiro: consolidado (Operacional + Vendas iFood/Takeat), filtros, exportação (PDF/Excel)
- [x] Financeira interna funcionando e refletindo no resultado

### SaaS Multiusuário + Admin

- [x] Isolamento por tenant_id
- [x] Admin gerencia clientes/planos/pagamentos/chamados
- [x] Logs/auditoria básicos

### Integrações

- [x] iFood: autentica, puxa Orders + Events, cursor e overlap; trata 401/429/5xx com retry/backoff
- [ ] Takeat: autentica e puxa pedidos; estratégia de polling/cron por janela

## Critérios de Aceite por item

- [x] **1.1.1 Dashboard:** KPIs por período/loja; gráficos (ApexCharts) e cards; refletem dados de Vendas básicos
- [x] **1.1.2 Vendas básicas:** lista vendas, filtros por data/loja/status (sem auto-atualização por enquanto)
- [ ] **1.1.3 Produtos/Insumos:** CRUD completo, custo unitário calculado, margem configurável
- [x] **1.1.4 iFood:** autentica, puxa Sales + Events, cursor e overlap; trata 401/429/5xx com retry/backoff
- [ ] **1.1.5 Takeat:** autentica e puxa pedidos; estratégia de polling/cron por janela
- [ ] **1.1.6 Associação:** tela para mapear produtos internos ao item iFood/Takeat; persistência e uso no cálculo de custo/margem
- [ ] **1.1.7 Margem:** configuração por produto/categoria com prioridade; refletindo em relatórios
- [ ] **1.1.8 Curva ABC:** cálculo por período, por loja; exportável
- [ ] **1.1.9 Bandeiras:** regras fixas aplicadas na composição do líquido; parametrizáveis futuramente
- [x] **1.1.10 SaaS Multiusuário + Admin:** isolamento por tenant_id; Admin gerencia clientes/planos/pagamentos/chamados; logs/auditoria básicos
- [x] **1.1.11 Financeiro (estrutura):** categorias (despesa/receita), lançamentos (estrutura base)

## Integrações & Sincronização

### iFood (Sales + Financial v3)

- [x] Jobs: SyncSalesJob por tenant+store
- [ ] Cálculo do líquido por venda: soma de financial_events com hasTransferImpact=true por sale_uuid
- [x] Buffers: overlap 36–48h na busca; idempotência por event_id
- [x] Homologação: x-request-homologation: true onde aplicável; mocks para endpoints sem dataset de teste

### Takeat

- [ ] Estruturar client/serviço com janela por período e cursor se existir
- [ ] Unificar modelo de vendas (adapter) para alimentar Vendas/Dashboard

### Horizon/Queues

- [x] Filas orders, financial, backfill
- [ ] Sharding + jitter no Scheduler para distribuir tenants e evitar pico/429

## Segurança, Logs e Observabilidade

- [x] Tokens criptografados (encrypt()/KMS), mascarar em logs
- [x] RBAC: Spatie Permissions em todas as rotas sensíveis
- [ ] Rate limiting por tenant/store (RateLimiter Laravel)
- [x] Logs: sync por tenant/store (último sucesso/erro), dead-letter queue
- [ ] Métricas: eventos/min, 429/min, vendas sem net_total, latência média, fila em atraso
- [x] Auditoria: mudanças de plano/limite, login/admin actions

## Riscos & Buffers

- [x] APIs instáveis (picos 429/5xx): mitigado com backoff + jitter + overlap
- [ ] Dados divergentes (venda sem evento financeiro imediato): painel de divergências + recompute noturno
- [x] Crescimento: índices e paginação; se necessário, read replicas ou materialized views para relatórios pesados

## Checklist de Liberação (18–19/10)

- [ ] Testes manuais com 2–3 tenants e múltiplas stores (cenários feliz/erro)
- [ ] Conferência de KPIs com amostra real (planilha cliente)
- [ ] Verificação de permissões (admin, gestor, operador) e escopo por tenant
- [ ] Filas/Horizon estáveis por 24–48h (monitorando 429/5xx)
- [ ] Backups configurados e .env saneado
- [ ] Termos de uso/privacidade (mínimos) e suporte (tickets) funcionando

## Status Atual (11/10/2025)

### ✅ Concluído (75% MVP)

- **Fundação:** Laravel 11, Inertia.js, multi-tenant, autenticação
- **iFood Sales:** integração funcional, SyncSalesJob, UI de vendas básica
- **Dashboard:** KPIs básicos funcionando (área cliente)
- **Estruturas:** Models e migrations para produtos, ingredientes, financeiro

### 🚧 Em Progresso (15% restante)

- **Vendas página:** dados agora mapeados corretamente, colunas funcionais
- **Integração financeira:** Events sincronizando, mas cálculo líquido pendente
- **Produtos/Mapeamento:** estrutura criada, UI pendente

### ❌ Pendente

- **Admin SaaS:** painel admin completo (Dashboard, Clientes, Planos, Pagamentos, Chamados)
- **Takeat:** integração completa não iniciada
- **Curva ABC:** relatórios não implementados
- **Bandeiras de custo:** regras não aplicadas
- **Financeiro operacional:** CRUD/UI não implementados
- **Auto-atualização:** vendas em tempo real
- **Exportações:** PDF/Excel não implementados

### 🎯 Prioridade Imediata

1. **Implementar Painel Admin** (Dashboard, Clientes, Planos, Pagamentos, Chamados)
2. **Finalizar cálculo líquido** (financial_events → sales.net_total)
3. **Implementar UI de produtos/mapeamento**
4. **Criar CRUD financeiro operacional**
5. **Implementar regras de bandeiras**

**Estimativa para MVP completo:** 7-10 dias úteis restantes

---

Este arquivo serve como contexto atualizado do planejamento, progresso e checklist do projeto Lucro Fácil.
