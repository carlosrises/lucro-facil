<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PaymentFlagRule extends Model
{
    protected $fillable = [
        'tenant_id', 'flag', 'fee_percent', 'fee_fixed'
    ];
}
