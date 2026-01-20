<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ItemTriaged implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    /**
     * Create a new event instance.
     */
    public function __construct(
        public int $tenantId,
        public int $orderId,
        public string $orderCode,
        public int $itemId,
        public string $itemName,
        public ?int $internalProductId,
        public ?string $itemType,
        public string $action, // 'classified' ou 'mapped'
    ) {}

    /**
     * Get the channels the event should broadcast on.
     *
     * @return array<int, \Illuminate\Broadcasting\Channel>
     */
    public function broadcastOn(): array
    {
        return [
            new Channel("orders.tenant.{$this->tenantId}"),
        ];
    }

    /**
     * The event's broadcast name.
     */
    public function broadcastAs(): string
    {
        return 'item.triaged';
    }

    /**
     * Get the data to broadcast.
     */
    public function broadcastWith(): array
    {
        return [
            'tenant_id' => $this->tenantId,
            'order_id' => $this->orderId,
            'order_code' => $this->orderCode,
            'item_id' => $this->itemId,
            'item_name' => $this->itemName,
            'internal_product_id' => $this->internalProductId,
            'item_type' => $this->itemType,
            'action' => $this->action,
            'timestamp' => now()->toIso8601String(),
        ];
    }
}
