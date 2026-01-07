<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Ticket extends Model
{
    protected $fillable = [
        'tenant_id', 'user_id', 'subject', 'priority', 'status',
    ];

    public function messages()
    {
        return $this->hasMany(TicketMessage::class);
    }
}
