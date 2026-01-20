<?php

namespace App\Events;

use App\Models\Order;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class OrderCreated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public Order $order
    ) {}

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
