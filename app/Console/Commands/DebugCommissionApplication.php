<?php

namespace App\Console\Commands;

use App\Models\CostCommission;
use App\Models\Order;
use App\Services\OrderCostService;
use Illuminate\Console\Command;

class DebugCommissionApplication extends Command
{
    protected $signature = 'debug:commission {orderId}';

    protected $description = 'Debug commission application for an order';

    public function handle(OrderCostService $costService)
    {
        $orderId = $this->argument('orderId');
        $order = Order::find($orderId);

        if (! $order) {
            $this->error("Order {$orderId} not found");

            return 1;
        }

        $this->info('=== Order Info ===');
        $this->info("ID: {$order->id}");
        $this->info("Provider: {$order->provider}");
        $this->info("Tenant ID: {$order->tenant_id}");

        // Delivery info
        if ($order->provider === 'takeat') {
            $tableType = $order->raw['session']['table']['table_type'] ?? 'N/A';
            $deliveryBy = $order->raw['session']['delivery_by'] ?? 'N/A';
            $this->info("Table Type: {$tableType}");
            $this->info("Delivery By: {$deliveryBy}");
        }

        $this->info("\n=== Active Delivery Commissions ===");
        $commissions = CostCommission::where('tenant_id', $order->tenant_id)
            ->where('applies_to', 'delivery_only')
            ->where('active', true)
            ->get();

        foreach ($commissions as $commission) {
            $this->info("ID: {$commission->id}");
            $this->info("  Name: {$commission->name}");
            $this->info("  Delivery By: {$commission->delivery_by}");
            $this->info('  Provider: '.($commission->provider ?? 'all'));
            $this->info('---');
        }

        $this->info("\n=== Testing Application ===");

        // Buscar comissões que deveriam ser aplicadas
        $origin = $order->provider === 'takeat' ? $order->origin : null;
        $applicableCommissions = CostCommission::where('tenant_id', $order->tenant_id)
            ->active()
            ->forProvider($order->provider, $origin)
            ->get();

        $this->info("Found {$applicableCommissions->count()} applicable commissions:");
        foreach ($applicableCommissions as $comm) {
            $this->info("  - ID {$comm->id}: {$comm->name} (applies_to: {$comm->applies_to}, delivery_by: {$comm->delivery_by})");
        }

        try {
            $costService->applyAndSaveCosts($order->fresh());
            $this->info('✅ applyAndSaveCosts executed successfully');
        } catch (\Exception $e) {
            $this->error("❌ Error applying costs: {$e->getMessage()}");
            $this->error($e->getTraceAsString());
        }

        $order = $order->fresh();

        $this->info("\nCalculated Costs: ".json_encode($order->calculated_costs, JSON_PRETTY_PRINT));
        $this->info("Total Costs: {$order->total_costs}");
        $this->info("Total Commissions: {$order->total_commissions}");
        $this->info("Net Revenue: {$order->net_revenue}");

        return 0;
    }
}
