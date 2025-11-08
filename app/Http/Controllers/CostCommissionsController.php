<?php

namespace App\Http\Controllers;

use App\Models\CostCommission;
use Illuminate\Http\Request;
use Inertia\Inertia;

class CostCommissionsController extends Controller
{
    public function index(Request $request)
    {
        $query = CostCommission::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->orderBy('created_at', 'desc');

        // Filtro por tipo
        if ($request->filled('type')) {
            $query->where('type', $request->type);
        }

        // Filtro por status ativo
        if ($request->filled('active')) {
            $query->where('active', $request->boolean('active'));
        }

        // Busca por nome
        if ($request->filled('search')) {
            $query->where('name', 'like', '%' . $request->search . '%');
        }

        $costCommissions = $query->paginate(15)->withQueryString();

        return Inertia::render('cost-commissions', [
            'data' => $costCommissions->items(),
            'pagination' => [
                'current_page' => $costCommissions->currentPage(),
                'last_page' => $costCommissions->lastPage(),
                'per_page' => $costCommissions->perPage(),
                'total' => $costCommissions->total(),
            ],
            'filters' => [
                'search' => $request->search,
                'type' => $request->type,
                'active' => $request->active,
            ],
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'type' => 'required|in:percentage,fixed',
            'value' => 'required|numeric|min:0',
            'affects_revenue_base' => 'nullable|boolean',
            'enters_tax_base' => 'nullable|boolean',
            'reduces_revenue_base' => 'nullable|boolean',
            'active' => 'nullable|boolean',
        ]);

        $validated['tenant_id'] = $request->user()->tenant_id;

        // Garante valores padrão para os booleanos
        $validated['affects_revenue_base'] = $validated['affects_revenue_base'] ?? false;
        $validated['enters_tax_base'] = $validated['enters_tax_base'] ?? false;
        $validated['reduces_revenue_base'] = $validated['reduces_revenue_base'] ?? false;
        $validated['active'] = $validated['active'] ?? true;

        CostCommission::create($validated);

        return back()->with('success', 'Custo/Comissão criado com sucesso!');
    }

    public function update(Request $request, CostCommission $costCommission)
    {
        // Verifica se pertence ao tenant
        if ($costCommission->tenant_id !== $request->user()->tenant_id) {
            abort(403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'type' => 'required|in:percentage,fixed',
            'value' => 'required|numeric|min:0',
            'affects_revenue_base' => 'nullable|boolean',
            'enters_tax_base' => 'nullable|boolean',
            'reduces_revenue_base' => 'nullable|boolean',
            'active' => 'nullable|boolean',
        ]);

        // Garante valores padrão para os booleanos
        $validated['affects_revenue_base'] = $validated['affects_revenue_base'] ?? false;
        $validated['enters_tax_base'] = $validated['enters_tax_base'] ?? false;
        $validated['reduces_revenue_base'] = $validated['reduces_revenue_base'] ?? false;
        $validated['active'] = $validated['active'] ?? false;

        $costCommission->update($validated);

        return back()->with('success', 'Custo/Comissão atualizado com sucesso!');
    }

    public function toggle(Request $request, CostCommission $costCommission)
    {
        // Verifica se pertence ao tenant
        if ($costCommission->tenant_id !== $request->user()->tenant_id) {
            abort(403);
        }

        $costCommission->update([
            'active' => !$costCommission->active,
        ]);

        return back()->with('success', 'Status atualizado com sucesso!');
    }

    public function destroy(Request $request, CostCommission $costCommission)
    {
        // Verifica se pertence ao tenant
        if ($costCommission->tenant_id !== $request->user()->tenant_id) {
            abort(403);
        }

        $costCommission->delete();

        return back()->with('success', 'Custo/Comissão excluído com sucesso!');
    }
}
