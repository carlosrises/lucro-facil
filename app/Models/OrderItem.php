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
}
