<?php

namespace App\Events;

use App\Models\Order;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class OrderCreated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public Order $order
    ) {
        // \Log::info('[OrderCreated Event] Disparando evento', [
        //     'tenant_id' => $order->tenant_id,
        //     'order_id' => $order->id,
        //     'order_code' => $order->code,
        //     'channel' => "orders.tenant.{$order->tenant_id}",
        // ]);
    }

    /**
     * Canal no qual o evento será transmitido
     */
    public function broadcastOn(): Channel
    {
        return new Channel("orders.tenant.{$this->order->tenant_id}");
    }

    /**
     * Nome do evento que será escutado no frontend
     */
    public function broadcastAs(): string
    {
        return 'order.created';
    }

    /**
     * Dados que serão transmitidos
     */
    public function broadcastWith(): array
    {
        return [
            'tenant_id' => $this->order->tenant_id,
            'order_id' => $this->order->id,
            'order_code' => $this->order->code,
            'provider' => $this->order->provider,
            'total' => $this->order->gross_total,
            'timestamp' => now()->toIso8601String(),
        ];
    }
}
