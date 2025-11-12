<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Product extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id',
        'name',
        'sku',
        'type',
        'unit',
        'unit_cost',
        'sale_price',
        'active',
    ];

    protected $casts = [
        'unit_cost' => 'decimal:2',
        'sale_price' => 'decimal:2',
        'active' => 'boolean',
    ];

    public function ingredients(): BelongsToMany
    {
        return $this->belongsToMany(Ingredient::class, 'product_recipes')
            ->withPivot(['quantity', 'unit'])
            ->withTimestamps();
    }

    public function recipes(): HasMany
    {
        return $this->hasMany(ProductRecipe::class);
    }

    /**
     * Calcula o CMV (Custo da Mercadoria Vendida) baseado na ficha técnica
     */
    public function calculateCMV(): float
    {
        return $this->recipes()
            ->with('ingredient')
            ->get()
            ->sum(function ($recipe) {
                return $recipe->ingredient->unit_price * $recipe->quantity;
            });
    }
}
