<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class Order extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'store_id', 'order_uuid', 'provider',
        'status', 'code', 'short_reference', 'origin',
        'gross_total', 'discount_total', 'delivery_fee',
        'tip', 'net_total', 'placed_at', 'raw',
        'calculated_costs', 'payment_fee_links', 'total_costs', 'total_commissions',
        'net_revenue', 'costs_calculated_at',
    ];

    protected $casts = [
        'placed_at' => 'datetime',
        'raw' => 'array',
        'calculated_costs' => 'array',
        'payment_fee_links' => 'array',
        'total_costs' => 'decimal:2',
        'total_commissions' => 'decimal:2',
        'net_revenue' => 'decimal:2',
        'costs_calculated_at' => 'datetime',
    ];

    /**
     * Preparar datas para serialização (converter para timezone da aplicação)
     */
    protected function serializeDate(\DateTimeInterface $date): string
    {
        return $date->setTimezone(config('app.timezone'))->format('Y-m-d\TH:i:s.u\Z');
    }

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

    public function sale()
    {
        return $this->hasOne(Sale::class, 'sale_uuid', 'order_uuid');
    }
}
