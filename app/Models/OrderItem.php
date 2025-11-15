<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OrderItem extends Model
{
    protected $fillable = [
        'tenant_id', 'order_id', 'sku', 'name',
        'qty', 'unit_price', 'total', 'add_ons'
    ];

    protected $casts = [
        'add_ons' => 'array',
    ];

    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    public function internalProduct()
    {
        return $this->hasOneThrough(
            InternalProduct::class,
            ProductMapping::class,
            'external_item_id', // Foreign key on product_mappings table
            'id', // Foreign key on internal_products table
            'sku', // Local key on order_items table
            'internal_product_id' // Local key on product_mappings table
        );
    }
}
