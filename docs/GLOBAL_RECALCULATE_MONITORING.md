# Sistema Global de Monitoramento de Recálculo

## Visão Geral

O sistema de monitoramento global de recálculo permite que o status de recálculos de custos seja visível em todas as páginas do sistema, mesmo após mudança de página ou reload.

## Funcionalidades

✅ **Visível em todo o sistema** - O componente está no layout principal (`app-sidebar-layout`)
✅ **Persiste entre páginas** - Usa `localStorage` para manter o estado
✅ **Multi-aba suportado** - Mudanças em uma aba são refletidas em outras (via `storage` event)
✅ **Polling automático** - Verifica o status a cada 2 segundos
✅ **Auto-limpeza** - Remove do localStorage quando completado

## Como Funciona

### 1. Backend

O backend já salva o progresso no cache:

```php
// No RecalculateOrderCostsJob
$cacheKey = "recalculate_progress_{$tenantId}_{$type}_{$referenceId}";

\Cache::put($cacheKey, [
    'status' => 'processing',
    'total' => 100,
    'processed' => 50,
    'percentage' => 50,
    'started_at' => now()->toISOString(),
], now()->addHours(2));
```

Quando a operação é disparada, o controller retorna o `cache_key`:

```php
return back()->with([
    'success' => 'Recalculando...',
    'recalculate_cache_key' => $cacheKey,
]);
```

### 2. Frontend

#### Componente Global

O componente `GlobalRecalculateProgress` está no layout e monitora automaticamente:

```tsx
// Em app-sidebar-layout.tsx
<GlobalRecalculateProgress />
```

#### Iniciar Monitoramento

Quando uma ação inicia um recálculo, use a função helper:

```tsx
import { startRecalculateMonitoring } from '@/components/global-recalculate-progress';

// Quando receber o cache key do backend
React.useEffect(() => {
    if (recalculateCacheKey) {
        startRecalculateMonitoring(recalculateCacheKey);
    }
}, [recalculateCacheKey]);
```

## Adicionando em Novas Páginas

### Exemplo: Adicionar ao vincular meio de pagamento

1. **No Backend (Controller)**:

```php
public function storePaymentFeeRule(Request $request)
{
    // ... criar regra ...

    // Disparar job de recálculo
    RecalculateOrderCostsJob::dispatch(
        $rule->id,
        false,
        'payment_method',
        $rule->tenant_id,
        $rule->provider
    );

    // Retornar cache key
    $cacheKey = "recalculate_progress_{$rule->tenant_id}_payment_method_{$rule->id}";

    return back()->with([
        'success' => 'Regra criada! Recalculando pedidos...',
        'recalculate_cache_key' => $cacheKey,
    ]);
}
```

2. **No Frontend (Página)**:

```tsx
import { startRecalculateMonitoring } from '@/components/global-recalculate-progress';

export default function PaymentRules() {
    const { flash } = usePage().props;
    const recalculateCacheKey = (flash as any)?.recalculate_cache_key;

    React.useEffect(() => {
        if (recalculateCacheKey) {
            // Isso é tudo que você precisa!
            startRecalculateMonitoring(recalculateCacheKey);
        }
    }, [recalculateCacheKey]);

    // ... resto do componente
}
```

## Estados do Monitoramento

### Processing (Em Progresso)

- Cor: Azul
- Mostra barra de progresso
- Atualiza a cada 2 segundos
- Exibe: processed/total e percentual

### Completed (Concluído)

- Cor: Verde
- Mostra por 3 segundos
- Auto-recarrega dados relevantes
- Limpa do localStorage

### Error (Erro)

- Cor: Vermelho
- Mostra mensagem de erro
- Permanece por 3 segundos
- Limpa do localStorage

### Idle (Inativo)

- Não exibe nada
- Estado inicial

## Localização dos Arquivos

- **Componente Global**: `resources/js/components/global-recalculate-progress.tsx`
- **Layout**: `resources/js/layouts/app/app-sidebar-layout.tsx`
- **Job Backend**: `app/Jobs/RecalculateOrderCostsJob.php`
- **Endpoint**: `GET /cost-commissions/recalculate-progress`
- **Controller**: `app/Http/Controllers/CostCommissionsController.php`

## Storage Keys

- `global_recalculate_cache_key` - Armazena o cache key atual
- `global_recalculate_last_check` - Timestamp da última verificação

## Eventos Personalizados

O sistema dispara um evento customizado quando um recálculo inicia:

```tsx
window.addEventListener('recalculate-started', (e) => {
    console.log('Recálculo iniciado:', e.detail.cacheKey);
});
```

## Complexidade

❌ **NÃO é complexo!** A implementação é simples:

1. Backend já tinha todo o sistema de cache
2. Frontend precisou apenas de:
    - Um componente global no layout (50 linhas)
    - Uma função helper (5 linhas)
    - Usar localStorage para persistência

## Vantagens

✅ Usuário vê o progresso mesmo mudando de página
✅ Funciona entre múltiplas abas do navegador
✅ Não precisa recarregar manualmente
✅ Auto-limpa quando completa
✅ Pode ser usado em qualquer página/ação
✅ Sem complexidade de websockets ou SSE
