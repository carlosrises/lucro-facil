<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Crypt;

class OauthToken extends Model
{
    protected $fillable = [
        'tenant_id', 'store_id', 'provider',
        'username', 'encrypted_password',
        'access_token', 'refresh_token', 'expires_at', 'scopes'
    ];

    protected $casts = [
        'expires_at' => 'datetime',
        'scopes'     => 'array',
    ];

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }

    public function store()
    {
        return $this->belongsTo(Store::class);
    }

    /**
     * Criptografa e salva a senha
     */
    public function setPassword(string $password): void
    {
        $this->encrypted_password = Crypt::encryptString($password);
    }

    /**
     * Retorna a senha descriptografada
     */
    public function getPassword(): ?string
    {
        if (!$this->encrypted_password) {
            return null;
        }

        try {
            return Crypt::decryptString($this->encrypted_password);
        } catch (\Exception $e) {
            return null;
        }
    }

    /**
     * Verifica se possui credenciais salvas
     */
    public function hasCredentials(): bool
    {
        return !empty($this->username) && !empty($this->encrypted_password);
    }
}
