<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderItemMapping extends Model
{
    // Tipos de opção para sistema de pizza
    public const OPTION_TYPE_PIZZA_FLAVOR = 'pizza_flavor';

    public const OPTION_TYPE_REGULAR = 'regular';

    public const OPTION_TYPE_ADDON = 'addon';

    public const OPTION_TYPE_OBSERVATION = 'observation';

    public const OPTION_TYPE_DRINK = 'drink';

    public const OPTION_TYPES = [
        self::OPTION_TYPE_PIZZA_FLAVOR => 'Sabor de Pizza',
        self::OPTION_TYPE_REGULAR => 'Item Regular',
        self::OPTION_TYPE_ADDON => 'Complemento',
        self::OPTION_TYPE_OBSERVATION => 'Observação',
        self::OPTION_TYPE_DRINK => 'Bebida',
    ];

    protected $fillable = [
        'tenant_id',
        'order_item_id',
        'internal_product_id',
        'quantity',
        'mapping_type',
        'option_type',
        'auto_fraction',
        'notes',
        'external_reference',
        'external_name',
        'unit_cost_override',
    ];

    protected $casts = [
        'quantity' => 'decimal:4',
        'unit_cost_override' => 'decimal:4',
        'auto_fraction' => 'boolean',
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
     * Usa unit_cost_override se disponível (CMV calculado por tamanho)
     * Senão usa unit_cost do produto
     */
    public function calculateCost(): float
    {
        if (! $this->internalProduct) {
            return 0;
        }

        $quantity = (float) $this->quantity;

        // Prioridade 1: usar unit_cost_override se foi calculado
        if ($this->unit_cost_override !== null) {
            return (float) $this->unit_cost_override * $quantity;
        }

        // Prioridade 2: usar unit_cost do produto
        $unitCost = (float) $this->internalProduct->unit_cost;
        return $unitCost * $quantity;
    }

        // Padrões de grande
        if (preg_match('/\b(grande|gd|g)\b/i', $nameLower)) {
            return 'grande';
        }

        // Padrões de média
        if (preg_match('/\b(media|média|md|m)\b/i', $nameLower)) {
            return 'media';
        }

        // Padrões de broto
        if (preg_match('/\b(broto|brotinho|bt|b)\b/i', $nameLower)) {
            return 'broto';
        }

        return null;
    }

    /**
     * Verificar se é um sabor de pizza
     */
    public function isPizzaFlavor(): bool
    {
        return $this->option_type === self::OPTION_TYPE_PIZZA_FLAVOR;
    }

    /**
     * Verificar se usa fração automática
     */
    public function usesAutoFraction(): bool
    {
        return $this->auto_fraction === true;
    }

    /**
     * Obter label do tipo de opção
     */
    public function getOptionTypeLabel(): ?string
    {
        return self::OPTION_TYPES[$this->option_type] ?? null;
    }
}
