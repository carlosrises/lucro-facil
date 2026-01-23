<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class OrderItem extends Model
{
    protected $fillable = [
        'tenant_id', 'order_id', 'sku', 'name',
        'qty', 'unit_price', 'total', 'add_ons',
    ];

    protected $casts = [
        'add_ons' => 'array',
    ];

    protected $appends = [
        'total_cost', // Adicionar custo calculado aos atributos serializados
        'add_ons_product_mappings', // ProductMappings dos add-ons para classificação
    ];

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    /**
     * Relacionamento legado (backward compatibility)
     * Retorna o primeiro produto associado via ProductMapping
     */
    public function internalProduct()
    {
        return $this->hasOneThrough(
            InternalProduct::class,
            ProductMapping::class,
            'external_item_id', // Foreign key on product_mappings table
            'id', // Foreign key on internal_products table
            'sku', // Local key on order_items table
            'internal_product_id' // Local key on product_mappings table
        );
    }

    /**
     * Relacionamento com ProductMapping para obter item_type
     */
    public function productMapping()
    {
        return $this->hasOne(ProductMapping::class, 'external_item_id', 'sku');
    }

    /**
     * Novo sistema de múltiplas associações
     */
    public function mappings(): HasMany
    {
        return $this->hasMany(OrderItemMapping::class);
    }

    /**
     * Calcular custo total do item considerando item principal + add-ons (sabores)
     * Lógica idêntica ao frontend para garantir consistência
     */
    public function calculateTotalCost(): float
    {
        $itemQuantity = $this->qty ?? $this->quantity ?? 1;
        $totalCost = 0;

        // 1. Custo do item principal via OrderItemMapping
        $mainMappings = $this->mappings()->where('mapping_type', 'main')->get();
        foreach ($mainMappings as $mapping) {
            $totalCost += $mapping->calculateCost();
        }

        // 2. Custo dos add-ons via OrderItemMapping (todos os tipos: flavors, beverages, complements, etc)
        $addonMappings = $this->mappings()->where('mapping_type', 'addon')->get();
        foreach ($addonMappings as $mapping) {
            $totalCost += $mapping->calculateCost();
        }

        // FALLBACK LEGADO: Se não tem mappings, usar cálculo antigo por ProductMapping
        if ($totalCost == 0 && $this->add_ons && is_array($this->add_ons)) {
            // Detectar tamanho da pizza
            $pizzaSize = $this->detectPizzaSize($this->name);

            // Contar sabores classificados
            $classifiedFlavors = [];
            foreach ($this->add_ons as $index => $addOn) {
                $addOnName = $addOn['name'] ?? '';
                if (! $addOnName) {
                    continue;
                }

                $addOnSku = 'addon_'.md5($addOnName);
                $productMapping = ProductMapping::where('tenant_id', $this->tenant_id)
                    ->where('external_item_id', $addOnSku)
                    ->where('item_type', 'flavor')
                    ->first();

                if ($productMapping && $productMapping->internalProduct) {
                    $classifiedFlavors[] = [
                        'product' => $productMapping->internalProduct,
                        'quantity' => $addOn['quantity'] ?? $addOn['qty'] ?? 1,
                    ];
                }
            }

            // Calcular custo dos sabores
            $totalFlavors = count($classifiedFlavors);
            if ($totalFlavors > 0) {
                $fraction = 1.0 / $totalFlavors;

                foreach ($classifiedFlavors as $flavor) {
                    $product = $flavor['product'];
                    $addOnQty = $flavor['quantity'];

                    // Calcular CMV dinamicamente pelo tamanho detectado
                    $unitCost = $pizzaSize
                        ? $product->calculateCMV($pizzaSize)
                        : (float) $product->unit_cost;

                    $totalCost += $unitCost * $fraction * $addOnQty;
                }
            }
        }

        // FALLBACK FINAL: sistema legado (ProductMapping direto no item principal)
        if ($totalCost == 0 && $this->internalProduct && $this->internalProduct->unit_cost) {
            $unitCost = (float) $this->internalProduct->unit_cost;
            $totalCost = $unitCost;
        }

        return $totalCost * $itemQuantity;
    }

    /**
     * Detectar tamanho da pizza pelo nome do item
     */
    private function detectPizzaSize(string $itemName): ?string
    {
        $itemNameLower = mb_strtolower($itemName);

        if (preg_match('/\bbroto\b/', $itemNameLower)) {
            return 'broto';
        }
        if (preg_match('/\bgrande\b/', $itemNameLower)) {
            return 'grande';
        }
        if (preg_match('/\b(familia|big|don|70x35)\b/', $itemNameLower)) {
            return 'familia';
        }
        if (preg_match('/\b(media|média|m\b)/', $itemNameLower)) {
            return 'media';
        }

        return null;
    }

    /**
     * Accessor para retornar o custo total calculado
     */
    public function getTotalCostAttribute(): float
    {
        return $this->calculateTotalCost();
    }

    /**
     * Accessor para retornar os ProductMappings de cada add-on
     * Retorna array indexado por posição do add-on
     */
    public function getAddOnsProductMappingsAttribute(): array
    {
        if (! $this->add_ons || ! is_array($this->add_ons)) {
            return [];
        }

        $mappings = [];
        foreach ($this->add_ons as $index => $addOn) {
            $addOnName = $addOn['name'] ?? '';
            if (! $addOnName) {
                $mappings[$index] = null;

                continue;
            }

            $addOnSku = 'addon_'.md5($addOnName);
            $productMapping = ProductMapping::where('tenant_id', $this->tenant_id)
                ->where('external_item_id', $addOnSku)
                ->with('internalProduct:id,name,unit_cost')
                ->first();

            $mappings[$index] = $productMapping;
        }

        return $mappings;
    }
}
