<?php

namespace App\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class IngredientCostChanged
{
    use Dispatchable, SerializesModels;

    public int $ingredientId;

    public int $tenantId;

    public ?float $oldCost;

    public float $newCost;

    /**
     * Create a new event instance.
     */
    public function __construct(int $ingredientId, int $tenantId, ?float $oldCost, float $newCost)
    {
        $this->ingredientId = $ingredientId;
        $this->tenantId = $tenantId;
        $this->oldCost = $oldCost;
        $this->newCost = $newCost;
    }
}
