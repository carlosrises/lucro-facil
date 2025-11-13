<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Tenant extends Model
{
    protected $fillable = [
        'uuid', 'name', 'document', 'email', 'phone',
        'margin_excellent', 'margin_good_min', 'margin_good_max', 'margin_poor'
    ];

    protected $casts = [
        'margin_excellent' => 'decimal:2',
        'margin_good_min' => 'decimal:2',
        'margin_good_max' => 'decimal:2',
        'margin_poor' => 'decimal:2',
    ];

    public function stores()
    {
        return $this->hasMany(Store::class);
    }

    public function subscriptions()
    {
        return $this->hasMany(Subscription::class);
    }

    public function users()
    {
        return $this->hasMany(User::class);
    }
}
