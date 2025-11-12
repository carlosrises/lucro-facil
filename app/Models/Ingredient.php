<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Ingredient extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id',
        'category_id',
        'name',
        'unit',
        'unit_price',
        'current_stock',
        'ideal_stock',
        'active',
    ];

    protected $casts = [
        'unit_price' => 'decimal:4',
        'current_stock' => 'decimal:3',
        'ideal_stock' => 'decimal:3',
        'active' => 'boolean',
    ];

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function products(): BelongsToMany
    {
        return $this->belongsToMany(InternalProduct::class, 'product_costs')
            ->withPivot(['qty'])
            ->withTimestamps();
    }
}
