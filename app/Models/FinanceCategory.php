<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FinanceCategory extends Model
{
    protected $fillable = [
        'tenant_id', 'type', 'name'
    ];

    public function entries()
    {
        return $this->hasMany(FinanceEntry::class);
    }
}
