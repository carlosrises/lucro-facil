<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Ingredient extends Model
{
    protected $fillable = [
        'tenant_id', 'name', 'unit', 'unit_cost', 'active'
    ];
}
