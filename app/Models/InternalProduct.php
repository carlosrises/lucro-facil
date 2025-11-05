<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class InternalProduct extends Model
{
    protected $fillable = [
        'tenant_id', 'sku', 'name', 'category',
        'default_margin_percent', 'default_margin_value', 'active'
    ];

    public function costs()
    {
        return $this->hasMany(ProductCost::class);
    }

    public function mappings()
    {
        return $this->hasMany(ProductMapping::class);
    }
}
