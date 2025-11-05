<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;

use Illuminate\Database\Eloquent\Model;

class Order extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'store_id', 'order_uuid', 'provider',
        'status', 'code', 'origin',
        'gross_total', 'discount_total', 'delivery_fee',
        'tip', 'net_total', 'placed_at', 'raw'
    ];

    protected $casts = [
        'placed_at' => 'datetime',
        'raw'       => 'array',
    ];

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }

    public function store()
    {
        return $this->belongsTo(Store::class);
    }

    public function items()
    {
        return $this->hasMany(OrderItem::class);
    }
}
