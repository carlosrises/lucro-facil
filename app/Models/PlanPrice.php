<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PlanPrice extends Model
{
    protected $fillable = [
        'plan_id',
        'key',
        'label',
        'amount',
        'interval',
        'period_label',
        'is_annual',
        'stripe_price_id',
        'active',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'is_annual' => 'boolean',
        'active' => 'boolean',
    ];

    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class);
    }
}
