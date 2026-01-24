<?php

namespace App\Http\Controllers;

use App\Models\CostCommission;
use App\Models\Order;
use App\Models\PaymentMethodMapping;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class PaymentTriageController extends Controller
{
    /**
     * Exibir página de triagem de métodos de pagamento
     */
    public function index(Request $request)
    {
        $tenantId = $request->user()->tenant_id;

        // Buscar todos os métodos de pagamento únicos dos pedidos Takeat
        $paymentMethods = $this->getUniquePaymentMethods($tenantId);

        // Buscar taxas de pagamento disponíveis para vincular
        $availableFees = CostCommission::where('tenant_id', $tenantId)
            ->where('category', 'payment_method')
            ->select('id', 'name', 'type', 'value')
            ->orderBy('name')
            ->get();

        return Inertia::render('payment-triage', [
            'paymentMethods' => $paymentMethods,
            'availableFees' => $availableFees,
        ]);
    }

    /**
     * Buscar métodos de pagamento únicos dos pedidos
     */
    private function getUniquePaymentMethods(int $tenantId)
    {
        $paymentMethods = [];
        $mappingsCache = [];

        // Buscar pedidos Takeat com pagamentos em lotes (chunk) para evitar estouro de memória
        Order::where('tenant_id', $tenantId)
            ->where('provider', 'takeat')
            ->whereNotNull('raw')
            ->select('raw') // Selecionar apenas o campo necessário
            ->chunk(500, function ($orders) use (&$paymentMethods, &$mappingsCache, $tenantId) {
                foreach ($orders as $order) {
                    $raw = $order->raw;
                    $payments = $raw['session']['payments'] ?? [];

                    foreach ($payments as $payment) {
                        $paymentMethod = $payment['payment_method'] ?? null;

                        if (!$paymentMethod || !isset($paymentMethod['id'])) {
                            continue;
                        }

                        $paymentMethodId = (string) $paymentMethod['id'];

                        if (!isset($paymentMethods[$paymentMethodId])) {
                            // Buscar mapping existente (cache para evitar N+1 queries)
                            if (!isset($mappingsCache[$paymentMethodId])) {
                                $mappingsCache[$paymentMethodId] = PaymentMethodMapping::where('tenant_id', $tenantId)
                                    ->where('external_payment_method_id', $paymentMethodId)
                                    ->where('provider', 'takeat')
                                    ->with('costCommission:id,name')
                                    ->first();
                            }

                            $mapping = $mappingsCache[$paymentMethodId];

                            $paymentMethods[$paymentMethodId] = [
                                'id' => $paymentMethodId,
                                'name' => $paymentMethod['name'] ?? 'Sem nome',
                                'keyword' => $paymentMethod['keyword'] ?? null,
                                'order_count' => 0,
                                'cost_commission_id' => $mapping?->cost_commission_id,
                                'cost_commission_name' => $mapping?->costCommission?->name,
                                'has_no_fee' => $mapping?->has_no_fee ?? false,
                                'payment_category' => $mapping?->payment_category ?? 'payment',
                                'is_linked' => (bool) $mapping?->cost_commission_id || ($mapping?->has_no_fee ?? false) || in_array($mapping?->payment_category, ['subsidy', 'discount']),
                                'is_recalculating' => $mapping?->recalculating_since !== null,
                            ];
                        }

                        $paymentMethods[$paymentMethodId]['order_count']++;
                    }
                }
            });

        // Converter para array indexado e ordenar por quantidade de pedidos
        $result = array_values($paymentMethods);
        usort($result, fn($a, $b) => $b['order_count'] <=> $a['order_count']);

        return $result;
    }

    /**
     * Buscar detalhes de um método de pagamento
     */
    public function getDetails(Request $request, string $paymentMethodId)
    {
        $tenantId = $request->user()->tenant_id;

        $recentOrders = [];

        // Buscar últimos 10 pedidos que usaram este método (processar em chunks até encontrar 10)
        Order::where('tenant_id', $tenantId)
            ->where('provider', 'takeat')
            ->whereNotNull('raw')
            ->select('id', 'code', 'short_reference', 'placed_at', 'gross_total', 'raw')
            ->orderBy('placed_at', 'desc')
            ->chunk(200, function ($orders) use ($paymentMethodId, &$recentOrders) {
                foreach ($orders as $order) {
                    // Parar se já tiver 10 pedidos
                    if (count($recentOrders) >= 10) {
                        return false; // Para o chunk
                    }

                    $raw = $order->raw;
                    $payments = $raw['session']['payments'] ?? [];

                    foreach ($payments as $payment) {
                        $paymentMethod = $payment['payment_method'] ?? null;
                        if ($paymentMethod && (string) $paymentMethod['id'] === $paymentMethodId) {
                            $recentOrders[] = [
                                'id' => $order->id,
                                'code' => $order->code,
                                'short_reference' => $order->short_reference,
                                'placed_at' => $order->placed_at?->format('Y-m-d\TH:i:s.uP'),
                                'gross_total' => $order->gross_total,
                            ];
                            break; // Próximo pedido
                        }
                    }
                }

                // Continuar se ainda não tem 10 pedidos
                return count($recentOrders) < 10;
            });

        return response()->json([
            'recent_orders' => $recentOrders,
        ]);
    }

    /**
     * Vincular taxa a um método de pagamento
     */
    public function link(Request $request)
    {
        $validated = $request->validate([
            'payment_method_id' => 'required|string',
            'payment_method_name' => 'required|string',
            'payment_method_keyword' => 'nullable|string',
            'cost_commission_id' => 'nullable|exists:cost_commissions,id',
            'has_no_fee' => 'nullable|boolean',
            'payment_category' => 'nullable|in:payment,subsidy,discount',
        ]);

        $tenantId = $request->user()->tenant_id;

        // Criar ou atualizar mapping
        $mapping = PaymentMethodMapping::updateOrCreate(
            [
                'tenant_id' => $tenantId,
                'external_payment_method_id' => $validated['payment_method_id'],
                'provider' => 'takeat',
            ],
            [
                'payment_method_name' => $validated['payment_method_name'],
                'payment_method_keyword' => $validated['payment_method_keyword'],
                'cost_commission_id' => $validated['cost_commission_id'],
                'has_no_fee' => $validated['has_no_fee'] ?? false,
                'payment_category' => $validated['payment_category'] ?? 'payment',
                'recalculating_since' => now(), // Marca início do recálculo
            ]
        );

        // Disparar job para recalcular pedidos em background (mais rápido)
        \App\Jobs\RecalculatePaymentMethodOrders::dispatch($tenantId, $validated['payment_method_id']);

        return back()->with('success', 'Taxa vinculada com sucesso! Pedidos sendo recalculados em segundo plano.');
    }
}
