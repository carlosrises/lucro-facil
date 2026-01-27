<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Subscription extends Model
{
    protected $fillable = [
        'tenant_id', 'plan_id', 'status',
        'started_on', 'ends_on', 'gateway_payload',
        'stripe_customer_id', 'stripe_subscription_id', 'stripe_payment_method', 'trial_ends_at',
    ];

    protected $casts = [
        'started_on' => 'date',
        'ends_on' => 'date',
        'trial_ends_at' => 'datetime',
        'gateway_payload' => 'array',
    ];

    public function plan()
    {
        return $this->belongsTo(Plan::class);
    }
}
