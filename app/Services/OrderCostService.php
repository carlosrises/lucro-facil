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

        // Usar raw->total->orderAmount se net_total estiver zerado
        $baseValue = (float) $order->net_total;
        if ($baseValue == 0 && isset($order->raw['total']['orderAmount'])) {
            $baseValue = (float) $order->raw['total']['orderAmount'];
        }

        $revenueBase = $baseValue;
        $taxBase = $baseValue;

        $costs = [];
        $commissions = [];
        $totalCosts = 0;
        $totalCommissions = 0;

        // Processar cada taxa
        foreach ($costCommissions as $tax) {
            $calculatedValue = $this->calculateTaxValue($tax, $order, $revenueBase, $taxBase);

            $taxData = [
                'id' => $tax->id,
                'name' => $tax->name,
                'type' => $tax->type,
                'value' => $tax->value,
                'calculated_value' => $calculatedValue,
            ];

            // Separar entre custos e comissões baseado na category
            if ($tax->category === 'commission') {
                $commissions[] = $taxData;
                $totalCommissions += $calculatedValue;
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

        $netRevenue = $baseValue - $totalCosts - $totalCommissions;

        return [
            'costs' => $costs,
            'commissions' => $commissions,
            'total_costs' => round($totalCosts, 2),
            'total_commissions' => round($totalCommissions, 2),
            'net_revenue' => round($netRevenue, 2),
            'base_value' => $baseValue,
        ];
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

            // Só considera delivery se o tipo for delivery E a entrega for feita pelo merchant
            return $tableType === 'delivery' && $deliveryBy === 'MERCHANT';
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
        // Buscar no campo raw do pedido (iFood usa payments->methods)
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
