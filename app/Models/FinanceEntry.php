<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FinanceEntry extends Model
{
    protected $fillable = [
        'tenant_id', 'finance_category_id', 'occurred_on',
        'amount', 'reference', 'notes'
    ];

    protected $casts = [
        'occurred_on' => 'date',
    ];
}
