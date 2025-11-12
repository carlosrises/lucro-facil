<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductCost extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id',
        'internal_product_id',
        'ingredient_id',
        'qty',
    ];

    protected $casts = [
        'qty' => 'decimal:4',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(InternalProduct::class, 'internal_product_id');
    }

    public function ingredient(): BelongsTo
    {
        return $this->belongsTo(Ingredient::class);
    }
}
