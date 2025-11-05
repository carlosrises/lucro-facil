# Instruções Copilot para lucro-facil2

## Visão Geral do Projeto

Este é um monorepo Laravel + React (Inertia.js) para uma plataforma de gestão financeira/pedidos. O backend é em PHP (Laravel), o frontend em TypeScript/React, com Inertia.js para navegação tipo SPA. Diretórios principais:

- `app/` — Backend Laravel (models, controllers, jobs, services)
- `resources/js/` — Frontend React (pages, components, types)
- `routes/` — Definições de rotas Laravel
- `config/` — Configurações Laravel
- `tests/` — Testes Pest (PHP)

## Fluxos de Build & Teste

- **Build/dev do frontend:**
    - `npm run dev` — Inicia o servidor Vite
    - `npm run build` — Compila os assets do frontend
- **Lint/Format:**
    - `npm run lint` — ESLint (auto-fix)
    - `npm run format` — Prettier (auto-fix)
    - `vendor/bin/pint` — Estilo de código PHP
- **Backend:**
    - `php artisan` — CLI Laravel (migrações, jobs, etc.)
- **Testes:**
    - `./vendor/bin/pest` — Executa testes PHP

## Convenções & Padrões

- **Frontend:**
    - Usa alias `@/` para `resources/js/`
    - Pages em `resources/js/pages/`, components em `resources/js/components/`
    - Componentes específicos de páginas devem ficar em `resources/js/components/{pageName}/` (exemplo: componentes do dashboard em `resources/js/components/dashboard/`).
    - Sempre utilize a biblioteca shadcn/ui para construir componentes visuais.
    - Para ícones, utilize sempre a biblioteca Lucide (https://lucide.dev/) e nunca SVGs inline ou outras libs.
    - Data tables e UI usam Radix UI, TailwindCSS, custom hooks e shadcn/ui.
    - Inertia.js para props de página e navegação.
    - Para novas páginas, sempre utilize a estrutura de layout existente, como demonstrado em `resources/js/pages/dashboard.tsx` (use o componente `AppLayout` e breadcrumbs).
    - Em arquivos `.tsx`, sempre defina os tipos explicitamente e evite o uso de `any`.
    - **DataTables - PADRÃO OBRIGATÓRIO**: Todas as páginas com DataTable DEVEM seguir exatamente o mesmo padrão visual e de código das páginas `orders.tsx`, `sales.tsx` e `admin/clients.tsx`:
        - Layout da página: `<div className="flex flex-1 flex-col"><div className="@container/main flex flex-1 flex-col gap-2"><div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">`
        - DataTable wrapper: `<div className="flex w-full flex-col gap-4 space-x-4 px-4 lg:px-6">`
        - Filtros horizontais com Input de busca, Selects de filtros, e botões de ação à direita
        - Tabela com bordas: `<div className="rounded-md border"><Table>`
        - Paginação completa com controles padrão do TanStack Table
        - Dropdown de colunas visíveis sempre presente
        - Estrutura de props: `data`, `pagination`, `filters` separados (nunca objetos aninhados)
- **Backend:**
    - Models em `app/Models/`, controllers em `app/Http/Controllers/`
    - Jobs para tarefas assíncronas em `app/Jobs/`
    - Helpers em `app/helpers.php`
    - Service classes em `app/Services/`
    - Usa Laravel Fortify para auth, Spatie Permission para roles
- **Testes:**
    - Pest para testes PHP (`tests/Feature`, `tests/Unit`)
    - Não há testes JS/TS por padrão

## Pontos de Integração

- **Inertia.js** faz a ponte entre backend e frontend (veja controllers retornando respostas Inertia)
- **Database:** SQLite para local/dev, configurado em `.env`
- **CI/CD:** GitHub Actions (`.github/workflows/`) para lint e testes

## Exemplos

- Para adicionar uma nova página de pedidos: crie a página React em `resources/js/pages/orders.tsx`, rota backend em `routes/web.php`, controller em `app/Http/Controllers/`
- Para rodar todos os checks de qualidade: `npm run lint && npm run format && vendor/bin/pint`

## Dicas para Agentes de IA

### 🚨 **REGRAS FUNDAMENTAIS DE DESENVOLVIMENTO**

- **FAÇA APENAS O QUE FOI SOLICITADO**: Implemente somente o que o usuário pediu, nada além
- **UMA COISA POR VEZ**: Não adicione funcionalidades extras, componentes ou melhorias não solicitadas
- **SEMPRE PERGUNTE ANTES**: Se tiver sugestões ou melhorias, pergunte primeiro antes de implementar
- **SIGA À RISCA**: Execute exatamente o que foi pedido, sem interpretações ou "melhorias" não solicitadas
- **CONFIRME ANTES DE CONTINUAR**: Após cada implementação, pergunte se pode prosseguir ou se está correto

### 📋 **Diretrizes Técnicas**

- Sempre utilize a estrutura de diretórios e convenções existentes
- Prefira Inertia.js para navegação/dados de novas páginas
- Use Pest para testes backend, seguindo a estrutura de testes existente
- Consulte `package.json` e `composer.json` para dependências
- Para CI, veja `.github/workflows/` para etapas de build/lint/teste
- **VERIFICAÇÃO OBRIGATÓRIA ANTES DE IMPLEMENTAR**: Sempre verifique se estruturas, relacionamentos e dependências existem:
    - Schema de tabelas: Use migrations para verificar campos existentes
    - Relacionamentos Eloquent: Confirme se os relationships estão definidos nos models
    - Rotas: Verifique se as rotas necessárias existem em `routes/web.php`
    - Estruturas de dados: Analise controllers existentes para entender formato dos dados retornados
    - Exemplo prático: Antes de implementar relacionamento Tenant->users(), verificar se ele existe no model Tenant
- Antes de criar código novo, sempre verifique o schema atual das tabelas e a estrutura do projeto (ex: use as migrations e models para checar campos e relações). Para integrações, confira onde os tokens e dados realmente estão salvos (exemplo: o token do iFood está em `oauth_tokens`, e todas as lojas com provider 'ifood' em `stores` já estão integradas).
- Para agendar jobs/commands no Laravel 12, utilize o sistema de agendamento em `routes/console.php` com `Schedule::command()` ou `Schedule::job()`. Consulte a documentação oficial para o método mais atual de scheduling.

---

Se alguma seção estiver pouco clara ou faltando, envie feedback para melhorar estas instruções.
