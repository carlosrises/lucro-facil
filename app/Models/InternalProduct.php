<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class InternalProduct extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id',
        'tax_category_id',
        'sku',
        'name',
        'category',
        'product_category',
        'max_flavors',
        'size',
        'type',
        'unit',
        'unit_cost',
        'sale_price',
        'default_margin_percent',
        'default_margin_value',
        'active',
        'is_ingredient',
    ];

    protected $casts = [
        'type' => 'string',
        'unit_cost' => 'decimal:2',
        'sale_price' => 'decimal:2',
        'default_margin_percent' => 'decimal:2',
        'default_margin_value' => 'decimal:2',
        'active' => 'boolean',
    ];

    public function costs(): HasMany
    {
        return $this->hasMany(ProductCost::class);
    }

    public function mappings(): HasMany
    {
        return $this->hasMany(ProductMapping::class);
    }

    public function taxCategory(): BelongsTo
    {
        return $this->belongsTo(TaxCategory::class);
    }

    public function ingredients(): BelongsToMany
    {
        return $this->belongsToMany(Ingredient::class, 'product_costs')
            ->withPivot(['qty'])
            ->withTimestamps();
    }

    /**
     * Calcula o CMV (Custo de Mercadoria Vendida) baseado nos ingredientes.
     *
     * @param  string|null  $size  Tamanho específico para buscar ficha técnica (broto, media, grande, familia)
     */
    public function calculateCMV(?string $size = null): float
    {
        $costs = $this->costs();

        // Se for sabor de pizza e tiver tamanho, filtrar por tamanho
        if ($this->product_category === 'sabor_pizza' && $size) {
            $costs = $costs->where('size', $size);
        }

        $costs = $costs->get();

        $total = 0;

        foreach ($costs as $cost) {
            // PRIMEIRO: Verificar se é InternalProduct marcado como ingrediente
            $internalProduct = InternalProduct::find($cost->ingredient_id);
            
            if ($internalProduct && $internalProduct->is_ingredient) {
                // Usar unit_cost do InternalProduct
                $total += $cost->qty * $internalProduct->unit_cost;
            } else {
                // Tentar buscar na tabela ingredients
                $ingredient = \App\Models\Ingredient::find($cost->ingredient_id);
                
                if ($ingredient) {
                    $total += $cost->qty * $ingredient->unit_price;
                } elseif ($internalProduct) {
                    // Fallback: se não achou ingredient mas tem internal_product
                    $total += $cost->qty * $internalProduct->unit_cost;
                }
            }
        }

        return $total;
    }

    /**
     * Retorna o custo final do produto.
     * Se houver ficha técnica (ingredientes), calcula pelo CMV.
     * Caso contrário, usa o unit_cost cadastrado manualmente.
     */
    public function getFinalCostAttribute(): float
    {
        // Verifica se tem ficha técnica
        $hasCosts = $this->costs()->exists();

        if ($hasCosts) {
            return $this->calculateCMV();
        }

        return (float) $this->unit_cost;
    }
}
