<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class Store extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'provider', 'external_store_id', 'display_name', 'active', 'excluded_channels',
    ];

    protected $casts = [
        'excluded_channels' => 'array',
    ];

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }

    public function tokens()
    {
        return $this->hasMany(OauthToken::class);
    }

    public function oauthToken()
    {
        return $this->hasOne(OauthToken::class)->latestOfMany();
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
