<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FinancialEvent extends Model
{
    protected $fillable = [
        'tenant_id', 'store_id', 'provider',
        'event_id', 'order_uuid', 'type',
        'has_transfer_impact', 'amount', 'currency',
        'occurred_at', 'raw',
    ];

    protected $casts = [
        'occurred_at' => 'datetime',
        'has_transfer_impact' => 'boolean',
        'raw' => 'array',
    ];
}
