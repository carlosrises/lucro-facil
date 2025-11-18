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
        'type',
        'unit',
        'unit_cost',
        'sale_price',
        'default_margin_percent',
        'default_margin_value',
        'active',
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
     */
    public function calculateCMV(): float
    {
        return $this->costs()
            ->join('ingredients', 'ingredients.id', '=', 'product_costs.ingredient_id')
            ->selectRaw('SUM(product_costs.qty * ingredients.unit_price) as total')
            ->value('total') ?? 0;
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
