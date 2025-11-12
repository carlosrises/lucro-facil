<?php

namespace App\Http\Controllers;

use App\Models\Category;
use Illuminate\Http\Request;
use Inertia\Inertia;

class CategoriesController extends Controller
{
    public function index(Request $request)
    {
        $query = Category::query()
            ->where('tenant_id', tenant_id())
            ->where('type', 'ingredient')
            ->orderBy('name');

        $categories = $query->get();

        return response()->json($categories);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'type' => ['required', 'in:ingredient,product'],
            'color' => ['nullable', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'active' => ['boolean'],
        ]);

        $category = Category::create([
            ...$validated,
            'tenant_id' => tenant_id(),
        ]);

        return redirect()->back()->with([
            'success' => 'Categoria criada com sucesso!',
            'category' => $category,
        ]);
    }

    public function update(Request $request, Category $category)
    {
        if ($category->tenant_id !== tenant_id()) {
            abort(403);
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'type' => ['required', 'in:ingredient,product'],
            'color' => ['nullable', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'active' => ['boolean'],
        ]);

        $category->update($validated);

        return redirect()->back()->with('success', 'Categoria atualizada com sucesso!');
    }

    public function destroy(Category $category)
    {
        if ($category->tenant_id !== tenant_id()) {
            abort(403);
        }

        $category->delete();

        return redirect()->back()->with('success', 'Categoria excluída com sucesso!');
    }

    public function manage(Request $request)
    {
        $query = Category::where('tenant_id', $request->user()->tenant_id)
            ->withCount(['ingredients']);

        // Filtros
        if ($request->filled('search')) {
            $query->where('name', 'like', '%' . $request->search . '%');
        }

        if ($request->filled('type')) {
            $query->where('type', $request->type);
        }

        if ($request->filled('active')) {
            $query->where('active', $request->active === 'true');
        }

        $categories = $query->orderBy('name')->paginate(10);

        return Inertia::render('categories', [
            'categories' => $categories,
            'filters' => [
                'search' => $request->search,
                'type' => $request->type,
                'active' => $request->active,
            ]
        ]);
    }
}
