<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class InternalProduct extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id',
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
}
