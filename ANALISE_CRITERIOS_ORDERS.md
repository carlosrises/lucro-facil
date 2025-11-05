# Análise de Critérios de Homologação - Módulo Orders

**Data:** 17 de outubro de 2025  
**Sistema:** lucro-facil2  
**Módulo:** Orders (Pedidos)

---

## 📋 Status Geral da Implementação

### ✅ Implementado (4/16)

### ⚠️ Parcialmente Implementado (2/16)

### ❌ Não Implementado (10/16)

---

## Critérios Detalhados

### 1. ✅ **Receber eventos de pedidos via polling**

**Status:** IMPLEMENTADO  
**Evidências:**

- `SyncOrdersJob.php` linha 54: `$events = $client->get("events/v1.0/events:polling")`
- Busca eventos usando endpoint correto
- Processa lista de eventos retornada

**O que falta:**

- ⚠️ Polling automático a cada 30 segundos (precisa verificar agendamento)

---

### 2. ⚠️ **Fazer requests no endpoint de /polling regularmente a cada 30 segundos**

**Status:** PARCIALMENTE IMPLEMENTADO  
**Evidências:**

- Job `SyncOrdersJob` existe
- Command `SyncIfoodOrdersCommand` dispara o job

**O que falta:**

- ❌ Agendamento automático a cada 30 segundos
- ❌ Verificar se está configurado no Laravel Scheduler
- ❌ Header `x-polling-merchants` não está sendo usado

**Implementação necessária:**

```php
// routes/console.php ou AppServiceProvider
Schedule::job(new SyncOrdersJob($tenantId, $storeId))
    ->everyThirtySeconds()
    ->withoutOverlapping();
```

---

### 3. ✅ **Enviar /acknowledgment para todos os eventos recebidos**

**Status:** IMPLEMENTADO  
**Evidências:**

- `SyncOrdersJob.php` linhas 140-153
- Envia ACK imediatamente após processar eventos
- Usa payload correto: array de objetos com IDs

```php
$ackPayload = collect($eventsList)->pluck('id')->map(fn($id) => ['id' => $id])->values()->all();
$client->post('events/v1.0/events/acknowledgment', $ackPayload);
```

---

### 4. ❌ **Receber, confirmar e despachar um pedido delivery IMMEDIATE**

**Status:** NÃO IMPLEMENTADO  
**O que falta:**

- ❌ Endpoint para confirmar pedido (POST /orders/{orderId}/confirm)
- ❌ Endpoint para despachar pedido (POST /orders/{orderId}/dispatch)
- ❌ UI para ações de confirmar/despachar
- ❌ Métodos no IfoodClient para confirm/dispatch

**Implementação necessária:**

- Adicionar métodos no `IfoodClient.php`
- Criar rotas e controller methods
- Adicionar botões na UI de pedidos

---

### 5. ❌ **Receber, confirmar e despachar um pedido delivery SCHEDULED**

**Status:** NÃO IMPLEMENTADO  
**O que falta:**

- ❌ Exibir data/hora do agendamento na UI
- ❌ Fluxo de confirmação para pedidos agendados
- ❌ Campo `scheduledTo` não está sendo salvo no banco

**Dados disponíveis no raw JSON:**

- `orderTiming: SCHEDULED`
- `scheduledTo: "2025-10-17T14:30:00Z"`

---

### 6. ❌ **Receber e cancelar um pedido delivery**

**Status:** NÃO IMPLEMENTADO  
**O que falta:**

- ❌ Endpoint GET /orders/{orderId}/cancellationReasons
- ❌ Endpoint POST /orders/{orderId}/cancel
- ❌ UI para listar motivos e solicitar cancelamento
- ❌ Validação obrigatória: consultar motivos antes de cancelar

**Implementação necessária:**

```php
// IfoodClient.php
public function getCancellationReasons(string $orderId): array
{
    return $this->get("order/v1.0/orders/{$orderId}/cancellationReasons");
}

public function cancelOrder(string $orderId, string $cancellationCode): array
{
    return $this->post("order/v1.0/orders/{$orderId}/cancel", [
        'cancellationCode' => $cancellationCode
    ]);
}
```

---

### 7. ❌ **Receber, confirmar e avisar que está pronto um pedido TAKEOUT**

**Status:** NÃO IMPLEMENTADO  
**O que falta:**

- ❌ Endpoint POST /orders/{orderId}/readyToPickup
- ❌ UI específica para pedidos TAKEOUT
- ❌ Botão "Pronto para retirada"

---

### 8. ⚠️ **Receber pedidos com pagamento em cartão e exibir detalhes**

**Status:** PARCIALMENTE IMPLEMENTADO  
**Evidências:**

- `Order.raw` armazena JSON completo do pedido
- Dados de pagamento estão em `raw.payments`

**O que falta:**

- ❌ Campos específicos na tabela: payment_method, card_brand
- ❌ UI para exibir tipo de pagamento e bandeira
- ❌ Extrair e salvar dados de pagamento

**Dados disponíveis no raw:**

```json
{
    "payments": {
        "methods": [
            {
                "method": "CREDIT",
                "brand": "VISA",
                "value": 50.0
            }
        ]
    }
}
```

---

### 9. ❌ **Receber pedidos com pagamento em dinheiro e exibir troco**

**Status:** NÃO IMPLEMENTADO  
**O que falta:**

- ❌ Extrair campo `payments.methods[].changeFor`
- ❌ Exibir valor do troco na UI
- ❌ Incluir troco na comanda impressa (se houver)

---

### 10. ❌ **Receber pedidos com cupons de desconto**

**Status:** NÃO IMPLEMENTADO  
**O que falta:**

- ❌ Salvar campo `total.benefits` (descontos)
- ❌ Identificar responsável pelo subsídio (iFood vs Loja)
- ❌ Exibir cupons na UI

**Dados disponíveis:**

```json
{
    "total": {
        "benefits": 10.0,
        "orderAmount": 50.0
    }
}
```

---

### 11. ❌ **Exibir observações dos itens**

**Status:** NÃO IMPLEMENTADO  
**O que falta:**

- ❌ Campo `observations` não está sendo salvo em `order_items`
- ❌ UI para exibir observações de cada item
- ❌ Incluir observações na comanda impressa

**Dados disponíveis:**

```json
{
    "items": [
        {
            "name": "Hamburguer",
            "observations": "Retirar cebola"
        }
    ]
}
```

---

### 12. ❌ **Atualizar status de pedido cancelado pelo cliente/iFood**

**Status:** NÃO IMPLEMENTADO  
**O que falta:**

- ❌ Processar eventos de cancelamento
- ❌ Atualizar UI em tempo real
- ❌ Notificar usuário sobre cancelamento

---

### 13. ❌ **Atualizar status confirmado/cancelado por outro app**

**Status:** NÃO IMPLEMENTADO  
**O que falta:**

- ❌ Sincronização bidirecional de status
- ❌ Detectar mudanças de status via polling
- ❌ Atualizar UI quando status mudar externamente

---

### 14. ✅ **Receber um mesmo evento mais de uma vez e descartá-lo**

**Status:** IMPLEMENTADO  
**Evidências:**

- `SyncOrdersJob.php` linha 87: `Order::updateOrCreate()`
- Usa `order_uuid` como chave única
- UpdateOrCreate previne duplicação

---

### 15. ❌ **Informar CPF/CNPJ na tela**

**Status:** NÃO IMPLEMENTADO  
**O que falta:**

- ❌ Extrair campo `customer.taxPayerIdentificationNumber`
- ❌ Salvar em campo específico
- ❌ Exibir na UI quando obrigatório
- ❌ Auto-preencher em documento fiscal

**Dados disponíveis:**

```json
{
    "customer": {
        "taxPayerIdentificationNumber": "123.456.789-00"
    }
}
```

---

### 16. ❌ **Receber eventos da Plataforma de Negociação de Pedidos**

**Status:** NÃO IMPLEMENTADO  
**O que falta:**

- ❌ Processar eventos de negociação
- ❌ Endpoints específicos para negociação
- ❌ UI para interagir com negociações

---

### 17. ❌ **Exibir código de coleta do pedido**

**Status:** NÃO IMPLEMENTADO  
**O que falta:**

- ❌ Extrair campo `takeout.takeoutCode`
- ❌ Exibir código na tela
- ❌ Imprimir na comanda

**Dados disponíveis:**

```json
{
    "takeout": {
        "takeoutCode": "1234"
    }
}
```

---

## 📊 Requisitos Não Funcionais

### ✅ **Renovar token quando prestes a expirar**

**Status:** IMPLEMENTADO  
**Evidências:**

- `IfoodClient.php` método `refreshTokenIfNeeded()`
- Verifica `expires_at` antes de cada request
- Renova automaticamente quando necessário

---

### ⚠️ **Respeitar políticas de rate limit**

**Status:** DESCONHECIDO  
**O que verificar:**

- ❓ Implementação de throttling
- ❓ Retry com backoff exponencial
- ❓ Logs de rate limit

---

## 🎯 Requisitos Desejáveis

### ❌ **Comanda impressa seguindo modelo sugerido**

**Status:** NÃO IMPLEMENTADO  
**O que falta:**

- ❌ Sistema de impressão de comandas
- ❌ Template conforme documentação iFood
- ❌ Incluir todas as informações obrigatórias

---

### ❌ **Informar observações de entrega**

**Status:** NÃO IMPLEMENTADO  
**O que falta:**

- ❌ Campo `delivery.observations`
- ❌ Exibir na tela
- ❌ Incluir na comanda

**Dados disponíveis:**

```json
{
    "delivery": {
        "observations": "Interfone quebrado, ligar antes"
    }
}
```

---

## 🚀 Próximos Passos Recomendados

### Prioridade ALTA (Obrigatórios)

1. **Confirmar/Despachar pedidos DELIVERY**
    - Adicionar métodos no IfoodClient
    - Criar endpoints no controller
    - UI com botões de ação

2. **Cancelar pedidos**
    - Consultar motivos de cancelamento
    - Implementar fluxo de cancelamento
    - UI com seleção de motivo

3. **Pedidos TAKEOUT - Ready to Pickup**
    - Endpoint readyToPickup
    - UI específica para TAKEOUT

4. **Polling a cada 30 segundos**
    - Configurar Laravel Scheduler
    - Adicionar header x-polling-merchants

### Prioridade MÉDIA (Informações importantes)

5. **Expandir dados salvos**
    - Pagamento: método, bandeira, troco
    - Cupons de desconto
    - Observações de itens
    - CPF/CNPJ do cliente
    - Código de coleta TAKEOUT

6. **Pedidos agendados (SCHEDULED)**
    - Exibir data/hora do agendamento
    - Fluxo específico para agendados

### Prioridade BAIXA (Desejáveis)

7. **Sistema de impressão**
    - Comanda formatada
    - Observações de entrega

---

## 💡 Observações Técnicas

- **Database Schema:** A tabela `orders` tem campo `raw` (JSON) que contém TODOS os dados, mas não estão sendo extraídos
- **Segurança:** Todas as operações devem validar `tenant_id`
- **UI:** Página de pedidos (`orders.tsx`) existe mas precisa de botões de ação
- **Jobs:** SyncOrdersJob está bem implementado, só falta agendamento automático

---

## 📝 Conclusão

O sistema tem uma **base sólida** implementada:

- ✅ Polling de eventos funcionando
- ✅ Acknowledgment correto
- ✅ Prevenção de duplicatas
- ✅ Refresh de token automático

Porém, **falta implementar 10 dos 16 critérios obrigatórios**, principalmente:

- ❌ Ações sobre pedidos (confirmar, despachar, cancelar, ready)
- ❌ Exibição de informações detalhadas (pagamento, cupons, observações)
- ❌ Agendamento automático do polling

**Estimativa de trabalho:** 3-5 dias para implementar todos os critérios obrigatórios.
