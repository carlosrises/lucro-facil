<?php

namespace App\Console\Commands;

use App\Models\CostCommission;
use App\Models\Order;
use Illuminate\Console\Command;

class DiagnoseOperationalCosts extends Command
{
    protected $signature = 'orders:diagnose-operational-costs {orderId}';

    protected $description = 'Diagnostica os custos operacionais de um pedido específico';

    public function handle(): int
    {
        $orderId = $this->argument('orderId');
        $order = Order::with('store')->find($orderId);

        if (!$order) {
            $this->error("❌ Pedido ID {$orderId} não encontrado");
            return 1;
        }

        $this->info("═══════════════════════════════════════════════════════════════");
        $this->info("📦 DIAGNÓSTICO DE CUSTOS OPERACIONAIS");
        $this->info("═══════════════════════════════════════════════════════════════");
        $this->newLine();

        $this->info("🆔 Pedido: #{$order->code}");
        $this->info("🏪 Loja: {$order->store->name} (ID: {$order->store_id})");
        $this->info("🏷️  Provider: {$order->provider}");
        $this->info("🏷️  Origin: " . ($order->origin ?? 'N/A'));
        $this->info("🏷️  Tenant: {$order->tenant_id}");
        $this->info("💰 Gross Total: R$ " . number_format($order->gross_total, 2, ',', '.'));
        $this->newLine();

        // Verificar delivery_by
        $deliveryBy = $order->raw['session']['delivery_by'] ?? null;
        $this->info("🚚 Delivery By: " . ($deliveryBy ?? 'N/A'));
        $this->newLine();

        // Verificar calculated_costs
        $this->info("───────────────────────────────────────────────────────────────");
        $this->info("📊 CALCULATED_COSTS (Campo no banco)");
        $this->info("───────────────────────────────────────────────────────────────");

        if ($order->calculated_costs) {
            $this->line(json_encode($order->calculated_costs, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        } else {
            $this->warn("⚠️  Campo calculated_costs está vazio/null");
        }
        $this->newLine();

        // Buscar todas as comissões que PODEM se aplicar a este pedido
        $this->info("───────────────────────────────────────────────────────────────");
        $this->info("🔍 COMISSÕES/CUSTOS CADASTRADOS (que podem se aplicar)");
        $this->info("───────────────────────────────────────────────────────────────");

        $potentialCosts = CostCommission::where('tenant_id', $order->tenant_id)
            ->where(function ($q) use ($order) {
                // Provider exato
                $q->where('provider', $order->provider)
                  // Ou takeat com origin correspondente
                  ->orWhere(function ($q2) use ($order) {
                      if ($order->provider === 'takeat' && $order->origin) {
                          $q2->where('provider', $order->origin);
                      }
                  });
            })
            ->get();

        if ($potentialCosts->isEmpty()) {
            $this->warn("⚠️  Nenhuma comissão/custo cadastrado para este provider/origin");
        } else {
            foreach ($potentialCosts as $cost) {
                $this->newLine();
                $this->line("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
                $this->info("🏷️  {$cost->name} (ID: {$cost->id})");
                $this->line("   Provider: {$cost->provider}");
                $this->line("   Tipo: {$cost->applies_to}");
                $this->line("   Valor: " . ($cost->type === 'percentage' ? "{$cost->value}%" : "R$ {$cost->value}"));
                $this->line("   Base de cálculo: {$cost->base_for_calculation}");
                $this->line("   Delivery by: " . ($cost->delivery_by ?? 'Todos'));
                $this->line("   Ativo: " . ($cost->is_active ? '✅ SIM' : '❌ NÃO'));
                $this->line("   Excluído: " . ($cost->deleted_at ? "❌ SIM ({$cost->deleted_at})" : '✅ NÃO'));

                // Verificar se esta comissão/custo se aplica
                $applies = $this->checkIfApplies($cost, $order, $deliveryBy);

                if ($applies) {
                    $this->info("   ✅ DEVE SER APLICADA");

                    // Calcular valor
                    $calculatedValue = $this->calculateValue($cost, $order);
                    $this->line("   💰 Valor calculado: R$ " . number_format($calculatedValue, 2, ',', '.'));
                } else {
                    $this->warn("   ⚠️  NÃO SE APLICA");
                    $this->line("   Motivo: " . $this->getNotApplicableReason($cost, $order, $deliveryBy));
                }
            }
        }

        $this->newLine();
        $this->info("───────────────────────────────────────────────────────────────");
        $this->info("📊 RESUMO FINAL");
        $this->info("───────────────────────────────────────────────────────────────");
        $this->info("Total Costs (banco): R$ " . number_format($order->total_costs ?? 0, 2, ',', '.'));
        $this->info("Total Commissions (banco): R$ " . number_format($order->total_commissions ?? 0, 2, ',', '.'));

        return 0;
    }

    private function checkIfApplies(CostCommission $cost, Order $order, ?string $deliveryBy): bool
    {
        // Verificar se está ativo
        if (!$cost->is_active) {
            return false;
        }

        // Verificar se está excluído
        if ($cost->deleted_at) {
            return false;
        }

        // Verificar delivery_by
        if ($cost->delivery_by && $cost->delivery_by !== $deliveryBy) {
            return false;
        }

        return true;
    }

    private function getNotApplicableReason(CostCommission $cost, Order $order, ?string $deliveryBy): string
    {
        if (!$cost->is_active) {
            return "Está inativo (is_active = false)";
        }

        if ($cost->deleted_at) {
            return "Foi excluído (soft delete) em {$cost->deleted_at}";
        }

        if ($cost->delivery_by && $cost->delivery_by !== $deliveryBy) {
            return "delivery_by não corresponde (esperado: {$cost->delivery_by}, encontrado: " . ($deliveryBy ?? 'null') . ")";
        }

        return "Motivo desconhecido";
    }

    private function calculateValue(CostCommission $cost, Order $order): float
    {
        $base = 0;

        // Determinar base de cálculo
        switch ($cost->base_for_calculation) {
            case 'order_total':
                $base = $order->gross_total ?? 0;
                break;
            case 'delivery_fee':
                $base = $order->delivery_fee ?? 0;
                break;
            case 'subtotal':
                $base = ($order->gross_total ?? 0) - ($order->delivery_fee ?? 0);
                break;
            default:
                $base = $order->gross_total ?? 0;
        }

        // Calcular valor
        if ($cost->type === 'percentage') {
            return ($base * $cost->value) / 100;
        } else {
            return $cost->value;
        }
    }
}
