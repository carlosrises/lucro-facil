<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Plan extends Model
{
    protected $fillable = [
        'code', 'name', 'description', 'price_month',
        'max_stores', 'retention_days', 'reports_advanced', 'features',
        'stripe_product_id', 'stripe_price_id', 'active',
    ];

    protected $appends = ['price'];

    protected $casts = [
        'features' => 'array',
        'active' => 'boolean',
        'reports_advanced' => 'boolean',
    ];

    // Accessor para compatibilidade com frontend
    public function getPriceAttribute()
    {
        return $this->price_month;
    }

    public function subscriptions(): HasMany
    {
        return $this->hasMany(Subscription::class);
    }
}
