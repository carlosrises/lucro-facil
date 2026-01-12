<?php

namespace App\Services;

use App\Models\CostCommission;
use App\Models\Order;
use Illuminate\Support\Collection;

/**
 * Serviço para identificação e vínculo automático de taxas de meios de pagamento
 */
class PaymentFeeLinkService
{
    /**
     * Identifica a taxa de pagamento adequada para um método específico
     *
     * @param  string  $paymentMethod  (ex: "PIX", "CREDIT_CARD", "DEBIT_CARD")
     * @param  string  $paymentType  ("online" ou "offline")
     */
    public function findMatchingPaymentFee(
        Order $order,
        string $paymentMethod,
        string $paymentType
    ): ?CostCommission {
        $query = CostCommission::where('tenant_id', $order->tenant_id)
            ->where('category', 'payment_method')
            ->where('active', true);

        // Filtrar por provider
        $query->where(function ($q) use ($order) {
            $q->whereNull('provider')
                ->orWhere('provider', $order->provider);

            // Para pedidos Takeat, considerar também provider específico (takeat-ifood, takeat-99food)
            if ($order->provider === 'takeat' && $order->origin) {
                $q->orWhere('provider', $order->origin)
                    ->orWhere('provider', "takeat-{$order->origin}");
            }
        });

        // Filtrar por tipo de pagamento (online/offline)
        if ($paymentType) {
            $query->where(function ($q) use ($paymentType) {
                $q->whereNull('payment_type')
                    ->orWhere('payment_type', 'all')
                    ->orWhere('payment_type', $paymentType);
            });
        }

        // Buscar todas as taxas que podem se aplicar
        $possibleFees = $query->get();

        // Priorizar taxa mais específica:
        // 1. Taxa com provider específico + método específico
        // 2. Taxa com provider específico + tipo online/offline (todos os métodos)
        // 3. Taxa sem provider + método específico
        // 4. Taxa sem provider + tipo online/offline

        // Primeiro, tentar encontrar taxa específica para o método (com compatibilidade de formatos legados)
        $specificMethodFee = $possibleFees->first(function ($fee) use ($paymentMethod) {
            $conditionValues = $fee->condition_values ?? [];

            // Taxa específica para o método - verificar compatibilidade
            foreach ($conditionValues as $taxMethod) {
                if ($this->methodsAreCompatible($paymentMethod, $taxMethod)) {
                    return true;
                }
            }

            return false;
        });

        if ($specificMethodFee) {
            return $specificMethodFee;
        }

        // Se não encontrou específica, buscar genérica para o tipo (online/offline)
        $genericTypeFee = $possibleFees->first(function ($fee) {
            $conditionValues = $fee->condition_values ?? [];

            // Taxa para todos os métodos do tipo (condition_values vazio)
            if (empty($conditionValues)) {
                return true;
            }

            return false;
        });

        return $genericTypeFee;
    }

    /**
     * Vincula automaticamente taxas de pagamento a um pedido
     *
     * @return array Vínculos criados { "PIX": 123, "CREDIT_CARD": 124 }
     */
    public function linkPaymentFeesToOrder(Order $order): array
    {
        $links = [];

        // Extrair métodos de pagamento do pedido
        $payments = $this->extractPaymentMethods($order);

        foreach ($payments as $payment) {
            $paymentMethod = $payment['method'];
            $paymentType = $payment['type'];

            // Buscar taxa correspondente
            $fee = $this->findMatchingPaymentFee($order, $paymentMethod, $paymentType);

            if ($fee) {
                $links[$paymentMethod] = $fee->id;
            }
        }

        // Salvar vínculos no pedido
        $order->update(['payment_fee_links' => $links]);

        return $links;
    }

    /**
     * Extrai métodos de pagamento e seus tipos de um pedido
     *
     * @return array [['method' => 'PIX', 'type' => 'offline', 'value' => 50.00], ...]
     */
    public function extractPaymentMethods(Order $order): array
    {
        $payments = [];
        $raw = $order->raw ?? [];

        // Extrair pagamentos do iFood
        if ($order->provider === 'ifood' && isset($raw['payments']['methods'])) {
            foreach ($raw['payments']['methods'] as $payment) {
                $method = $payment['method'] ?? 'others';
                $value = (float) ($payment['value'] ?? 0);

                $payments[] = [
                    'method' => strtoupper($method),
                    'type' => $this->detectPaymentType($payment['type'] ?? ''),
                    'value' => $value,
                ];
            }
        }

        // Extrair pagamentos do Takeat
        if ($order->provider === 'takeat' && isset($raw['session']['payments'])) {
            foreach ($raw['session']['payments'] as $payment) {
                $paymentMethod = $payment['payment_method'] ?? [];
                $keyword = $paymentMethod['keyword'] ?? 'others';
                $name = $paymentMethod['name'] ?? '';
                $value = (float) ($payment['payment_value'] ?? 0);

                // Normalizar método: Takeat usa 'keyword' + 'name' para identificar
                $method = $this->normalizeTakeatPaymentMethod($keyword, $name);

                $payments[] = [
                    'method' => $method,
                    'type' => 'offline', // Takeat: pagamentos na entrega são sempre offline
                    'value' => $value,
                    'name' => $name,
                    'keyword' => $keyword,
                ];
            }
        }

        // Extrair pagamentos de outros providers (Rappi, Uber Eats, etc.)
        if (isset($raw['payment_method'])) {
            $payments[] = [
                'method' => strtoupper($raw['payment_method']),
                'type' => 'online', // Marketplaces geralmente são online
                'value' => $order->net_total,
            ];
        }

        return $payments;
    }

    /**
     * Normaliza método de pagamento do Takeat baseado em keyword + name
     *
     * @return string Método normalizado (PIX, CREDIT_CARD, DEBIT_CARD, CASH, etc)
     */
    private function normalizeTakeatPaymentMethod(string $keyword, string $name): string
    {
        $lowerName = strtolower($name);
        $lowerKeyword = strtolower($keyword);

        // Mapear por keyword específico
        if ($lowerKeyword === 'pix') {
            return 'PIX';
        }

        if ($lowerKeyword === 'clube' || str_contains($lowerName, 'cashback')) {
            return 'CASHBACK';
        }

        if ($lowerKeyword === 'dinheiro' || str_contains($lowerName, 'dinheiro')) {
            return 'CASH';
        }

        // Para 'others', analisar o nome
        if ($lowerKeyword === 'others') {
            if (str_contains($lowerName, 'crédit') || str_contains($lowerName, 'credit')) {
                return 'CREDIT_CARD';
            }
            if (str_contains($lowerName, 'débit') || str_contains($lowerName, 'debit')) {
                return 'DEBIT_CARD';
            }
            if (str_contains($lowerName, 'vale') || str_contains($lowerName, 'voucher')) {
                return 'VOUCHER';
            }
            if (str_contains($lowerName, 'dinheiro') || str_contains($lowerName, 'money') || str_contains($lowerName, 'cash')) {
                return 'CASH';
            }
        }

        // Fallback: retornar keyword em uppercase
        return strtoupper($keyword);
    }

    /**
     * Verifica se um método normalizado corresponde a um método da taxa
     * Suporta formatos legados (CREDIT vs CREDIT_CARD)
     *
     * @param  string  $normalizedMethod  Método normalizado (ex: CREDIT_CARD)
     * @param  string  $taxMethod  Método configurado na taxa (ex: CREDIT ou CREDIT_CARD)
     */
    public function methodsAreCompatible(string $normalizedMethod, string $taxMethod): bool
    {
        // Match exato
        if ($normalizedMethod === $taxMethod) {
            return true;
        }

        // Compatibilidade com formatos legados
        $compatibilityMap = [
            'CREDIT_CARD' => ['CREDIT', 'CREDIT_CARD'],
            'DEBIT_CARD' => ['DEBIT', 'DEBIT_CARD'],
            'CASH' => ['MONEY', 'CASH', 'DINHEIRO'],
        ];

        if (isset($compatibilityMap[$normalizedMethod])) {
            return in_array($taxMethod, $compatibilityMap[$normalizedMethod]);
        }

        if (isset($compatibilityMap[$taxMethod])) {
            return in_array($normalizedMethod, $compatibilityMap[$taxMethod]);
        }

        return false;
    }

    /**
     * Detecta se um pagamento é online ou offline baseado no método
     *
     * @return string 'online' ou 'offline'
     */
    private function detectPaymentType(string $methodName): string
    {
        $lowerName = strtolower($methodName);

        // Pagamentos online geralmente incluem esses termos
        if (
            str_contains($lowerName, 'online') ||
            str_contains($lowerName, 'marketplace') ||
            str_contains($lowerName, 'digital')
        ) {
            return 'online';
        }

        // PIX, dinheiro e cartões na maquininha são offline
        return 'offline';
    }

    /**
     * Normaliza um método de pagamento bruto para o método padronizado
     * Usado quando o frontend envia o método "bruto" (keyword do Takeat, por exemplo)
     *
     * @param  string  $rawMethod  Método bruto vindo do frontend (ex: "others", "pix")
     * @return string Método normalizado (ex: "CREDIT_CARD", "PIX")
     */
    public function normalizePaymentMethodForOrder(Order $order, string $rawMethod): string
    {
        // Se o pedido é Takeat, precisamos buscar o nome do método para normalizar
        if ($order->provider === 'takeat') {
            $payments = $order->raw['session']['payments'] ?? [];

            // Buscar o pagamento que corresponde ao método bruto
            foreach ($payments as $payment) {
                $paymentMethod = $payment['payment_method'] ?? [];
                $keyword = $paymentMethod['keyword'] ?? '';
                $name = $paymentMethod['name'] ?? '';

                // Se o keyword bate com o método bruto, normalizar
                if (strtolower($keyword) === strtolower($rawMethod)) {
                    return $this->normalizeTakeatPaymentMethod($keyword, $name);
                }

                // Também verificar se o method bate
                if (isset($paymentMethod['method']) && strtolower($paymentMethod['method']) === strtolower($rawMethod)) {
                    return $this->normalizeTakeatPaymentMethod($keyword, $name);
                }
            }
        }

        // Para outros providers ou se não encontrou no Takeat, retornar uppercase
        return strtoupper($rawMethod);
    }

    /**
     * Lista todas as taxas de pagamento existentes para um tenant/provider
     * Usado para VÍNCULO AUTOMÁTICO (com filtros restritivos)
     */
    public function listAvailablePaymentFees(
        int $tenantId,
        ?string $provider = null,
        ?string $origin = null
    ): Collection {
        $query = CostCommission::where('tenant_id', $tenantId)
            ->where('category', 'payment_method')
            ->where('active', true);

        if ($provider) {
            $query->where(function ($q) use ($provider, $origin) {
                $q->whereNull('provider')
                    ->orWhere('provider', $provider);

                if ($provider === 'takeat' && $origin) {
                    $q->orWhere('provider', $origin)
                        ->orWhere('provider', "takeat-{$origin}");
                }
            });
        }

        return $query->orderBy('name')->get();
    }

    /**
     * Lista TODAS as taxas de pagamento do tenant para VÍNCULO MANUAL
     * Sem filtros restritivos - permite vincular qualquer taxa manualmente
     */
    public function listAllPaymentFeesForManualLink(int $tenantId): Collection
    {
        return CostCommission::where('tenant_id', $tenantId)
            ->where('category', 'payment_method')
            ->where('active', true)
            ->orderBy('provider')
            ->orderBy('name')
            ->get();
    }

    /**
     * Verifica compatibilidade de uma taxa com um método de pagamento
     * Retorna array com informações de compatibilidade (não bloqueia vínculo manual)
     *
     * @return array ['is_compatible' => bool, 'reasons' => string[], 'compatibility_score' => int]
     */
    public function checkFeeCompatibility(
        CostCommission $fee,
        string $paymentMethod,
        string $paymentType,
        Order $order
    ): array {
        $reasons = [];
        $score = 0;

        // Verificar provider
        if ($fee->provider) {
            if ($fee->provider === $order->provider) {
                $score += 30;
                $reasons[] = "Provider exato: {$fee->provider}";
            } elseif ($order->provider === 'takeat' && $order->origin) {
                if ($fee->provider === $order->origin || $fee->provider === "takeat-{$order->origin}") {
                    $score += 25;
                    $reasons[] = 'Provider compatível com origin Takeat';
                } else {
                    $reasons[] = "⚠️ Provider diferente: taxa={$fee->provider}, pedido={$order->provider}";
                }
            } else {
                $reasons[] = "⚠️ Provider diferente: taxa={$fee->provider}, pedido={$order->provider}";
            }
        } else {
            $score += 10;
            $reasons[] = 'Taxa genérica (sem provider específico)';
        }

        // Verificar tipo de pagamento (online/offline)
        if ($fee->payment_type) {
            if ($fee->payment_type === 'all' || $fee->payment_type === $paymentType) {
                $score += 30;
                $reasons[] = "Tipo de pagamento correto: {$paymentType}";
            } else {
                $reasons[] = "⚠️ Tipo diferente: taxa={$fee->payment_type}, pagamento={$paymentType}";
            }
        } else {
            $score += 10;
            $reasons[] = 'Taxa para todos os tipos de pagamento';
        }

        // Verificar método específico (com compatibilidade de formatos legados)
        $conditionValues = $fee->condition_values ?? [];
        if (! empty($conditionValues)) {
            $isCompatible = false;
            foreach ($conditionValues as $taxMethod) {
                if ($this->methodsAreCompatible($paymentMethod, $taxMethod)) {
                    $isCompatible = true;
                    break;
                }
            }

            if ($isCompatible) {
                $score += 40;
                $reasons[] = "✓ Método específico compatível: {$paymentMethod}";
            } else {
                $reasons[] = '⚠️ Taxa configurada para: '.implode(', ', $conditionValues)." (pedido usa: {$paymentMethod})";
            }
        } else {
            $score += 20;
            $reasons[] = 'Taxa genérica (aplica-se a todos os métodos de pagamento)';
        }

        $isCompatible = $score >= 50; // Score mínimo para ser considerado "compatível"

        return [
            'is_compatible' => $isCompatible,
            'compatibility_score' => $score,
            'reasons' => $reasons,
            'recommendation' => $isCompatible ? 'Recomendada' : 'Pode ser vinculada manualmente',
        ];
    }

    /**
     * Verifica se um pedido já possui taxas de pagamento vinculadas
     */
    public function hasLinkedPaymentFees(Order $order): bool
    {
        $links = $order->payment_fee_links ?? [];

        return ! empty($links);
    }

    /**
     * Remove vínculos de taxa de pagamento de um pedido
     *
     * @param  string|null  $paymentMethod  Se null, remove todos
     */
    public function unlinkPaymentFee(Order $order, ?string $paymentMethod = null): void
    {
        $links = $order->payment_fee_links ?? [];

        if ($paymentMethod) {
            unset($links[$paymentMethod]);
        } else {
            $links = [];
        }

        $order->update(['payment_fee_links' => $links]);
    }

    /**
     * Vincula manualmente uma taxa específica a um método de pagamento
     * Bypass das regras de compatibilidade automática
     */
    public function manuallyLinkPaymentFee(
        Order $order,
        string $paymentMethod,
        int $costCommissionId
    ): bool {
        // Verificar se a taxa existe e pertence ao mesmo tenant
        $fee = CostCommission::where('id', $costCommissionId)
            ->where('tenant_id', $order->tenant_id)
            ->where('category', 'payment_method')
            ->first();

        if (! $fee) {
            return false;
        }

        // Criar/atualizar vínculo
        $links = $order->payment_fee_links ?? [];
        $links[$paymentMethod] = $costCommissionId;

        $order->update(['payment_fee_links' => $links]);

        return true;
    }

    /**
     * Vincular uma taxa de pagamento a TODOS os pedidos de um tenant que possuem determinado método
     * Retorna o número de pedidos afetados
     */
    public function bulkLinkPaymentFeeByMethod(
        int $tenantId,
        string $paymentMethod,
        int $costCommissionId
    ): int {
        // Validar que a taxa existe e pertence ao tenant
        $fee = CostCommission::where('id', $costCommissionId)
            ->where('tenant_id', $tenantId)
            ->where('category', 'payment_method')
            ->first();

        if (! $fee) {
            return 0;
        }

        // Buscar TODOS os pedidos do tenant que possuem este método de pagamento
        // Considerando tanto pedidos Takeat quanto iFood
        $orders = Order::where('tenant_id', $tenantId)
            ->where('raw', '!=', null)
            ->get()
            ->filter(function ($order) use ($paymentMethod) {
                // Obter pagamentos do pedido usando a mesma lógica do OrderCostService
                $payments = $this->getOrderPaymentsForBulk($order);

                // Verificar se algum pagamento corresponde ao método procurado
                return collect($payments)->contains('method', $paymentMethod);
            });

        $affectedCount = 0;
        $costService = app(\App\Services\OrderCostService::class);

        foreach ($orders as $order) {
            // Vincular manualmente
            $success = $this->manuallyLinkPaymentFee($order, $paymentMethod, $costCommissionId);

            if ($success) {
                // Recalcular custos
                $result = $costService->calculateCosts($order);

                $order->update([
                    'calculated_costs' => $result,
                    'total_costs' => $result['total_costs'] ?? 0,
                    'total_commissions' => $result['total_commissions'] ?? 0,
                    'net_revenue' => $result['net_revenue'] ?? 0,
                    'costs_calculated_at' => now(),
                ]);

                $affectedCount++;
            }
        }

        return $affectedCount;
    }

    /**
     * Obter lista de pagamentos do pedido (versão simplificada para bulk)
     */
    private function getOrderPaymentsForBulk(Order $order): array
    {
        $payments = [];

        // Para pedidos Takeat
        if ($order->provider === 'takeat') {
            $rawPayments = $order->raw['session']['payments'] ?? [];

            foreach ($rawPayments as $payment) {
                $paymentMethod = $payment['payment_method'] ?? [];
                $keyword = $paymentMethod['keyword'] ?? '';
                $name = $paymentMethod['name'] ?? '';

                // Pular subsídios e cupons
                $lowerName = strtolower($name);
                $lowerKeyword = strtolower($keyword);

                $isSubsidy = str_contains($lowerName, 'subsid')
                    || str_contains($lowerName, 'cupom')
                    || str_contains($lowerName, 'desconto')
                    || str_contains($lowerKeyword, 'subsid')
                    || str_contains($lowerKeyword, 'cupom')
                    || str_contains($lowerKeyword, 'desconto');

                if ($isSubsidy) {
                    continue;
                }

                // Normalizar método
                $method = $this->normalizePaymentMethodForOrder($order, $keyword);

                $payments[] = ['method' => $method];
            }
        }

        // Para iFood direto
        if ($order->provider === 'ifood' && isset($order->raw['payments']['methods'])) {
            foreach ($order->raw['payments']['methods'] as $payment) {
                $method = $payment['method'] ?? null;
                if ($method) {
                    $payments[] = ['method' => strtoupper($method)];
                }
            }
        }

        return $payments;
    }
}
