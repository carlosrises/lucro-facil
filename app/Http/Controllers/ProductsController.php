<?php

namespace App\Http\Controllers;

use App\Models\InternalProduct;
use App\Models\Ingredient;
use App\Models\ProductCost;
use App\Models\OrderItem;
use App\Models\ProductMapping;
use App\Models\TaxCategory;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\DB;

class ProductsController extends Controller
{
    public function index(Request $request)
    {
        $query = InternalProduct::query()
            ->where('tenant_id', tenant_id())
            ->with([
                'mappings' => function ($query) {
                    $query->select('id', 'internal_product_id', 'external_item_id', 'external_item_name', 'provider');
                },
                'taxCategory'
            ])
            ->withCount('costs')
            ->when($request->input('search'), fn ($q, $search) =>
                $q->where(function ($query) use ($search) {
                    $query->where('name', 'like', "%{$search}%")
                        ->orWhere('sku', 'like', "%{$search}%");
                })
            )
            ->when($request->input('type'), fn ($q, $type) =>
                $q->where('type', $type)
            )
            ->when($request->has('active'), fn ($q) =>
                $q->where('active', $request->boolean('active'))
            )
            ->orderBy('name');

        $perPage = (int) $request->input('per_page', 10);
        $products = $query->paginate($perPage)->withQueryString();

        // Buscar ingredients ativos para o formulário
        $ingredients = Ingredient::where('tenant_id', tenant_id())
            ->where('active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'unit', 'unit_price']);

        // Buscar categorias fiscais ativas
        $taxCategories = TaxCategory::where('tenant_id', tenant_id())
            ->where('active', true)
            ->orderBy('name')
            ->get();

        // Buscar itens externos (dos pedidos) para associação
        $tenantId = tenant_id();
        $externalItems = DB::table('order_items')
            ->join('orders', 'order_items.order_id', '=', 'orders.id')
            ->where('order_items.tenant_id', $tenantId)
            ->select(
                'order_items.sku',
                'order_items.name',
                DB::raw('MAX(order_items.unit_price) as unit_price'),
                DB::raw('MAX(orders.provider) as provider')
            )
            ->groupBy('order_items.sku', 'order_items.name')
            ->orderBy('order_items.name')
            ->get()
            ->map(function ($item) use ($tenantId) {
                // Verificar se já está mapeado
                $mapping = ProductMapping::where('tenant_id', $tenantId)
                    ->where('external_item_id', $item->sku)
                    ->exists();

                return [
                    'sku' => $item->sku,
                    'name' => $item->name,
                    'unit_price' => (float) $item->unit_price,
                    'provider' => $item->provider ?? 'ifood',
                    'mapped' => $mapping,
                ];
            });

        // Buscar configurações de margem do tenant
        $tenant = $request->user()->tenant;

        return Inertia::render('products', [
            'products' => $products,
            'ingredients' => $ingredients,
            'taxCategories' => $taxCategories,
            'externalItems' => $externalItems,
            'marginSettings' => [
                'margin_excellent' => (float) ($tenant->margin_excellent ?? 100.00),
                'margin_good_min' => (float) ($tenant->margin_good_min ?? 30.00),
                'margin_good_max' => (float) ($tenant->margin_good_max ?? 99.99),
                'margin_poor' => (float) ($tenant->margin_poor ?? 0.00),
            ],
            'filters' => [
                'search' => $request->input('search', ''),
                'type' => $request->input('type', ''),
                'active' => $request->input('active', ''),
                'per_page' => $perPage,
            ],
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'sku' => ['nullable', 'string', 'max:255', 'unique:internal_products,sku,NULL,id,tenant_id,' . tenant_id()],
            'type' => ['required', 'in:product,service'],
            'unit' => ['required', 'in:unit,kg,g,l,ml,hour'],
            'unit_cost' => ['required', 'numeric', 'min:0'],
            'sale_price' => ['required', 'numeric', 'min:0'],
            'tax_category_id' => ['nullable', 'exists:tax_categories,id'],
            'active' => ['boolean'],
            'recipe' => ['nullable', 'array'],
            'recipe.*.ingredient_id' => ['required', 'exists:ingredients,id'],
            'recipe.*.qty' => ['required', 'numeric', 'min:0'],
        ]);

        DB::beginTransaction();
        try {
            $product = InternalProduct::create([
                'tenant_id' => tenant_id(),
                'name' => $validated['name'],
                'sku' => $validated['sku'] ?? null,
                'type' => $validated['type'],
                'unit' => $validated['unit'],
                'unit_cost' => $validated['unit_cost'],
                'sale_price' => $validated['sale_price'],
                'tax_category_id' => $validated['tax_category_id'] ?? null,
                'active' => $validated['active'] ?? true,
            ]);

            // Se tiver receita, adicionar os ingredientes
            if (!empty($validated['recipe'])) {
                foreach ($validated['recipe'] as $item) {
                    ProductCost::create([
                        'tenant_id' => tenant_id(),
                        'internal_product_id' => $product->id,
                        'ingredient_id' => $item['ingredient_id'],
                        'qty' => $item['qty'],
                    ]);
                }

                // Recalcular o CMV e salvar
                $cmv = $product->calculateCMV();
                $product->update(['unit_cost' => $cmv]);
            }
            // Se não tiver receita, mantém o unit_cost cadastrado manualmente

            DB::commit();
            return redirect()->back()->with('success', 'Produto criado com sucesso!');
        } catch (\Exception $e) {
            DB::rollBack();
            return redirect()->back()->withErrors(['error' => 'Erro ao criar produto: ' . $e->getMessage()]);
        }
    }

    public function getData(InternalProduct $product)
    {
        if ($product->tenant_id !== tenant_id()) {
            abort(403);
        }

        $product->load(['costs.ingredient']);

        return response()->json($product);
    }

    public function show(InternalProduct $product)
    {
        if ($product->tenant_id !== tenant_id()) {
            abort(403);
        }

        $product->load(['costs.ingredient']);

        $ingredients = Ingredient::where('tenant_id', tenant_id())
            ->where('active', true)
            ->orderBy('name')
            ->get();

        $tenant = request()->user()->tenant;

        return Inertia::render('products/show', [
            'product' => $product,
            'ingredients' => $ingredients,
            'marginSettings' => [
                'margin_excellent' => (float) ($tenant->margin_excellent ?? 100.00),
                'margin_good_min' => (float) ($tenant->margin_good_min ?? 30.00),
                'margin_good_max' => (float) ($tenant->margin_good_max ?? 99.99),
                'margin_poor' => (float) ($tenant->margin_poor ?? 0.00),
            ],
        ]);
    }

    public function update(Request $request, InternalProduct $product)
    {
        if ($product->tenant_id !== tenant_id()) {
            abort(403);
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'sku' => ['nullable', 'string', 'max:255', 'unique:internal_products,sku,' . $product->id . ',id,tenant_id,' . tenant_id()],
            'type' => ['required', 'in:product,service'],
            'unit' => ['required', 'in:unit,kg,g,l,ml,hour'],
            'unit_cost' => ['required', 'numeric', 'min:0'],
            'sale_price' => ['required', 'numeric', 'min:0'],
            'tax_category_id' => ['nullable', 'exists:tax_categories,id'],
            'active' => ['boolean'],
            'recipe' => ['nullable', 'array'],
            'recipe.*.ingredient_id' => ['required_with:recipe', 'exists:ingredients,id'],
            'recipe.*.qty' => ['required_with:recipe', 'numeric', 'min:0'],
        ]);

        DB::beginTransaction();

        try {
            // Atualizar dados básicos do produto
            $product->update([
                'name' => $validated['name'],
                'sku' => $validated['sku'] ?? null,
                'type' => $validated['type'],
                'unit' => $validated['unit'],
                'unit_cost' => $validated['unit_cost'], // Sempre salva o valor manual
                'sale_price' => $validated['sale_price'],
                'tax_category_id' => $validated['tax_category_id'] ?? null,
                'active' => $validated['active'] ?? true,
            ]);

            // Se houver recipe, atualizar os custos (ficha técnica)
            if (isset($validated['recipe']) && is_array($validated['recipe']) && count($validated['recipe']) > 0) {
                // Remover custos existentes
                ProductCost::where('internal_product_id', $product->id)->delete();

                // Adicionar novos custos
                foreach ($validated['recipe'] as $item) {
                    $ingredient = Ingredient::findOrFail($item['ingredient_id']);
                    if ($ingredient->tenant_id !== tenant_id()) {
                        throw new \Exception('Ingrediente não pertence ao tenant');
                    }

                    ProductCost::create([
                        'tenant_id' => tenant_id(),
                        'internal_product_id' => $product->id,
                        'ingredient_id' => $item['ingredient_id'],
                        'qty' => $item['qty'],
                    ]);
                }

                // Recalcular CMV e sobrescrever unit_cost
                $cmv = $product->calculateCMV();
                $product->update(['unit_cost' => $cmv]);
            } else {
                // Se não há receita ou receita vazia, remove todos os custos
                // e mantém o unit_cost cadastrado manualmente
                ProductCost::where('internal_product_id', $product->id)->delete();
            }

            DB::commit();
            return redirect()->back()->with('success', 'Produto atualizado com sucesso!');
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    public function destroy(InternalProduct $product)
    {
        if ($product->tenant_id !== tenant_id()) {
            abort(403);
        }

        $product->delete();

        return redirect()->back()->with('success', 'Produto excluído com sucesso!');
    }

    public function addIngredient(Request $request, InternalProduct $product)
    {
        if ($product->tenant_id !== tenant_id()) {
            abort(403);
        }

        $validated = $request->validate([
            'ingredient_id' => ['required', 'exists:ingredients,id'],
            'qty' => ['required', 'numeric', 'min:0'],
        ]);

        // Verificar se ingrediente pertence ao mesmo tenant
        $ingredient = Ingredient::findOrFail($validated['ingredient_id']);
        if ($ingredient->tenant_id !== tenant_id()) {
            abort(403);
        }

        ProductCost::updateOrCreate(
            [
                'internal_product_id' => $product->id,
                'ingredient_id' => $validated['ingredient_id'],
            ],
            [
                'tenant_id' => tenant_id(),
                'qty' => $validated['qty'],
            ]
        );

        // Atualizar custo unitário do produto com base no CMV
        $cmv = $product->calculateCMV();
        $product->update(['unit_cost' => $cmv]);

        return redirect()->back()->with('success', 'Ingrediente adicionado à ficha técnica!');
    }

    public function removeIngredient(InternalProduct $product, Ingredient $ingredient)
    {
        if ($product->tenant_id !== tenant_id()) {
            abort(403);
        }

        ProductCost::where('internal_product_id', $product->id)
            ->where('ingredient_id', $ingredient->id)
            ->delete();

        // Atualizar custo unitário do produto
        $cmv = $product->calculateCMV();
        $product->update(['unit_cost' => $cmv]);

        return redirect()->back()->with('success', 'Ingrediente removido da ficha técnica!');
    }

    public function toggle(InternalProduct $product)
    {
        if ($product->tenant_id !== tenant_id()) {
            abort(403);
        }

        $product->update(['active' => !$product->active]);

        return redirect()->back();
    }
}
