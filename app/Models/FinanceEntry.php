<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class FinanceEntry extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id',
        'finance_category_id',
        'occurred_on',
        'amount',
        'reference',
        'notes',
        'recurrence_type',
        'recurrence_end_date',
        'supplier',
        'due_date',
        'payment_method',
        'financial_account',
        'competence_date',
        'status',
        'paid_at',
        'is_recurring',
        'parent_entry_id',
        'installment_number',
    ];

    protected $casts = [
        'occurred_on' => 'date',
        'due_date' => 'date',
        'recurrence_end_date' => 'date',
        'competence_date' => 'date',
        'paid_at' => 'datetime',
        'is_recurring' => 'boolean',
    ];

    public function category(): BelongsTo
    {
        return $this->belongsTo(FinanceCategory::class, 'finance_category_id');
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(FinanceEntry::class, 'parent_entry_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(FinanceEntry::class, 'parent_entry_id');
    }

    /**
     * Scope para filtrar apenas templates recorrentes
     */
    public function scopeTemplates(Builder $query): Builder
    {
        return $query->where('is_recurring', true)
            ->whereNull('parent_entry_id');
    }

    /**
     * Scope para filtrar apenas parcelas (não templates)
     */
    public function scopeInstallments(Builder $query): Builder
    {
        return $query->whereNotNull('parent_entry_id');
    }

    /**
     * Scope para excluir templates da listagem
     */
    public function scopeWithoutTemplates(Builder $query): Builder
    {
        return $query->where(function ($q) {
            $q->where('is_recurring', false)
                ->orWhereNotNull('parent_entry_id');
        });
    }
}
