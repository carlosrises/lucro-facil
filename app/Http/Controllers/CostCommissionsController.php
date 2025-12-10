<?php

namespace App\Http\Controllers;

use App\Jobs\RecalculateOrderCostsJob;
use App\Models\CostCommission;
use Illuminate\Http\Request;
use Inertia\Inertia;

class CostCommissionsController extends Controller
{
    public function index(Request $request)
    {
        $tenantId = $request->user()->tenant_id;

        $query = CostCommission::query()
            ->where('tenant_id', $tenantId)
            ->orderBy('created_at', 'desc');

        // Filtro por tipo
        if ($request->filled('type')) {
            $query->where('type', $request->type);
        }

        // Filtro por provider
        if ($request->filled('provider')) {
            $query->where('provider', $request->provider);
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

        // Busca providers integrados (stores ativas do tenant)
        $integratedProviders = \App\Models\Store::where('tenant_id', $tenantId)
            ->where('active', true)
            ->distinct()
            ->pluck('provider')
            ->toArray();

        // Adiciona também os origins dos pedidos Takeat (99food, keeta, neemo, etc)
        $takeatOrigins = \App\Models\Order::where('tenant_id', $tenantId)
            ->where('provider', 'takeat')
            ->whereNotNull('origin')
            ->distinct()
            ->pluck('origin')
            ->toArray();

        $integratedProviders = array_values(array_unique(array_merge($integratedProviders, $takeatOrigins)));

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
                'provider' => $request->provider,
                'active' => $request->active,
            ],
            'providers' => get_all_providers(),
            'integratedProviders' => $integratedProviders,
            'paymentMethods' => [
                'ifood' => get_payment_methods_by_provider('ifood'),
                'rappi' => get_payment_methods_by_provider('rappi'),
                'uber_eats' => get_payment_methods_by_provider('uber_eats'),
            ],
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'category' => 'required|in:cost,commission',
            'provider' => 'nullable|string|in:ifood,rappi,uber_eats,99food,keeta,neemo,takeat,pdv',
            'type' => 'required|in:percentage,fixed',
            'value' => 'required|numeric|min:0',
            'applies_to' => 'required|in:all_orders,delivery_only,pickup_only,payment_method,custom',
            'condition_value' => 'nullable|string',
            'affects_revenue_base' => 'nullable|boolean',
            'enters_tax_base' => 'nullable|boolean',
            'reduces_revenue_base' => 'nullable|boolean',
            'active' => 'nullable|boolean',
            'apply_to_existing_orders' => 'nullable|boolean', // Nova opção
        ]);

        $validated['tenant_id'] = $request->user()->tenant_id;

        // Garante valores padrão para os booleanos
        $validated['affects_revenue_base'] = $validated['affects_revenue_base'] ?? false;
        $validated['enters_tax_base'] = $validated['enters_tax_base'] ?? false;
        $validated['reduces_revenue_base'] = $validated['reduces_revenue_base'] ?? false;
        $validated['active'] = $validated['active'] ?? true;
        $applyToExisting = $validated['apply_to_existing_orders'] ?? false;
        unset($validated['apply_to_existing_orders']);

        $costCommission = CostCommission::create($validated);

        // Se aplicar aos pedidos existentes, disparar job para recalcular
        if ($applyToExisting) {
            \App\Jobs\RecalculateOrderCostsJob::dispatch(
                $costCommission->id,
                false, // false = aplica filtro de provider/origin
                'cost_commission'
            );
        }

        return back()->with('success', 'Custo/Comissão criado com sucesso!' .
            ($applyToExisting ? ' Recalculando custos dos pedidos existentes...' : ''));
    }

    public function update(Request $request, CostCommission $costCommission)
    {
        // Verifica se pertence ao tenant
        if ($costCommission->tenant_id !== $request->user()->tenant_id) {
            abort(403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'category' => 'required|in:cost,commission',
            'provider' => 'nullable|string|in:ifood,rappi,uber_eats,99food,keeta,neemo,takeat,pdv',
            'type' => 'required|in:percentage,fixed',
            'value' => 'required|numeric|min:0',
            'applies_to' => 'required|in:all_orders,delivery_only,pickup_only,payment_method,custom',
            'condition_value' => 'nullable|string',
            'affects_revenue_base' => 'nullable|boolean',
            'enters_tax_base' => 'nullable|boolean',
            'reduces_revenue_base' => 'nullable|boolean',
            'active' => 'nullable|boolean',
            'apply_retroactively' => 'nullable|boolean', // Nova opção
        ]);

        // Garante valores padrão para os booleanos
        $validated['affects_revenue_base'] = $validated['affects_revenue_base'] ?? false;
        $validated['enters_tax_base'] = $validated['enters_tax_base'] ?? false;
        $validated['reduces_revenue_base'] = $validated['reduces_revenue_base'] ?? false;
        $validated['active'] = $validated['active'] ?? false;
        $applyRetroactively = $validated['apply_retroactively'] ?? false;
        unset($validated['apply_retroactively']);

        // Incrementar versão
        $validated['version'] = $costCommission->version + 1;
        $validated['last_modified_at'] = now();

        $costCommission->update($validated);

        // Se aplicar retroativamente, disparar job para recalcular pedidos
        if ($applyRetroactively) {
            RecalculateOrderCostsJob::dispatch(
                $costCommission->id,
                false, // false = aplica filtro de provider/origin
                'cost_commission'
            );
        }

        return back()->with('success', 'Custo/Comissão atualizado com sucesso!' .
            ($applyRetroactively ? ' Recalculando custos dos pedidos existentes...' : ''));
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
