<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Settlement extends Model
{
    protected $fillable = [
        'tenant_id', 'store_id', 'provider',
        'settlement_id', 'settlement_date', 'amount', 'raw',
    ];

    protected $casts = [
        'settlement_date' => 'date',
        'raw' => 'array',
    ];
}
