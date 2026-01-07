<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class CostCommission extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id',
        'provider',
        'name',
        'category',
        'type',
        'value',
        'applies_to',
        'delivery_by',
        'payment_type',
        'condition_value',
        'condition_values',
        'affects_revenue_base',
        'enters_tax_base',
        'reduces_revenue_base',
        'active',
    ];

    protected $casts = [
        'value' => 'decimal:2',
        'condition_values' => 'array',
        'affects_revenue_base' => 'boolean',
        'enters_tax_base' => 'boolean',
        'reduces_revenue_base' => 'boolean',
        'active' => 'boolean',
    ];

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }

    /**
     * Scope para filtrar apenas registros ativos
     */
    public function scopeActive($query)
    {
        return $query->where('active', true);
    }

    /**
     * Scope para filtrar por provider ou origin (para pedidos Takeat)
     */
    public function scopeForProvider($query, ?string $provider, ?string $origin = null)
    {
        return $query->where(function ($q) use ($provider, $origin) {
            $q->whereNull('provider')
                ->orWhere('provider', $provider);

            // Se for pedido Takeat com origin, verificar também provider "takeat-{origin}"
            // Ex: provider='takeat' + origin='ifood' também pega regras com provider='takeat-ifood'
            if ($provider === 'takeat' && $origin) {
                $q->orWhere('provider', $origin)
                    ->orWhere('provider', "takeat-{$origin}");
            }
        });
    }

    /**
     * Scope para filtrar por contexto de aplicação
     */
    public function scopeForContext($query, string $appliesTo, ?string $conditionValue = null)
    {
        $query->where('applies_to', $appliesTo);

        if ($conditionValue) {
            $query->where('condition_value', $conditionValue);
        }

        return $query;
    }

    /**
     * Formata o valor de acordo com o tipo
     */
    public function getFormattedValueAttribute(): string
    {
        if ($this->type === 'percentage') {
            return number_format($this->value, 2, ',', '.').'%';
        }

        return 'R$ '.number_format($this->value, 2, ',', '.');
    }
}
