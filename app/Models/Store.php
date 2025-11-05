<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Store extends Model
{
    protected $fillable = [
        'tenant_id', 'provider', 'external_store_id', 'display_name', 'active'
    ];

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }

    public function tokens()
    {
        return $this->hasMany(OauthToken::class);
    }

    public function cursors()
    {
        return $this->hasMany(SyncCursor::class);
    }

    public function orders()
    {
        return $this->hasMany(Order::class);
    }
}
