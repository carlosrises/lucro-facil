<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Subscription extends Model
{
    protected $fillable = [
        'tenant_id', 'plan_id', 'status',
        'started_on', 'ends_on', 'gateway_payload'
    ];

    protected $casts = [
        'started_on' => 'date',
        'ends_on'    => 'date',
        'gateway_payload' => 'array',
    ];

    public function plan()
    {
        return $this->belongsTo(Plan::class);
    }
}
