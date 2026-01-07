<?php

namespace App\Events;

use App\Models\Order;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class OrderStatusChanged implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public Order $order,
        public string $oldStatus,
        public string $newStatus,
        public bool $cancelledByCustomer = false
    ) {}

    /**
     * Get the channels the event should broadcast on.
     */
    public function broadcastOn(): Channel
    {
        return new Channel('orders.tenant.'.$this->order->tenant_id);
    }

    /**
     * Get the data to broadcast.
     */
    public function broadcastWith(): array
    {
        return [
            'order_id' => $this->order->id,
            'order_code' => $this->order->code,
            'order_uuid' => $this->order->order_uuid,
            'old_status' => $this->oldStatus,
            'new_status' => $this->newStatus,
            'cancelled_by_customer' => $this->cancelledByCustomer,
            'message' => $this->getStatusChangeMessage(),
        ];
    }

    /**
     * Nome do evento para o frontend
     */
    public function broadcastAs(): string
    {
        return 'order.status.changed';
    }

    /**
     * Mensagem amigável baseada na mudança de status
     */
    protected function getStatusChangeMessage(): string
    {
        return match ($this->newStatus) {
            'CANCELLED', 'CANCELLATION_REQUESTED' => "Pedido #{$this->order->code} foi cancelado",
            'CONFIRMED' => "Pedido #{$this->order->code} foi confirmado",
            'DISPATCHED' => "Pedido #{$this->order->code} saiu para entrega",
            'READY_TO_PICKUP' => "Pedido #{$this->order->code} está pronto para retirada",
            'CONCLUDED' => "Pedido #{$this->order->code} foi concluído",
            default => "Pedido #{$this->order->code} mudou de status"
        };
    }
}
