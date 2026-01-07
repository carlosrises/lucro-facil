<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Models\Ingredient;
use Illuminate\Http\Request;
use Inertia\Inertia;

class IngredientsController extends Controller
{
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
            'name' => ['required', 'string', 'max:255'],
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
            'name' => ['required', 'string', 'max:255'],
            'category_id' => ['nullable', 'exists:categories,id'],
            'unit' => ['required', 'in:unit,kg,g,l,ml'],
            'unit_price' => ['required', 'numeric', 'min:0'],
            'current_stock' => ['required', 'numeric', 'min:0'],
            'ideal_stock' => ['required', 'numeric', 'min:0'],
            'active' => ['boolean'],
        ]);

        $ingredient->update($validated);

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
