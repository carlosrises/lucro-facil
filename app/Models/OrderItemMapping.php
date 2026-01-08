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
    ];

    protected $casts = [
        'quantity' => 'decimal:4',
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
     */
    public function calculateCost(): float
    {
        if (! $this->internalProduct) {
            return 0;
        }

        $quantity = (float) $this->quantity;

        // Se for sabor de pizza e o produto tiver ficha técnica por tamanho,
        // detectar o tamanho do item pai e buscar o CMV específico
        if ($this->internalProduct->product_category === 'sabor_pizza' && $this->orderItem) {
            $size = $this->detectPizzaSize($this->orderItem->name);

            if ($size) {
                // Verificar se existe ficha técnica para esse tamanho
                $hasCostForSize = $this->internalProduct->costs()
                    ->where('size', $size)
                    ->exists();

                if ($hasCostForSize) {
                    $cmv = $this->internalProduct->calculateCMV($size);

                    return $cmv * $quantity;
                }
            }
        }

        // Fallback: usar unit_cost ou getFinalCostAttribute (que já calcula CMV se tiver ficha técnica sem tamanho)
        $unitCost = (float) $this->internalProduct->final_cost;

        return $unitCost * $quantity;
    }

    /**
     * Detectar tamanho da pizza baseado no nome do item
     */
    protected function detectPizzaSize(string $itemName): ?string
    {
        $nameLower = mb_strtolower($itemName);

        // Padrões de família (big, don, 70x35, gigante, super)
        if (preg_match('/\b(big|don|70x35|gigante|super|familia|família)\b/i', $nameLower)) {
            return 'familia';
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
