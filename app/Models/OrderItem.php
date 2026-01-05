<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class OrderItem extends Model
{
    protected $fillable = [
        'tenant_id', 'order_id', 'sku', 'name',
        'qty', 'unit_price', 'total', 'add_ons'
    ];

    protected $casts = [
        'add_ons' => 'array',
    ];

    protected $appends = [
        'total_cost', // Adicionar custo calculado aos atributos serializados
    ];

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    /**
     * Relacionamento legado (backward compatibility)
     * Retorna o primeiro produto associado via ProductMapping
     */
    public function internalProduct()
    {
        return $this->hasOneThrough(
            InternalProduct::class,
            ProductMapping::class,
            'external_item_id', // Foreign key on product_mappings table
            'id', // Foreign key on internal_products table
            'sku', // Local key on order_items table
            'internal_product_id' // Local key on product_mappings table
        );
    }

    /**
     * Relacionamento com ProductMapping para obter item_type
     */
    public function productMapping()
    {
        return $this->hasOne(ProductMapping::class, 'external_item_id', 'sku');
    }

    /**
     * Novo sistema de múltiplas associações
     */
    public function mappings(): HasMany
    {
        return $this->hasMany(OrderItemMapping::class);
    }

    /**
     * Calcular custo total do item considerando todas as associações
     */
    public function calculateTotalCost(): float
    {
        $totalCost = 0;
        $itemQuantity = $this->qty ?? $this->quantity ?? 1;

        // Se tem novas associações, usar elas
        if ($this->mappings()->exists()) {
            foreach ($this->mappings as $mapping) {
                $totalCost += $mapping->calculateCost();
            }
        }
        // Fallback para sistema legado
        elseif ($this->internalProduct && $this->internalProduct->unit_cost) {
            $unitCost = (float) $this->internalProduct->unit_cost;
            $totalCost = $unitCost;
        }

        return $totalCost * $itemQuantity;
    }

    /**
     * Accessor para retornar o custo total calculado
     */
    public function getTotalCostAttribute(): float
    {
        return $this->calculateTotalCost();
    }
}
