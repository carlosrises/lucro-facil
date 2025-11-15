<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TaxCategory extends Model
{
    protected $fillable = [
        'tenant_id',
        'name',
        'sale_cfop',
        'description',
        'icms_origin',
        'csosn_cst',
        'ncm',
        'tax_calculation_type',
        'iss_rate',
        'icms_rate',
        'pis_rate',
        'cofins_rate',
        'pis_cofins_mode',
        'icms_st',
        'fixed_tax_rate',
        'active',
    ];

    protected $casts = [
        'icms_st' => 'boolean',
        'active' => 'boolean',
        'iss_rate' => 'decimal:2',
        'icms_rate' => 'decimal:2',
        'pis_rate' => 'decimal:2',
        'cofins_rate' => 'decimal:2',
        'fixed_tax_rate' => 'decimal:2',
    ];

    protected $appends = [
        'total_tax_rate',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    // Scope para buscar apenas categorias ativas
    public function scopeActive($query)
    {
        return $query->where('active', true);
    }

    // Scope para filtrar por tenant
    public function scopeForTenant($query, $tenantId)
    {
        return $query->where('tenant_id', $tenantId);
    }

    // Calcula o total de impostos baseado no tipo
    public function getTotalTaxRateAttribute(): float
    {
        return match ($this->tax_calculation_type) {
            'detailed' => (float) ($this->iss_rate + $this->icms_rate + $this->pis_rate + $this->cofins_rate),
            'fixed' => (float) $this->fixed_tax_rate,
            'none' => 0.0,
            default => 0.0,
        };
    }
}
