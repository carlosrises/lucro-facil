<?php

namespace App\Console\Commands;

use App\Models\Order;
use Illuminate\Console\Command;

class CheckOrderDelivery extends Command
{
    protected $signature = 'order:check-delivery {orderId}';

    protected $description = 'Check delivery information for an order';

    public function handle()
    {
        $orderId = $this->argument('orderId');
        $order = Order::find($orderId);

        if (! $order) {
            $this->error("Order {$orderId} not found");

            return 1;
        }

        $this->info("Order ID: {$order->id}");
        $this->info("Provider: {$order->provider}");
        $this->info("Origin: {$order->origin}");

        if ($order->provider === 'takeat') {
            $tableType = $order->raw['session']['table']['table_type'] ?? 'N/A';
            $deliveryBy = $order->raw['session']['delivery_by'] ?? 'N/A';

            $this->info("Table Type: {$tableType}");
            $this->info("Delivery By: {$deliveryBy}");
        } elseif ($order->provider === 'ifood') {
            $orderType = $order->raw['orderType'] ?? 'N/A';
            $deliveredBy = $order->raw['delivery']['deliveredBy'] ?? 'N/A';

            $this->info("Order Type: {$orderType}");
            $this->info("Delivered By: {$deliveredBy}");
        }

        return 0;
    }
}
