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
        'is_visible', 'is_contact_plan', 'contact_url',
        'is_featured', 'display_order',
    ];

    protected $appends = ['price'];

    protected $casts = [
        'features' => 'array',
        'active' => 'boolean',
        'reports_advanced' => 'boolean',
        'is_visible' => 'boolean',
        'is_contact_plan' => 'boolean',
        'is_featured' => 'boolean',
        'display_order' => 'integer',
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

    public function prices(): HasMany
    {
        return $this->hasMany(PlanPrice::class);
    }
}
