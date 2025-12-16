<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderItemMapping extends Model
{
    protected $fillable = [
        'tenant_id',
        'order_item_id',
        'internal_product_id',
        'quantity',
        'mapping_type',
        'external_reference',
        'external_name',
    ];

    protected $casts = [
        'quantity' => 'decimal:4',
    ];

    /**
     * Relacionamento com OrderItem
     */
    public function orderItem(): BelongsTo
    {
        return $this->belongsTo(OrderItem::class);
    }

    /**
     * Relacionamento com InternalProduct
     */
    public function internalProduct(): BelongsTo
    {
        return $this->belongsTo(InternalProduct::class);
    }

    /**
     * Relacionamento com Tenant
     */
    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    /**
     * Calcular custo total desta associação
     */
    public function calculateCost(): float
    {
        if (!$this->internalProduct || !$this->internalProduct->unit_cost) {
            return 0;
        }

        $unitCost = (float) $this->internalProduct->unit_cost;
        $quantity = (float) $this->quantity;

        return $unitCost * $quantity;
    }
}
