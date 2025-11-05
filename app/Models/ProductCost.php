<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProductCost extends Model
{
    protected $fillable = [
        'tenant_id', 'internal_product_id', 'ingredient_id', 'qty'
    ];
}
