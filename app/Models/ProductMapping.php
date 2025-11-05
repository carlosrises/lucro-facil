<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProductMapping extends Model
{
    protected $fillable = [
        'tenant_id', 'internal_product_id', 'provider',
        'external_item_id', 'external_item_name'
    ];
}
