<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Sale extends Model
{
    protected $fillable = [
        'tenant_id',
        'store_id',
        'sale_uuid',
        'short_id',
        'type',
        'category',
        'sales_channel',
        'current_status',
        'bag_value',
        'delivery_fee',
        'service_fee',
        'gross_value',
        'discount_value',
        'net_value',
        'payment_method',
        'payment_brand',
        'payment_value',
        'payment_liability',
        'sale_created_at',
        'concluded_at',
        'expected_payment_date',
        'raw',
    ];

    protected $casts = [
        'raw' => 'array',
        'sale_created_at' => 'datetime',
        'concluded_at' => 'datetime',
        'expected_payment_date' => 'date',
    ];

    public function store()
    {
        return $this->belongsTo(Store::class);
    }
}
