<?php

namespace App\Services;

use App\Models\CostCommission;
use App\Models\Order;
use Illuminate\Support\Collection;

class OrderCostService
{
    protected PaymentFeeLinkService $linkService;

    public function __construct(PaymentFeeLinkService $linkService)
    {
        $this->linkService = $linkService;
    }

    /**
     * Calcular custos e comissões de um pedido
     */
    public function calculateCosts(Order $order): array
    {
        // Primeiro, vincular automaticamente taxas de pagamento se ainda não estiver vinculado
        if (!$this->linkService->hasLinkedPaymentFees($order)) {
            $this->linkService->linkPaymentFeesToOrder($order);
        }

        // Buscar taxas ativas para o provider do pedido
        // Para pedidos Takeat, considerar também o origin (99food, keeta, etc)
        $origin = $order->provider === 'takeat' ? $order->origin : null;

        $costCommissions = CostCommission::where('tenant_id', $order->tenant_id)
            ->active()
            ->forProvider($order->provider, $origin)
            ->get();

        // Tentar detectar provider adicional pelo método de pagamento (ex: 99food_pagamento_online)
        $paymentProviders = $this->detectPaymentProviders($order);

        // Se detectou providers diferentes, buscar taxas desses providers também
        foreach ($paymentProviders as $paymentProvider) {
            // Buscar tanto "provider" quanto "takeat-provider" para pedidos Takeat
            $providersToSearch = [$paymentProvider];
            if ($order->provider === 'takeat') {
                $providersToSearch[] = "takeat-{$paymentProvider}";
            }

            foreach ($providersToSearch as $searchProvider) {
                if ($searchProvider !== $order->provider) {
                    $additionalTaxes = CostCommission::where('tenant_id', $order->tenant_id)
                        ->active()
                        ->where('provider', $searchProvider)
                        ->get();

                    // Merge sem duplicatas (usando id como chave)
                    foreach ($additionalTaxes as $tax) {
                        if (! $costCommissions->contains('id', $tax->id)) {
                            $costCommissions->push($tax);
                        }
                    }
                }
            }
        }

        // Calcular subtotal (base para todos os cálculos)
        // Usa old_total_price para Takeat (antes de subsídios) pois custos são sobre valor real de venda
        $baseValue = $this->getOrderSubtotal($order);
        $revenueBase = $baseValue;
        $taxBase = $baseValue;

        $costs = [];
        $commissions = [];
        $taxes = [];
        $paymentMethods = [];
        $totalCosts = 0;
        $totalCommissions = 0;
        $totalTaxes = 0;
        $totalPaymentMethods = 0;

        // Processar cada taxa
        foreach ($costCommissions as $tax) {
            // Se é taxa de pagamento (payment_method), calcular proporcionalmente por cada pagamento
            if ($tax->category === 'payment_method') {
                $paymentFees = $this->calculatePaymentMethodTaxes($tax, $order, $revenueBase, $taxBase);

                foreach ($paymentFees as $paymentFee) {
                    // Permitir taxas com valor 0 (para identificação/vínculo)
                    $paymentMethods[] = $paymentFee;
                    $totalPaymentMethods += $paymentFee['calculated_value'];
                }
            } else {
                // Para outras taxas (custos, comissões, impostos), manter comportamento atual
                $calculatedValue = $this->calculateTaxValue($tax, $order, $revenueBase, $taxBase);

                // Pular taxas que não se aplicam (valor zero)
                if ($calculatedValue <= 0) {
                    continue;
                }

                $taxData = [
                    'id' => $tax->id,
                    'name' => $tax->name,
                    'type' => $tax->type,
                    'value' => $tax->value,
                    'calculated_value' => $calculatedValue,
                    'category' => $tax->category,
                ];

                // Separar entre custos, comissões e impostos baseado na category
                if ($tax->category === 'commission') {
                    $commissions[] = $taxData;
                    $totalCommissions += $calculatedValue;
                } elseif ($tax->category === 'tax') {
                    $taxes[] = $taxData;
                    $totalTaxes += $calculatedValue;
                } else {
                    $costs[] = $taxData;
                    $totalCosts += $calculatedValue;
                }

                // Ajustar bases para próximas taxas
                if ($tax->reduces_revenue_base) {
                    $revenueBase -= $calculatedValue;
                }
                if ($tax->affects_revenue_base) {
                    $revenueBase -= $calculatedValue;
                }
            }
        }

        if ($this->isTakeatIfoodOrder($order)) {
            $ifoodFixedFee = 0.99;
            $commissions[] = [
                'id' => null,
                'name' => 'Taxa fixa iFood (Takeat)',
                'type' => 'fixed',
                'value' => $ifoodFixedFee,
                'calculated_value' => $ifoodFixedFee,
                'category' => 'commission',
            ];
            $totalCommissions += $ifoodFixedFee;
        }

        $netRevenue = $baseValue - $totalCosts - $totalCommissions - $totalTaxes - $totalPaymentMethods;

        return [
            'costs' => $costs,
            'commissions' => $commissions,
            'taxes' => $taxes,
            'payment_methods' => $paymentMethods,
            'total_costs' => round($totalCosts, 2),
            'total_commissions' => round($totalCommissions, 2),
            'total_taxes' => round($totalTaxes, 2),
            'total_payment_methods' => round($totalPaymentMethods, 2),
            'net_revenue' => round($netRevenue, 2),
            'base_value' => $baseValue,
        ];
    }

    /**
     * Detectar providers a partir dos métodos de pagamento
     */
    private function detectPaymentProviders(Order $order): array
    {
        $providers = [];

        // Para pedidos Takeat, verificar keywords dos métodos de pagamento
        if ($order->provider === 'takeat') {
            $payments = $order->raw['session']['payments'] ?? [];
            foreach ($payments as $payment) {
                $keyword = $payment['payment_method']['keyword'] ?? '';

                // Normalizar keyword (substituir underscores e pontos por espaços para facilitar detecção)
                $normalizedKeyword = str_replace(['_', '.'], ' ', strtolower($keyword));

                // Detectar provider pelo keyword (ex: 99food_pagamento_online ou 99food_pagamento.online)
                if (str_contains($normalizedKeyword, '99food')) {
                    $providers[] = '99food';
                } elseif (str_contains($normalizedKeyword, 'ifood')) {
                    $providers[] = 'ifood';
                } elseif (str_contains($normalizedKeyword, 'rappi')) {
                    $providers[] = 'rappi';
                } elseif (str_contains($normalizedKeyword, 'uber')) {
                    $providers[] = 'uber_eats';
                } elseif (str_contains($normalizedKeyword, 'keeta')) {
                    $providers[] = 'keeta';
                }
            }
        }

        return array_unique($providers);
    }

    /**
     * Calcular taxas de pagamento proporcionalmente para cada forma de pagamento
     * Usa vínculos estruturados (payment_fee_links) quando disponível
     */
    private function calculatePaymentMethodTaxes(
        CostCommission $tax,
        Order $order,
        float $revenueBase,
        float $taxBase
    ): array {
        $result = [];

        // Obter pagamentos do pedido
        $payments = $this->getOrderPayments($order);

        if (empty($payments)) {
            return $result;
        }

        // Obter subtotal para cálculo correto das taxas
        $subtotal = $this->getOrderSubtotal($order);

        // Verificar se esta taxa está vinculada a algum pagamento através de payment_fee_links
        $paymentFeeLinks = $order->payment_fee_links ?? [];
        $taxIsLinked = in_array($tax->id, $paymentFeeLinks);

        // Se a taxa está vinculada, aplicar apenas para os métodos vinculados
        if ($taxIsLinked) {
            foreach ($paymentFeeLinks as $method => $linkedTaxId) {
                if ($linkedTaxId !== $tax->id) {
                    continue;
                }

                // IMPORTANTE: Encontrar TODOS os pagamentos do método, não apenas o primeiro
                $matchedPayments = collect($payments)->where('method', $method);

                if ($matchedPayments->isEmpty()) {
                    continue;
                }

                // Aplicar taxa para CADA pagamento individual do método
                foreach ($matchedPayments as $matchedPayment) {
                    $paymentName = $matchedPayment['name'] ?? 'Pagamento';
                    $paymentValue = $matchedPayment['value'] ?? 0;
                    $calculatedValue = 0;

                    // Para taxas percentuais, aplicar sobre o SUBTOTAL (não sobre valor pago)
                    // Quando há subsídio, a taxa é cobrada sobre subtotal (pago + subsídio)
                    if ($tax->type === 'percentage') {
                        $calculatedValue = ($subtotal * $tax->value) / 100;
                    } else {
                        // Para taxas fixas, aplicar valor fixo para cada pagamento
                        $calculatedValue = (float) $tax->value;
                    }

                    // Para vínculos manuais, permitir taxas com valor 0 (identificação apenas)
                    // Isso evita que pedidos vinculados apareçam como "sem taxa de pagamento"
                    $result[] = [
                        'id' => $tax->id,
                        'name' => "{$tax->name} ({$paymentName})",
                        'type' => $tax->type,
                        'value' => $tax->value,
                        'calculated_value' => round($calculatedValue, 2),
                        'category' => $tax->category,
                        'payment_method' => $method,
                        'payment_value' => $paymentValue,
                        'is_linked' => true, // Marcar que é vínculo estruturado
                    ];
                }
            }

            return $result;
        }

        // Se não está vinculada, usar lógica de matching por características (comportamento anterior)
        $matchedPayment = null;
        foreach ($payments as $payment) {
            if ($this->shouldApplyTaxToPayment($tax, $payment, $order)) {
                $matchedPayment = $payment;
                break;
            }
        }

        if (! $matchedPayment) {
            return $result;
        }

        // Aplicar taxa UMA VEZ sobre o subtotal
        $paymentMethod = $matchedPayment['method'] ?? null;
        $paymentName = $matchedPayment['name'] ?? 'Pagamento';

        $calculatedValue = 0;
        $baseForCalculation = $tax->enters_tax_base ? $taxBase : $subtotal;

        if ($tax->type === 'percentage') {
            $calculatedValue = ($baseForCalculation * $tax->value) / 100;
        } else {
            $calculatedValue = (float) $tax->value;
        }

        if ($calculatedValue > 0) {
            $result[] = [
                'id' => $tax->id,
                'name' => "{$tax->name} ({$paymentName})",
                'type' => $tax->type,
                'value' => $tax->value,
                'calculated_value' => round($calculatedValue, 2),
                'category' => $tax->category,
                'payment_method' => $paymentMethod,
                'is_linked' => false, // Matching por características
            ];
        }

        return $result;
    }

    /**
     * Obter lista de pagamentos do pedido com valores
     * IMPORTANTE: Usa normalização do PaymentFeeLinkService para garantir consistência
     */
    private function getOrderPayments(Order $order): array
    {
        $payments = [];

        // Para pedidos Takeat - usar normalização do PaymentFeeLinkService
        if ($order->provider === 'takeat') {
            $rawPayments = $order->raw['session']['payments'] ?? [];

            foreach ($rawPayments as $payment) {
                $paymentMethod = $payment['payment_method'] ?? [];
                $keyword = $paymentMethod['keyword'] ?? '';
                $name = $paymentMethod['name'] ?? 'Pagamento';
                $value = (float) ($payment['payment_value'] ?? 0);

                // Pular subsídios e cupons (não aplicar taxas sobre eles)
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

                // IMPORTANTE: Usar mesma normalização do PaymentFeeLinkService
                $method = $this->linkService->normalizePaymentMethodForOrder($order, $keyword);

                $payments[] = [
                    'method' => $method,
                    'name' => $name,
                    'keyword' => $keyword,
                    'value' => $value,
                ];
            }

            return $payments;
        }

        // Para iFood direto
        if ($order->provider === 'ifood' && isset($order->raw['payments']['methods'])) {
            foreach ($order->raw['payments']['methods'] as $payment) {
                $method = $payment['method'] ?? null;
                $value = (float) ($payment['value'] ?? 0);

                if ($method && $value > 0) {
                    $payments[] = [
                        'method' => $method,
                        'name' => $method,
                        'keyword' => $method,
                        'value' => $value,
                    ];
                }
            }
        }

        return $payments;
    }

    /**
     * Verificar se uma taxa deve ser aplicada a um pagamento específico
     */
    private function shouldApplyTaxToPayment(CostCommission $tax, array $payment, Order $order): bool
    {
        $method = $payment['method'] ?? null;
        $keyword = $payment['keyword'] ?? '';

        if (! $method) {
            return false;
        }

        // Se tem payment_type definido (online/offline), verificar
        if (isset($tax->payment_type)) {
            // Verificar primeiro pelo keyword (mais específico para Takeat)
            $checkMethod = ! empty($keyword) ? $keyword : $method;
            $isOnline = is_online_payment_method($checkMethod);

            // Se a taxa é para online mas o pagamento é offline (ou vice-versa), não aplicar
            if ($tax->payment_type === 'online' && ! $isOnline) {
                return false;
            }
            if ($tax->payment_type === 'offline' && $isOnline) {
                return false;
            }
        }

        // Se condition_values está vazio, aplica a TODOS os métodos do tipo especificado
        $conditionValues = $tax->condition_values ?? [];
        if (empty($conditionValues)) {
            return true;
        }

        // Verificar se o método está na lista de condition_values
        return in_array($method, $conditionValues);
    }

    /**
     * Calcular valor de uma taxa específica
     */
    private function calculateTaxValue(
        CostCommission $tax,
        Order $order,
        float $revenueBase,
        float $taxBase
    ): float {
        // Verificar condições de aplicação
        if (! $this->shouldApplyTax($tax, $order)) {
            return 0;
        }

        $baseForCalculation = $tax->enters_tax_base ? $taxBase : $revenueBase;

        if ($tax->type === 'percentage') {
            return ($baseForCalculation * $tax->value) / 100;
        }

        // Valor fixo
        return (float) $tax->value;
    }

    /**
     * Verificar se uma taxa deve ser aplicada baseado nas condições
     */
    private function shouldApplyTax(CostCommission $tax, Order $order): bool
    {
        // Se é payment_method e tem payment_type definido (online/offline), usar nova lógica
        if ($tax->applies_to === 'payment_method' && isset($tax->payment_type)) {
            // Se condition_values está vazio, aplica a TODOS os métodos do tipo especificado
            $conditionValues = $tax->condition_values ?? [];

            return $this->checkPaymentMethods($order, $conditionValues, $tax->payment_type);
        }

        // Se usa condition_values (múltiplos valores) sem payment_type, usar nova lógica
        if (! empty($tax->condition_values) && $tax->applies_to === 'payment_method') {
            return $this->checkPaymentMethods($order, $tax->condition_values, 'all');
        }

        // Lógica antiga para compatibilidade
        return match ($tax->applies_to) {
            'payment_method' => $this->checkPaymentMethod($order, $tax->condition_value),
            'order_type' => $this->checkOrderType($order, $tax->condition_value),
            'delivery_only' => $this->checkIsDelivery($order, $tax->delivery_by ?? 'all'),
            'store' => $order->store_id == $tax->condition_value,
            'all_orders' => true,
            default => ! empty($tax->condition_value) ? false : true,
        };
    }

    /**
     * Verificar se o pedido é delivery
     */
    private function checkIsDelivery(Order $order, string $deliveryBy = 'all'): bool
    {
        // Para pedidos Takeat, verificar session.table.table_type e delivery_by
        if ($order->provider === 'takeat') {
            $tableType = $order->raw['session']['table']['table_type'] ?? null;
            $orderDeliveryBy = $order->raw['session']['delivery_by'] ?? null;

            // Se não é delivery, retorna false
            if ($tableType !== 'delivery') {
                return false;
            }

            // Se a comissão é para todos os deliveries, aplica
            if ($deliveryBy === 'all') {
                return true;
            }

            // Se a comissão é para delivery da loja (MERCHANT ou vazio)
            if ($deliveryBy === 'store') {
                return $orderDeliveryBy === 'MERCHANT' || empty($orderDeliveryBy);
            }

            // Se a comissão é para delivery do marketplace
            if ($deliveryBy === 'marketplace') {
                return ! empty($orderDeliveryBy) && $orderDeliveryBy !== 'MERCHANT';
            }

            return false;
        }

        // Para outros providers (iFood, Rappi, etc), verificar orderType
        $orderType = $order->raw['orderType'] ?? $order->origin ?? null;

        if ($orderType !== 'DELIVERY') {
            return false;
        }

        // Para iFood e outros, o delivery_by indica quem realiza:
        // 'store' = entregador próprio da loja
        // 'marketplace' = entregador do marketplace
        if ($deliveryBy === 'all') {
            return true;
        }

        // Verificar quem faz o delivery no iFood
        $orderDeliveryBy = $order->raw['delivery']['deliveredBy'] ?? null;

        if ($deliveryBy === 'store') {
            return $orderDeliveryBy === 'MERCHANT';
        }

        if ($deliveryBy === 'marketplace') {
            return $orderDeliveryBy === 'MARKETPLACE';
        }

        return false;
    }

    /**
     * Verificar tipo do pedido
     */
    private function checkOrderType(Order $order, string $conditionValue): bool
    {
        // Para pedidos Takeat, verificar session.table.table_type
        if ($order->provider === 'takeat') {
            $tableType = $order->raw['session']['table']['table_type'] ?? null;
            // Normalizar para uppercase: delivery -> DELIVERY, pdv -> INDOOR, etc
            $normalizedType = strtoupper($tableType ?? '');
            if ($normalizedType === 'PDV') {
                $normalizedType = 'INDOOR';
            }

            return $normalizedType === $conditionValue;
        }

        // Para outros providers (iFood, Rappi, etc), verificar orderType
        $orderType = $order->raw['orderType'] ?? $order->origin ?? null;

        return $orderType === $conditionValue;
    }

    /**
     * Verificar método de pagamento do pedido
     */
    private function checkPaymentMethod(Order $order, string $conditionValue): bool
    {
        // Para pedidos Takeat, verificar session.payments com payment_method.method
        if ($order->provider === 'takeat') {
            $payments = $order->raw['session']['payments'] ?? [];
            foreach ($payments as $payment) {
                $method = $payment['payment_method']['method'] ?? null;
                if ($method === $conditionValue) {
                    return true;
                }
            }

            return false;
        }

        // Para iFood direto: payments->methods
        if (isset($order->raw['payments']['methods'])) {
            foreach ($order->raw['payments']['methods'] as $payment) {
                if (isset($payment['method']) && $payment['method'] === $conditionValue) {
                    return true;
                }
            }
        }

        // Fallback para outros providers que possam ter estrutura diferente
        if (isset($order->raw['payments']) && is_array($order->raw['payments'])) {
            foreach ($order->raw['payments'] as $payment) {
                if (isset($payment['method']) && $payment['method'] === $conditionValue) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Verificar múltiplos métodos de pagamento
     */
    private function checkPaymentMethods(Order $order, array $conditionValues, string $paymentType = 'all'): bool
    {
        $orderPaymentMethods = $this->getOrderPaymentMethods($order);

        if (empty($orderPaymentMethods)) {
            return false;
        }

        // Se conditionValues está vazio, aplica a TODOS os métodos do tipo especificado
        $applyToAllMethods = empty($conditionValues);

        // Verificar payment_type (online/offline/all)
        foreach ($orderPaymentMethods as $method) {
            $isOnline = is_online_payment_method($method);

            // Verificar se o método atende ao filtro de tipo
            $matchesType = $paymentType === 'all'
                || ($paymentType === 'online' && $isOnline)
                || ($paymentType === 'offline' && ! $isOnline);

            if (! $matchesType) {
                continue;
            }

            // Se deve aplicar a todos os métodos do tipo, retorna true
            if ($applyToAllMethods) {
                return true;
            }

            // Se tem lista específica, verifica se o método está nela
            if (in_array($method, $conditionValues)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Obter métodos de pagamento do pedido
     */
    private function getOrderPaymentMethods(Order $order): array
    {
        $methods = [];

        // Para pedidos Takeat
        if ($order->provider === 'takeat') {
            $payments = $order->raw['session']['payments'] ?? [];
            foreach ($payments as $payment) {
                // Preferir method, mas usar keyword se method estiver vazio
                $method = $payment['payment_method']['method'] ?? $payment['payment_method']['keyword'] ?? null;

                // Se o método é genérico "others" ou está vazio, tentar identificar pelo name
                if ($method === 'others' || empty($method) || $method === 'N/A') {
                    $name = strtolower($payment['payment_method']['name'] ?? '');

                    // Identificar tipo pelo nome
                    if (str_contains($name, 'pix')) {
                        $method = 'PIX';
                    } elseif (str_contains($name, 'crédito') || str_contains($name, 'credit')) {
                        $method = 'CREDIT_CARD';
                    } elseif (str_contains($name, 'débito') || str_contains($name, 'debit')) {
                        $method = 'DEBIT_CARD';
                    } elseif (str_contains($name, 'dinheiro') || str_contains($name, 'cash') || str_contains($name, 'money')) {
                        $method = 'MONEY';
                    } elseif (str_contains($name, 'vale') || str_contains($name, 'voucher') || str_contains($name, 'alelo') || str_contains($name, 'sodexo')) {
                        $method = 'VOUCHER';
                    }
                    // Se não identificar, usar keyword como fallback
                    if (empty($method) || $method === 'others') {
                        $method = $payment['payment_method']['keyword'] ?? 'others';
                    }
                }

                // Normalizar métodos do Takeat para o padrão esperado
                if ($method === 'DEBIT') {
                    $method = 'DEBIT_CARD';
                } elseif ($method === 'CREDIT') {
                    $method = 'CREDIT_CARD';
                } elseif ($method === 'CASH') {
                    $method = 'MONEY';
                }

                // Se ainda estiver vazio ou N/A, usar keyword como fallback ou 'others'
                if (empty($method) || $method === 'N/A') {
                    $keyword = $payment['payment_method']['keyword'] ?? '';
                    $method = ! empty($keyword) ? strtoupper($keyword) : 'others';
                }

                if ($method) {
                    $methods[] = $method;
                }
            }

            return $methods;
        }

        // Para iFood direto
        if (isset($order->raw['payments']['methods'])) {
            foreach ($order->raw['payments']['methods'] as $payment) {
                if (isset($payment['method'])) {
                    $methods[] = $payment['method'];
                }
            }

            return $methods;
        }

        // Fallback
        if (isset($order->raw['payments']) && is_array($order->raw['payments'])) {
            foreach ($order->raw['payments'] as $payment) {
                if (isset($payment['method'])) {
                    $methods[] = $payment['method'];
                }
            }
        }

        return $methods;
    }

    /**
     * Aplicar custos a um pedido e salvar
     */
    public function applyAndSaveCosts(Order $order): void
    {
        $calculation = $this->calculateCosts($order);

        $order->update([
            'calculated_costs' => $calculation,
            'total_costs' => $calculation['total_costs'],
            'total_commissions' => $calculation['total_commissions'],
            'net_revenue' => $calculation['net_revenue'],
            'costs_calculated_at' => now(),
        ]);
    }

    /**
     * Recalcular custos de múltiplos pedidos
     */
    public function recalculateBatch(Collection $orders, ?int $specificCommissionId = null, bool $isDeleting = false): int
    {
        $count = 0;

        foreach ($orders as $order) {
            try {
                if ($specificCommissionId) {
                    if ($isDeleting) {
                        $this->removeSpecificCommission($order, $specificCommissionId);
                    } else {
                        $this->recalculateSpecificCommission($order, $specificCommissionId);
                    }
                } else {
                    $this->applyAndSaveCosts($order);
                }
                $count++;
            } catch (\Exception $e) {
                \Log::error("Erro ao calcular custos do pedido {$order->id}: ".$e->getMessage());
            }
        }

        return $count;
    }

    /**
     * Recalcula apenas uma comissão específica em um pedido
     */
    public function recalculateSpecificCommission(Order $order, int $commissionId): void
    {
        $commission = CostCommission::find($commissionId);

        if (! $commission) {
            \Log::warning("Comissão {$commissionId} não encontrada para recálculo");

            return;
        }

        // Calcular subtotal (base para cálculo)
        $baseValue = $this->getOrderSubtotal($order);
        $revenueBase = $baseValue;
        $taxBase = $baseValue;

        // Aplicar reduções de base se necessário
        $allCommissions = CostCommission::where('tenant_id', $order->tenant_id)
            ->active()
            ->forProvider($order->provider, $order->provider === 'takeat' ? $order->origin : null)
            ->get();

        foreach ($allCommissions as $tax) {
            if ($tax->reduces_revenue_base && $tax->id !== $commissionId) {
                // Calcular valor dessa taxa para reduzir a base
                $value = $this->calculateTaxValue($tax, $order, $revenueBase, $taxBase);
                $revenueBase -= $value;
            }
        }

        // Calcular o valor da comissão específica
        $calculatedValue = $this->calculateTaxValue($commission, $order, $revenueBase, $taxBase);

        // Buscar o calculated_costs atual do pedido
        $calculatedCosts = $order->calculated_costs ?? [];

        // Determinar em qual categoria essa comissão se encaixa
        $categoryKey = match($commission->category) {
            'cost' => 'costs',
            'commission' => 'commissions',
            'tax' => 'taxes',
            'payment_method' => 'payment_methods',
            default => 'costs'
        };

        // Inicializar a categoria se não existir
        if (!isset($calculatedCosts[$categoryKey])) {
            $calculatedCosts[$categoryKey] = [];
        }

        // Atualizar ou adicionar essa comissão
        $found = false;
        foreach ($calculatedCosts[$categoryKey] as &$item) {
            if (($item['id'] ?? null) === $commissionId) {
                // Atualizar TODOS os campos, não apenas calculated_value
                $item['name'] = $commission->name;
                $item['type'] = $commission->type;
                $item['value'] = $commission->value;
                $item['category'] = $commission->category;
                $item['calculated_value'] = $calculatedValue;
                $found = true;
                break;
            }
        }

        // Se não encontrou e o valor é maior que zero, adicionar
        if (!$found && $calculatedValue > 0) {
            $calculatedCosts[$categoryKey][] = [
                'id' => $commissionId,
                'name' => $commission->name,
                'type' => $commission->type,
                'value' => $commission->value,
                'category' => $commission->category,
                'calculated_value' => $calculatedValue,
            ];
        }

        // Se o valor é zero, remover (não aplicável)
        if ($calculatedValue == 0) {
            $calculatedCosts[$categoryKey] = array_values(array_filter(
                $calculatedCosts[$categoryKey],
                fn($item) => ($item['id'] ?? null) !== $commissionId
            ));
        }

        // Recalcular totais
        $totalCosts = 0;
        $totalCommissions = 0;
        $totalTaxes = 0;
        $totalPaymentMethods = 0;

        foreach (($calculatedCosts['costs'] ?? []) as $cost) {
            $totalCosts += $cost['calculated_value'] ?? 0;
        }

        foreach (($calculatedCosts['commissions'] ?? []) as $comm) {
            $totalCommissions += $comm['calculated_value'] ?? 0;
        }

        foreach (($calculatedCosts['taxes'] ?? []) as $tax) {
            $totalTaxes += $tax['calculated_value'] ?? 0;
        }

        foreach (($calculatedCosts['payment_methods'] ?? []) as $pm) {
            $totalPaymentMethods += $pm['calculated_value'] ?? 0;
        }

        // Calcular net_revenue
        $netRevenue = $baseValue - $totalCosts - $totalCommissions - $totalTaxes - $totalPaymentMethods;

        // Atualizar totais no JSON
        $calculatedCosts['base_value'] = $baseValue;
        $calculatedCosts['total_costs'] = $totalCosts;
        $calculatedCosts['total_commissions'] = $totalCommissions;
        $calculatedCosts['total_taxes'] = $totalTaxes;
        $calculatedCosts['total_payment_methods'] = $totalPaymentMethods;
        $calculatedCosts['net_revenue'] = $netRevenue;

        // Salvar no pedido
        $order->update([
            'calculated_costs' => $calculatedCosts,
            'total_costs' => $totalCosts,
            'total_commissions' => $totalCommissions,
            'net_revenue' => $netRevenue,
            'costs_calculated_at' => now(),
        ]);
    }

    /**
     * Remove uma comissão específica do pedido e recalcula totais
     * Usado quando uma comissão é excluída
     */
    private function removeSpecificCommission(Order $order, int $commissionId): void
    {
        $calculatedCosts = $order->calculated_costs ?? [];

        // Remover a comissão de todas as categorias
        foreach (['costs', 'commissions', 'taxes', 'payment_methods'] as $categoryKey) {
            if (isset($calculatedCosts[$categoryKey])) {
                $calculatedCosts[$categoryKey] = array_values(array_filter(
                    $calculatedCosts[$categoryKey],
                    fn($item) => ($item['id'] ?? null) !== $commissionId
                ));
            }
        }

        // Recalcular totais agregados
        $baseValue = $calculatedCosts['base_value'] ?? $this->getOrderSubtotal($order);
        $totalCosts = 0;
        $totalCommissions = 0;
        $totalTaxes = 0;
        $totalPaymentMethods = 0;

        foreach (($calculatedCosts['costs'] ?? []) as $cost) {
            $totalCosts += $cost['calculated_value'] ?? 0;
        }

        foreach (($calculatedCosts['commissions'] ?? []) as $comm) {
            $totalCommissions += $comm['calculated_value'] ?? 0;
        }

        foreach (($calculatedCosts['taxes'] ?? []) as $tax) {
            $totalTaxes += $tax['calculated_value'] ?? 0;
        }

        foreach (($calculatedCosts['payment_methods'] ?? []) as $pm) {
            $totalPaymentMethods += $pm['calculated_value'] ?? 0;
        }

        // Calcular net_revenue
        $netRevenue = $baseValue - $totalCosts - $totalCommissions - $totalTaxes - $totalPaymentMethods;

        // Atualizar totais no JSON
        $calculatedCosts['total_costs'] = $totalCosts;
        $calculatedCosts['total_commissions'] = $totalCommissions;
        $calculatedCosts['total_taxes'] = $totalTaxes;
        $calculatedCosts['total_payment_methods'] = $totalPaymentMethods;
        $calculatedCosts['net_revenue'] = $netRevenue;

        // Salvar no pedido
        $order->update([
            'calculated_costs' => $calculatedCosts,
            'total_costs' => $totalCosts,
            'total_commissions' => $totalCommissions,
            'net_revenue' => $netRevenue,
            'costs_calculated_at' => now(),
        ]);
    }

    /**
     * Calcula o subtotal do pedido (base para cálculos de custos, comissões e taxas)
     *
     * Para Takeat: usa total_delivery_price (valor APÓS descontos mas ANTES de taxas)
     * pois custos e comissões devem ser calculados sobre o valor efetivamente vendido
     *
     * Para iFood: usa orderAmount
     */
    private function getOrderSubtotal(Order $order): float
    {
        $subtotal = null;

        if ($order->provider === 'takeat') {
            $subtotal = $this->resolveTakeatSubtotal($order);
        }

        if ($subtotal === null && isset($order->raw['total']['orderAmount'])) {
            $subtotal = (float) $order->raw['total']['orderAmount'];
        }

        if ($subtotal === null) {
            $subtotal = (float) $order->net_total;
            if ($order->delivery_fee > 0) {
                $subtotal += (float) $order->delivery_fee;
            }
        }

        if ($this->shouldExcludeDeliveryFeeFromSubtotal($order)) {
            $subtotal -= $this->getDeliveryFeeAmount($order);
        }

        return max($subtotal, 0);
    }

    private function resolveTakeatSubtotal(Order $order): ?float
    {
        $session = $order->raw['session'] ?? [];

        $hasSubsidy = isset($session['discount_total']) &&
            (float) $session['discount_total'] > 0;

        if ($hasSubsidy) {
            $totalPaid = 0;
            $payments = $session['payments'] ?? [];

            foreach ($payments as $payment) {
                $totalPaid += (float) ($payment['payment_value'] ?? 0);
            }

            if ($totalPaid > 0) {
                return $totalPaid;
            }

            if (isset($session['old_total_price'])) {
                return (float) $session['old_total_price'];
            }
        }

        if (isset($session['total_delivery_price'])) {
            return (float) $session['total_delivery_price'];
        }

        if (isset($session['total_price'])) {
            return (float) $session['total_price'];
        }

        if (isset($session['old_total_price'])) {
            return (float) $session['old_total_price'];
        }

        return null;
    }

    private function shouldExcludeDeliveryFeeFromSubtotal(Order $order): bool
    {
        return $this->isTakeatIfoodOrder($order);
    }

    private function getDeliveryFeeAmount(Order $order): float
    {
        if ($order->delivery_fee !== null) {
            return (float) $order->delivery_fee;
        }

        return (float) ($order->raw['session']['delivery_tax_price'] ?? 0);
    }

    private function isTakeatIfoodOrder(Order $order): bool
    {
        if ($order->provider !== 'takeat') {
            return false;
        }

        $origin = strtolower((string) ($order->origin ?? ''));
        $sessionChannel = strtolower((string) ($order->raw['session']['sales_channel'] ?? ''));

        return $origin === 'ifood' || $sessionChannel === 'ifood';
    }
}
