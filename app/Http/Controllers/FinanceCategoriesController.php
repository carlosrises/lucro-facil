<?php

namespace App\Http\Controllers;

use App\Models\FinanceCategory;
use Illuminate\Http\Request;
use Inertia\Inertia;

class FinanceCategoriesController extends Controller
{
    public function index(Request $request)
    {
        $query = FinanceCategory::with(['children', 'parent'])
            ->where('tenant_id', $request->user()->tenant_id)
            ->whereNull('parent_id') // Apenas categorias raiz
            ->orderBy('type')
            ->orderBy('name');

        $categories = $query->get();

        // Organiza em árvore recursivamente
        $tree = $this->buildTree($categories);

        return Inertia::render('financial/categories', [
            'categories' => $tree,
        ]);
    }

    private function buildTree($categories)
    {
        return $categories->map(function ($category) {
            return [
                'id' => $category->id,
                'name' => $category->name,
                'type' => $category->type,
                'parent_id' => $category->parent_id,
                'children' => $this->buildTree($category->children),
            ];
        });
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'type' => 'required|in:expense,income',
            'parent_id' => 'nullable|exists:finance_categories,id',
        ]);

        $category = FinanceCategory::create([
            'tenant_id' => $request->user()->tenant_id,
            'name' => $validated['name'],
            'type' => $validated['type'],
            'parent_id' => $validated['parent_id'] ?? null,
        ]);

        return back()->with('success', 'Categoria criada com sucesso!');
    }

    public function update(Request $request, FinanceCategory $category)
    {
        // Verifica se pertence ao tenant
        if ($category->tenant_id !== $request->user()->tenant_id) {
            abort(403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'type' => 'required|in:expense,income',
            'parent_id' => 'nullable|exists:finance_categories,id',
        ]);

        // Impede que a categoria seja pai de si mesma
        if ($validated['parent_id'] == $category->id) {
            return back()->withErrors(['parent_id' => 'Uma categoria não pode ser pai de si mesma.']);
        }

        $category->update($validated);

        return back()->with('success', 'Categoria atualizada com sucesso!');
    }

    public function destroy(Request $request, FinanceCategory $category)
    {
        // Verifica se pertence ao tenant
        if ($category->tenant_id !== $request->user()->tenant_id) {
            abort(403);
        }

        // Verifica se tem filhos
        if ($category->children()->count() > 0) {
            return back()->withErrors(['delete' => 'Não é possível excluir uma categoria que possui subcategorias.']);
        }

        // Verifica se tem entradas
        if ($category->entries()->count() > 0) {
            return back()->withErrors(['delete' => 'Não é possível excluir uma categoria que possui movimentações.']);
        }

        $category->delete();

        return back()->with('success', 'Categoria excluída com sucesso!');
    }
}
