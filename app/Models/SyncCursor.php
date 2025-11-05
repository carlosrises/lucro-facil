<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SyncCursor extends Model
{
    protected $fillable = [
        'tenant_id', 'store_id', 'module', 'cursor_key', 'last_synced_at'
    ];

    protected $casts = [
        'last_synced_at' => 'datetime',
    ];
}
