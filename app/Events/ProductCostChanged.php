<?php

namespace App\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ProductCostChanged
{
    use Dispatchable, SerializesModels;

    public int $productId;

    public int $tenantId;

    public ?float $oldCost;

    public float $newCost;

    /**
     * Create a new event instance.
     */
    public function __construct(int $productId, int $tenantId, ?float $oldCost, float $newCost)
    {
        $this->productId = $productId;
        $this->tenantId = $tenantId;
        $this->oldCost = $oldCost;
        $this->newCost = $newCost;
    }
}
