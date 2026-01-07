<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class FinanceCategory extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'parent_id', 'type', 'name',
    ];

    public function parent()
    {
        return $this->belongsTo(FinanceCategory::class, 'parent_id');
    }

    public function children()
    {
        return $this->hasMany(FinanceCategory::class, 'parent_id');
    }

    public function entries()
    {
        return $this->hasMany(FinanceEntry::class);
    }
}
