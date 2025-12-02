<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Models\Concerns\BelongsToTenant;

class FinanceCategory extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'parent_id', 'type', 'name'
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
