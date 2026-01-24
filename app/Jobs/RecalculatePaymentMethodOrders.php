<?php

namespace App\Jobs;

use App\Models\Order;
use App\Services\OrderCostService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;

class RecalculatePaymentMethodOrders implements ShouldQueue
{
    use Queueable;

    /**
     * Create a new job instance.
     */
    public function __construct(
        public int $tenantId,
        public string $paymentMethodId
    ) {
        //
    }

    /**
     * Execute the job.
     */
    public function handle(OrderCostService $costService): void
    {
        // Log::info('Iniciando recálculo de pedidos com método de pagamento', [
        //     'tenant_id' => $this->tenantId,
        //     'payment_method_id' => $this->paymentMethodId,
        // ]);

        $ordersRecalculated = 0;

        try {
            // Processar pedidos em chunks para não sobrecarregar memória
            Order::where('tenant_id', $this->tenantId)
                ->where('provider', 'takeat')
                ->whereNotNull('raw')
                ->chunkById(100, function ($orders) use ($costService, &$ordersRecalculated) {
                    foreach ($orders as $order) {
                        $raw = $order->raw;
                        $payments = $raw['session']['payments'] ?? [];

                        // Verificar se este pedido usa o método de pagamento
                        $hasPaymentMethod = false;
                        foreach ($payments as $payment) {
                            $paymentMethod = $payment['payment_method'] ?? null;
                            if ($paymentMethod && (string) $paymentMethod['id'] === $this->paymentMethodId) {
                                $hasPaymentMethod = true;
                                break;
                            }
                        }

                        if (!$hasPaymentMethod) {
                            continue;
                        }

                        // Recalcular custos
                        try {
                            $result = $costService->calculateCosts($order);
                            $order->update([
                                'calculated_costs' => $result,
                                'total_costs' => $result['total_costs'] ?? 0,
                                'total_commissions' => $result['total_commissions'] ?? 0,
                                'net_revenue' => $result['net_revenue'] ?? 0,
                                'costs_calculated_at' => now(),
                            ]);
                            $ordersRecalculated++;
                        } catch (\Exception $e) {
                            Log::error('Erro ao recalcular pedido na triagem de pagamento', [
                                'order_id' => $order->id,
                                'error' => $e->getMessage(),
                            ]);
                        }
                    }
                });

            // Log::info('Recálculo de pedidos com método de pagamento concluído', [
            //     'tenant_id' => $this->tenantId,
            //     'payment_method_id' => $this->paymentMethodId,
            //     'orders_recalculated' => $ordersRecalculated,
            // ]);

            // Limpar flag de recálculo em andamento
            $updated = \App\Models\PaymentMethodMapping::where('tenant_id', $this->tenantId)
                ->where('external_payment_method_id', $this->paymentMethodId)
                ->where('provider', 'takeat')
                ->update(['recalculating_since' => null]);

            // Log::info('Flag de recálculo limpa', [
            //     'tenant_id' => $this->tenantId,
            //     'payment_method_id' => $this->paymentMethodId,
            //     'rows_updated' => $updated,
            // ]);

            // Disparar evento de sucesso (silenciosamente se WebSocket não estiver disponível)
            try {
                broadcast(new \App\Events\PaymentMethodLinked(
                    $this->tenantId,
                    $this->paymentMethodId,
                    $ordersRecalculated,
                    true
                ));
            } catch (\Exception $e) {
                Log::debug('Broadcast falhou (WebSocket indisponível)', [
                    'error' => $e->getMessage(),
                ]);
            }
        } catch (\Exception $e) {
            Log::error('Erro fatal ao recalcular pedidos com método de pagamento', [
                'tenant_id' => $this->tenantId,
                'payment_method_id' => $this->paymentMethodId,
                'error' => $e->getMessage(),
            ]);

            // Limpar flag de recálculo em andamento mesmo com erro
            $updated = \App\Models\PaymentMethodMapping::where('tenant_id', $this->tenantId)
                ->where('external_payment_method_id', $this->paymentMethodId)
                ->where('provider', 'takeat')
                ->update(['recalculating_since' => null]);

            Log::info('Flag de recálculo limpa após erro', [
                'tenant_id' => $this->tenantId,
                'payment_method_id' => $this->paymentMethodId,
                'rows_updated' => $updated,
            ]);

            // Disparar evento de erro (silenciosamente se WebSocket não estiver disponível)
            try {
                broadcast(new \App\Events\PaymentMethodLinked(
                    $this->tenantId,
                    $this->paymentMethodId,
                    $ordersRecalculated,
                    false,
                    $e->getMessage()
                ));
            } catch (\Exception $broadcastError) {
                Log::debug('Broadcast falhou (WebSocket indisponível)', [
                    'error' => $broadcastError->getMessage(),
                ]);
            }
        }
    }
}
