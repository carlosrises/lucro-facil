<?php

namespace App\Services;

use App\Models\CostCommission;
use App\Models\Order;
use Illuminate\Support\Collection;

class OrderCostService
{
    /**
     * Calcular custos e comissões de um pedido
     */
    public function calculateCosts(Order $order): array
    {
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
                        if (!$costCommissions->contains('id', $tax->id)) {
                            $costCommissions->push($tax);
                        }
                    }
                }
            }
        }

        // Calcular base de cálculo para taxas
        // Para Takeat: usar total_delivery_price (subtotal que inclui produtos + entrega, já com descontos aplicados)
        // Para iFood: usar orderAmount do raw
        // Caso contrário: usar net_total + delivery_fee
        $baseValue = 0;
        
        if ($order->provider === 'takeat' && isset($order->raw['session']['total_delivery_price'])) {
            // Takeat: usar subtotal (após descontos, mas antes de taxas)
            $baseValue = (float) $order->raw['session']['total_delivery_price'];
        } elseif (isset($order->raw['total']['orderAmount'])) {
            // iFood: usar orderAmount
            $baseValue = (float) $order->raw['total']['orderAmount'];
        } else {
            // Fallback: net_total + delivery_fee
            $baseValue = (float) $order->net_total;
            if ($order->delivery_fee > 0) {
                $baseValue += (float) $order->delivery_fee;
            }
        }

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

            // Separar entre custos, comissões, impostos e métodos de pagamento baseado na category
            if ($tax->category === 'commission') {
                $commissions[] = $taxData;
                $totalCommissions += $calculatedValue;
            } elseif ($tax->category === 'tax') {
                $taxes[] = $taxData;
                $totalTaxes += $calculatedValue;
            } elseif ($tax->category === 'payment_method') {
                $paymentMethods[] = $taxData;
                $totalPaymentMethods += $calculatedValue;
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
     * Calcular valor de uma taxa específica
     */
    private function calculateTaxValue(
        CostCommission $tax,
        Order $order,
        float $revenueBase,
        float $taxBase
    ): float {
        // Verificar condições de aplicação
        if (!$this->shouldApplyTax($tax, $order)) {
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
        if (!empty($tax->condition_values) && $tax->applies_to === 'payment_method') {
            return $this->checkPaymentMethods($order, $tax->condition_values, 'all');
        }

        // Lógica antiga para compatibilidade
        return match ($tax->applies_to) {
            'payment_method' => $this->checkPaymentMethod($order, $tax->condition_value),
            'order_type' => $this->checkOrderType($order, $tax->condition_value),
            'delivery_only' => $this->checkIsDelivery($order),
            'store' => $order->store_id == $tax->condition_value,
            'all_orders' => true,
            default => !empty($tax->condition_value) ? false : true,
        };
    }

    /**
     * Verificar se o pedido é delivery
     */
    private function checkIsDelivery(Order $order): bool
    {
        // Para pedidos Takeat, verificar session.table.table_type e delivery_by
        if ($order->provider === 'takeat') {
            $tableType = $order->raw['session']['table']['table_type'] ?? null;
            $deliveryBy = $order->raw['session']['delivery_by'] ?? null;

            // Se é delivery e (é MERCHANT OU delivery_by está vazio), aplica taxa
            // Quando delivery_by está vazio, assumimos que é a loja fazendo a entrega
            if ($tableType === 'delivery' && ($deliveryBy === 'MERCHANT' || empty($deliveryBy))) {
                return true;
            }

            return false;
        }

        // Para outros providers (iFood, Rappi, etc), verificar orderType
        $orderType = $order->raw['orderType'] ?? $order->origin ?? null;
        return $orderType === 'DELIVERY';
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
                || ($paymentType === 'offline' && !$isOnline);

            if (!$matchesType) {
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

                if ($method && $method !== 'N/A') {
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
    public function recalculateBatch(Collection $orders): int
    {
        $count = 0;

        foreach ($orders as $order) {
            try {
                $this->applyAndSaveCosts($order);
                $count++;
            } catch (\Exception $e) {
                \Log::error("Erro ao calcular custos do pedido {$order->id}: " . $e->getMessage());
            }
        }

        return $count;
    }
}
