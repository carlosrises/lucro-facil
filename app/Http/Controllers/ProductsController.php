<?php

namespace App\Http\Controllers;

use App\Models\Ingredient;
use App\Models\InternalProduct;
use App\Models\ProductCost;
use App\Models\ProductMapping;
use App\Models\TaxCategory;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class ProductsController extends Controller
{
    public function apiList(Request $request)
    {
        $products = InternalProduct::query()
            ->where('tenant_id', tenant_id())
            ->where('active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'type', 'unit', 'unit_cost', 'sale_price']);

        return response()->json($products);
    }

    public function index(Request $request)
    {
        $query = InternalProduct::query()
            ->where('tenant_id', tenant_id())
            ->with([
                'mappings' => function ($query) {
                    $query->select('id', 'internal_product_id', 'external_item_id', 'external_item_name', 'provider');
                },
                'taxCategory',
            ])
            ->withCount('costs')
            ->when($request->input('search'), fn ($q, $search) => $q->where(function ($query) use ($search) {
                $query->where('name', 'like', "%{$search}%")
                    ->orWhere('sku', 'like', "%{$search}%");
            })
            )
            ->when($request->input('type'), fn ($q, $type) => $q->where('type', $type)
            )
            ->when($request->has('active'), fn ($q) => $q->where('active', $request->boolean('active'))
            )
            ->orderBy('name');

        $perPage = max(10, min(100, (int) $request->input('per_page', 10)));
        $products = $query->paginate($perPage)
            ->appends($request->except('page'))
            ->withQueryString();

        // Buscar ingredients ativos para o formulário
        $rawIngredients = Ingredient::where('tenant_id', tenant_id())
            ->where('active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'unit', 'unit_price']);

        // Buscar produtos internos que podem ser usados como insumos
        $productsAsIngredients = InternalProduct::where('tenant_id', tenant_id())
            ->where('active', true)
            ->where('is_ingredient', true)
            ->orderBy('name')
            ->get(['id', 'name', 'unit', 'unit_cost'])
            ->map(function ($product) {
                return [
                    'id' => 'product_'.$product->id,
                    'name' => $product->name.' (Produto)',
                    'unit' => $product->unit,
                    'unit_price' => $product->unit_cost,
                ];
            });

        // Combinar ingredientes e produtos como insumos
        $ingredients = $rawIngredients->concat($productsAsIngredients);

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
                'margin_excellent' => (float) ($tenant->margin_excellent ?? 30.00),
                'margin_good_min' => (float) ($tenant->margin_good_min ?? 21.00),
                'margin_good_max' => (float) ($tenant->margin_good_max ?? 29.00),
                'margin_poor' => (float) ($tenant->margin_poor ?? 20.00),
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
            'sku' => ['nullable', 'string', 'max:255', 'unique:internal_products,sku,NULL,id,tenant_id,'.tenant_id()],
            'type' => ['required', 'in:product,service'],
            'product_category' => ['nullable', 'string', 'in:pizza,sabor_pizza,bebida,sobremesa,entrada,outro'],
            'max_flavors' => ['nullable', 'integer', 'min:1', 'max:10'],
            'size' => ['nullable', 'string', 'in:broto,media,grande,familia'],
            'unit' => ['required', 'in:unit,kg,g,l,ml,hour'],
            'unit_cost' => ['required', 'numeric', 'min:0'],
            'sale_price' => ['nullable', 'numeric', 'min:0'],
            'tax_category_id' => ['nullable', 'exists:tax_categories,id'],
            'active' => ['boolean'],
            'is_ingredient' => ['boolean'],
            'recipe' => ['nullable', 'array'],
            'recipe.*.ingredient_id' => ['required', function ($attribute, $value, $fail) {
                // Aceitar IDs de ingredientes normais
                $ingredientExists = Ingredient::where('tenant_id', tenant_id())
                    ->where('id', $value)
                    ->exists();

                // Aceitar IDs de produtos internos marcados como insumos
                $productAsIngredientExists = InternalProduct::where('tenant_id', tenant_id())
                    ->where('id', $value)
                    ->where('is_ingredient', true)
                    ->exists();

                if (! $ingredientExists && ! $productAsIngredientExists) {
                    $fail('O insumo selecionado é inválido.');
                }
            }],
            'recipe.*.qty' => ['required', 'numeric', 'min:0'],
            'recipe.*.size' => ['nullable', 'string', 'in:broto,media,grande,familia'],
        ]);

        DB::beginTransaction();
        try {
            $product = InternalProduct::create([
                'tenant_id' => tenant_id(),
                'name' => $validated['name'],
                'sku' => $validated['sku'] ?? null,
                'type' => $validated['type'],
                'product_category' => $validated['product_category'] ?? null,
                'max_flavors' => $validated['max_flavors'] ?? null,
                'size' => $validated['size'] ?? null,
                'unit' => $validated['unit'],
                'unit_cost' => $validated['unit_cost'],
                'sale_price' => $validated['sale_price'] ?? 0,
                'tax_category_id' => $validated['tax_category_id'] ?? null,
                'active' => $validated['active'] ?? true,
                'is_ingredient' => $validated['is_ingredient'] ?? false,
            ]);

            // Se tiver receita, adicionar os ingredientes
            if (! empty($validated['recipe'])) {
                foreach ($validated['recipe'] as $item) {
                    ProductCost::create([
                        'tenant_id' => tenant_id(),
                        'internal_product_id' => $product->id,
                        'ingredient_id' => $item['ingredient_id'],
                        'qty' => $item['qty'],
                        'size' => $item['size'] ?? null,
                    ]);
                }

                // Recalcular o CMV e salvar
                $cmv = $product->calculateCMV();
                $product->update(['unit_cost' => $cmv]);
            }
            // Se não tiver receita, mantém o unit_cost cadastrado manualmente

            DB::commit();

            // Se for requisição JSON/AJAX, retornar JSON
            if (request()->wantsJson() || request()->ajax()) {
                return response()->json([
                    'success' => true,
                    'message' => 'Produto criado com sucesso!',
                    'product' => $product->fresh(['costs']),
                ]);
            }

            return back()->with([
                'success' => 'Produto criado com sucesso!',
                'product' => $product->fresh(['costs']),
            ]);
        } catch (\Exception $e) {
            DB::rollBack();

            if (request()->wantsJson() || request()->ajax()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Erro ao criar produto: '.$e->getMessage(),
                ], 500);
            }

            return redirect()->back()->withErrors(['error' => 'Erro ao criar produto: '.$e->getMessage()]);
        }
    }

    public function getData(InternalProduct $product)
    {
        if ($product->tenant_id !== tenant_id()) {
            abort(403);
        }

        // Carregar custos sem o relacionamento ingredient
        $product->load('costs');

        // Para cada custo, buscar o ingrediente ou produto interno
        foreach ($product->costs as $cost) {
            // Tentar buscar como ingrediente primeiro
            $ingredient = Ingredient::where('tenant_id', tenant_id())
                ->where('id', $cost->ingredient_id)
                ->first();

            if ($ingredient) {
                $cost->ingredient = $ingredient;
            } else {
                // Se não for ingrediente, buscar como produto interno
                $productAsIngredient = InternalProduct::where('tenant_id', tenant_id())
                    ->where('id', $cost->ingredient_id)
                    ->first();

                if ($productAsIngredient) {
                    // Converter para formato compatível com ingredient
                    $cost->ingredient = (object) [
                        'id' => $productAsIngredient->id,
                        'name' => $productAsIngredient->name,
                        'unit' => $productAsIngredient->unit,
                        'unit_price' => $productAsIngredient->unit_cost,
                    ];
                }
            }
        }

        // Se for sabor de pizza, adicionar CMVs por tamanho
        if ($product->product_category === 'sabor_pizza') {
            $product->cmv_by_size = [
                'broto' => $product->calculateCMV('broto'),
                'media' => $product->calculateCMV('media'),
                'grande' => $product->calculateCMV('grande'),
                'familia' => $product->calculateCMV('familia'),
            ];
        }

        return response()->json($product);
    }

    public function show(InternalProduct $product)
    {
        if ($product->tenant_id !== tenant_id()) {
            abort(403);
        }

        $product->load(['costs.ingredient']);

        $rawIngredients = Ingredient::where('tenant_id', tenant_id())
            ->where('active', true)
            ->orderBy('name')
            ->get();

        // Buscar produtos internos que podem ser usados como insumos
        $productsAsIngredients = InternalProduct::where('tenant_id', tenant_id())
            ->where('active', true)
            ->where('is_ingredient', true)
            ->orderBy('name')
            ->get(['id', 'name', 'unit', 'unit_cost as unit_price']);

        // Combinar ingredientes e produtos como insumos
        $ingredients = $rawIngredients->concat($productsAsIngredients);

        $tenant = request()->user()->tenant;

        return Inertia::render('products/show', [
            'product' => $product,
            'ingredients' => $ingredients,
            'marginSettings' => [
                'margin_excellent' => (float) ($tenant->margin_excellent ?? 30.00),
                'margin_good_min' => (float) ($tenant->margin_good_min ?? 21.00),
                'margin_good_max' => (float) ($tenant->margin_good_max ?? 29.00),
                'margin_poor' => (float) ($tenant->margin_poor ?? 20.00),
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
            'sku' => ['nullable', 'string', 'max:255', 'unique:internal_products,sku,'.$product->id.',id,tenant_id,'.tenant_id()],
            'type' => ['required', 'in:product,service'],
            'product_category' => ['nullable', 'string', 'in:pizza,sabor_pizza,bebida,sobremesa,entrada,outro'],
            'max_flavors' => ['nullable', 'integer', 'min:1', 'max:10'],
            'size' => ['nullable', 'string', 'in:broto,media,grande,familia'],
            'unit' => ['required', 'in:unit,kg,g,l,ml,hour'],
            'unit_cost' => ['required', 'numeric', 'min:0'],
            'sale_price' => ['nullable', 'numeric', 'min:0'],
            'tax_category_id' => ['nullable', 'exists:tax_categories,id'],
            'active' => ['boolean'],
            'is_ingredient' => ['boolean'],
            'recipe' => ['nullable', 'array'],
            'recipe.*.ingredient_id' => ['required_with:recipe', function ($attribute, $value, $fail) {
                // Aceitar IDs de ingredientes normais
                $ingredientExists = Ingredient::where('tenant_id', tenant_id())
                    ->where('id', $value)
                    ->exists();

                // Aceitar IDs de produtos internos marcados como insumos
                $productAsIngredientExists = InternalProduct::where('tenant_id', tenant_id())
                    ->where('id', $value)
                    ->where('is_ingredient', true)
                    ->exists();

                if (! $ingredientExists && ! $productAsIngredientExists) {
                    $fail('O insumo selecionado é inválido.');
                }
            }],
            'recipe.*.qty' => ['required_with:recipe', 'numeric', 'min:0'],
            'recipe.*.size' => ['nullable', 'string', 'in:broto,media,grande,familia'],
            'update_existing_orders' => ['boolean'],
        ]);

        DB::beginTransaction();

        try {
            $oldUnitCost = $product->unit_cost;

            // Atualizar dados básicos do produto
            $product->update([
                'name' => $validated['name'],
                'sku' => $validated['sku'] ?? null,
                'type' => $validated['type'],
                'product_category' => $validated['product_category'] ?? null,
                'max_flavors' => $validated['max_flavors'] ?? null,
                'size' => $validated['size'] ?? null,
                'unit' => $validated['unit'],
                'unit_cost' => $validated['unit_cost'], // Sempre salva o valor manual
                'sale_price' => $validated['sale_price'] ?? 0,
                'tax_category_id' => $validated['tax_category_id'] ?? null,
                'active' => $validated['active'] ?? true,
                'is_ingredient' => $validated['is_ingredient'] ?? false,
            ]);

            // Se houver recipe, atualizar os custos (ficha técnica)
            if (isset($validated['recipe']) && is_array($validated['recipe']) && count($validated['recipe']) > 0) {
                // Remover custos existentes
                ProductCost::where('internal_product_id', $product->id)->delete();

                // Adicionar novos custos
                foreach ($validated['recipe'] as $item) {
                    // Verificar se é ingrediente ou produto interno
                    $isIngredient = Ingredient::where('tenant_id', tenant_id())
                        ->where('id', $item['ingredient_id'])
                        ->exists();

                    $isProductAsIngredient = InternalProduct::where('tenant_id', tenant_id())
                        ->where('id', $item['ingredient_id'])
                        ->where('is_ingredient', true)
                        ->exists();

                    if (! $isIngredient && ! $isProductAsIngredient) {
                        throw new \Exception('Insumo não encontrado ou não pertence ao tenant');
                    }

                    ProductCost::create([
                        'tenant_id' => tenant_id(),
                        'internal_product_id' => $product->id,
                        'ingredient_id' => $item['ingredient_id'],
                        'qty' => $item['qty'],
                        'size' => $item['size'] ?? null,
                    ]);
                }

                // Recalcular CMV e sobrescrever unit_cost
                $cmv = $product->calculateCMV();
                $product->update(['unit_cost' => $cmv]);

                // Atualizar $product com os novos valores do banco
                $product->refresh();
            } else {
                // Se não há receita ou receita vazia, remove todos os custos
                // e mantém o unit_cost cadastrado manualmente
                ProductCost::where('internal_product_id', $product->id)->delete();
            }

            // Se solicitado, recalcular pedidos existentes
            if (($validated['update_existing_orders'] ?? false) && $oldUnitCost != $product->unit_cost) {
                \App\Jobs\RecalculateOrderCostsJob::dispatch($product->id, true, 'product');
            }

            // Se o unit_cost mudou, verificar se este produto é usado como insumo em outros produtos
            if ($oldUnitCost != $product->unit_cost) {
                // \Log::info('Produto atualizado - verificando dependentes', [
                //     'product_id' => $product->id,
                //     'product_name' => $product->name,
                //     'old_cost' => $oldUnitCost,
                //     'new_cost' => $product->unit_cost,
                // ]);

                // Verificar se existe algum produto que usa este como ingrediente
                $isUsedAsIngredient = ProductCost::where('tenant_id', tenant_id())
                    ->where('ingredient_id', $product->id)
                    ->exists();

                if ($isUsedAsIngredient) {
                    // \Log::info('Produto é usado como insumo - disparando evento', [
                    //     'product_id' => $product->id,
                    // ]);

                    event(new \App\Events\ProductCostChanged(
                        $product->id,
                        $product->tenant_id,
                        $oldUnitCost,
                        $product->unit_cost
                    ));
                } else {
                    // \Log::info('Produto não é usado como insumo - evento não disparado', [
                    //     'product_id' => $product->id,
                    // ]);
                }
            }

            DB::commit();

            $message = 'Produto atualizado com sucesso!';
            if ($validated['update_existing_orders'] ?? false) {
                $message .= ' Recalculando custos dos pedidos existentes em segundo plano...';
            }

            // Se for requisição JSON/AJAX, retornar JSON
            if (request()->wantsJson() || request()->ajax()) {
                return response()->json([
                    'success' => true,
                    'message' => $message,
                    'product' => $product->fresh(['costs']),
                ]);
            }

            return back()->with('success', $message);
        } catch (\Exception $e) {
            DB::rollBack();

            if (request()->wantsJson() || request()->ajax()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Erro ao atualizar produto: '.$e->getMessage(),
                ], 500);
            }

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

        $product->update(['active' => ! $product->active]);

        return redirect()->back();
    }
}
