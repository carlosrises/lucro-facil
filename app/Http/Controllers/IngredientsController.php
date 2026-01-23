<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Models\Ingredient;
use App\Models\InternalProduct;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class IngredientsController extends Controller
{
    public function apiList(Request $request)
    {
        // Buscar ingredientes ativos
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
            ->map(function($product) {
                return [
                    'id' => 'product_' . $product->id, // Prefixar para evitar conflito
                    'name' => $product->name . ' (Produto)',
                    'unit' => $product->unit,
                    'unit_price' => $product->unit_cost,
                ];
            });

        // Combinar ingredientes e produtos como insumos
        $ingredients = $rawIngredients->concat($productsAsIngredients);

        return response()->json($ingredients);
    }

    public function index(Request $request)
    {
        $query = Ingredient::query()
            ->where('tenant_id', tenant_id())
            ->with('category')
            ->when($request->filled('search'), fn ($q, $search) => $q->where('name', 'like', "%{$request->input('search')}%")
            )
            ->when($request->filled('category_id'), fn ($q) => $q->where('category_id', $request->input('category_id'))
            )
            ->when($request->filled('active'), fn ($q) => $q->where('active', $request->boolean('active'))
            )
            ->orderBy('name');

        $perPage = (int) $request->input('per_page', 10);
        $ingredients = $query->paginate($perPage)->withQueryString();

        $categories = Category::where('tenant_id', tenant_id())
            ->where('type', 'ingredient')
            ->where('active', true)
            ->orderBy('name')
            ->get();

        return Inertia::render('ingredients', [
            'ingredients' => $ingredients,
            'categories' => $categories,
            'filters' => [
                'search' => $request->input('search') ?? '',
                'category_id' => $request->input('category_id') ?? '',
                'active' => $request->input('active') ?? '',
                'per_page' => $perPage,
            ],
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:255',
                Rule::unique('ingredients')->where(function ($query) use ($request) {
                    return $query->where('tenant_id', tenant_id())
                        ->where('unit', $request->input('unit'));
                }),
            ],
            'category_id' => ['nullable', 'exists:categories,id'],
            'unit' => ['required', 'in:unit,kg,g,l,ml'],
            'unit_price' => ['required', 'numeric', 'min:0'],
            'current_stock' => ['required', 'numeric', 'min:0'],
            'ideal_stock' => ['required', 'numeric', 'min:0'],
            'active' => ['boolean'],
        ]);

        $ingredient = Ingredient::create([
            ...$validated,
            'tenant_id' => tenant_id(),
        ]);

        return redirect()->back()->with('success', 'Insumo criado com sucesso!');
    }

    public function update(Request $request, Ingredient $ingredient)
    {
        if ($ingredient->tenant_id !== tenant_id()) {
            abort(403);
        }

        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:255',
                Rule::unique('ingredients')->where(function ($query) use ($request, $ingredient) {
                    return $query->where('tenant_id', tenant_id())
                        ->where('unit', $request->input('unit'));
                })->ignore($ingredient->id),
            ],
            'category_id' => ['nullable', 'exists:categories,id'],
            'unit' => ['required', 'in:unit,kg,g,l,ml'],
            'unit_price' => ['required', 'numeric', 'min:0'],
            'current_stock' => ['required', 'numeric', 'min:0'],
            'ideal_stock' => ['required', 'numeric', 'min:0'],
            'active' => ['boolean'],
        ]);

        $oldUnitPrice = $ingredient->unit_price;
        $ingredient->update($validated);

        // Se o preço unitário mudou, disparar evento para recalcular produtos dependentes
        if ($oldUnitPrice != $validated['unit_price']) {
            event(new \App\Events\IngredientCostChanged(
                $ingredient->id,
                $ingredient->tenant_id,
                $oldUnitPrice,
                $validated['unit_price']
            ));
        }

        return redirect()->back()->with('success', 'Insumo atualizado com sucesso!');
    }

    public function destroy(Ingredient $ingredient)
    {
        if ($ingredient->tenant_id !== tenant_id()) {
            abort(403);
        }

        $ingredient->delete();

        return redirect()->back()->with('success', 'Insumo excluído com sucesso!');
    }

    public function toggle(Ingredient $ingredient)
    {
        if ($ingredient->tenant_id !== tenant_id()) {
            abort(403);
        }

        $ingredient->update(['active' => ! $ingredient->active]);

        return redirect()->back();
    }
}
