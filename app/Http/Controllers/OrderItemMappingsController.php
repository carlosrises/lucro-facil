<?php

namespace App\Http\Controllers;

use App\Models\OrderItem;
use App\Models\OrderItemMapping;
use App\Services\PizzaFractionService;
use Illuminate\Http\Request;

class OrderItemMappingsController extends Controller
{
    public function __construct(
        private PizzaFractionService $pizzaFractionService
    ) {
    }
    /**
     * Store multiple mappings for an order item
     */
    public function store(Request $request, OrderItem $orderItem)
    {
        // Verificar permissão de tenant
        if ($orderItem->tenant_id !== tenant_id()) {
            abort(403);
        }

        $validated = $request->validate([
            'mappings' => 'required|array',
            'mappings.*.internal_product_id' => 'required|exists:internal_products,id',
            'mappings.*.quantity' => 'required|numeric|min:0.0001|max:999',
            'mappings.*.mapping_type' => 'required|in:main,option,addon',
            'mappings.*.option_type' => 'nullable|in:pizza_flavor,regular,addon,observation,drink',
            'mappings.*.auto_fraction' => 'nullable|boolean',
            'mappings.*.notes' => 'nullable|string|max:1000',
            'mappings.*.external_reference' => 'nullable|string',
            'mappings.*.external_name' => 'nullable|string',
        ]);

        // Aplicar cálculo automático de frações antes de salvar
        $mappingsData = $this->pizzaFractionService->applyAutoFractions(
            $orderItem,
            $validated['mappings']
        );

        // Deletar associações antigas
        $orderItem->mappings()->delete();

        // Criar novas associações
        foreach ($mappingsData as $mapping) {
            OrderItemMapping::create([
                'tenant_id' => tenant_id(),
                'order_item_id' => $orderItem->id,
                'internal_product_id' => $mapping['internal_product_id'],
                'quantity' => $mapping['quantity'],
                'mapping_type' => $mapping['mapping_type'],
                'option_type' => $mapping['option_type'] ?? null,
                'auto_fraction' => $mapping['auto_fraction'] ?? false,
                'notes' => $mapping['notes'] ?? null,
                'external_reference' => $mapping['external_reference'] ?? null,
                'external_name' => $mapping['external_name'] ?? null,
            ]);
        }

        return back()->with('success', 'Associações atualizadas com sucesso!');
    }

    /**
     * Delete all mappings for an order item
     */
    public function destroy(OrderItem $orderItem)
    {
        // Verificar permissão de tenant
        if ($orderItem->tenant_id !== tenant_id()) {
            abort(403);
        }

        $orderItem->mappings()->delete();

        return back()->with('success', 'Associações removidas com sucesso!');
    }
}
