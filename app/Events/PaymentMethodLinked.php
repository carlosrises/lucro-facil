<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class PaymentMethodLinked implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    /**
     * Create a new event instance.
     */
    public function __construct(
        public int $tenantId,
        public string $paymentMethodId,
        public int $ordersRecalculated,
        public bool $success = true,
        public ?string $error = null
    ) {
        //
    }

    /**
     * Get the channels the event should broadcast on.
     *
     * @return array<int, \Illuminate\Broadcasting\Channel>
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel("tenant.{$this->tenantId}"),
        ];
    }

    /**
     * Nome do evento para o frontend
     */
    public function broadcastAs(): string
    {
        return 'payment-method-linked';
    }

    /**
     * Dados que serão enviados ao frontend
     */
    public function broadcastWith(): array
    {
        return [
            'payment_method_id' => $this->paymentMethodId,
            'orders_recalculated' => $this->ordersRecalculated,
            'success' => $this->success,
            'error' => $this->error,
        ];
    }
}
