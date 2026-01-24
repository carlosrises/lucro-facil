<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class PaymentMethodMapping extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id',
        'external_payment_method_id',
        'payment_method_name',
        'payment_method_keyword',
        'cost_commission_id',
        'has_no_fee',
        'payment_category',
        'provider',
        'recalculating_since',
    ];

    protected $casts = [
        'has_no_fee' => 'boolean',
        'recalculating_since' => 'datetime',
    ];

    /**
     * Relação com CostCommission (taxa vinculada)
     */
    public function costCommission()
    {
        return $this->belongsTo(CostCommission::class);
    }

    /**
     * Relação com Tenant
     */
    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }
}
