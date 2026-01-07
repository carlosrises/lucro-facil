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

    /**
     * Verifica se o token OAuth está expirado ou não existe
     */
    public function hasExpiredToken(): bool
    {
        if (! $this->oauthToken) {
            return true;
        }

        if (! $this->oauthToken->expires_at) {
            return false;
        }

        return $this->oauthToken->expires_at->isPast();
    }

    /**
     * Verifica se o token OAuth está próximo de expirar (menos de 48h)
     */
    public function hasTokenExpiringSoon(): bool
    {
        if (! $this->oauthToken || ! $this->oauthToken->expires_at) {
            return false;
        }

        return $this->oauthToken->expires_at->diffInHours(now()) < 48;
    }
}
