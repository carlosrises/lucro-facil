<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Category extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id',
        'name',
        'type',
        'color',
        'active',
    ];

    protected $casts = [
        'active' => 'boolean',
    ];

    public function ingredients(): HasMany
    {
        return $this->hasMany(Ingredient::class);
    }
}
