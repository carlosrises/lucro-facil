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

        // Filtro por categoria
        if ($request->filled('category')) {
            $query->where('category', $request->category);
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
            $query->where('name', 'like', '%'.$request->search.'%');
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

        // Se Takeat está integrado, adicionar também as variantes sintéticas (takeat-ifood, takeat-99food)
        if (in_array('takeat', $integratedProviders)) {
            foreach ($takeatOrigins as $origin) {
                $integratedProviders[] = "takeat-{$origin}";
            }
            $integratedProviders = array_values(array_unique($integratedProviders));
        }

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
                'category' => $request->category,
                'provider' => $request->provider,
                'active' => $request->active,
            ],
            'providers' => get_all_providers(),
            'integratedProviders' => $integratedProviders,
            'paymentMethods' => [
                'ifood' => get_payment_methods_by_provider('ifood'),
                'rappi' => get_payment_methods_by_provider('rappi'),
                'uber_eats' => get_payment_methods_by_provider('uber_eats'),
                'takeat' => get_payment_methods_by_provider('takeat'),
                '99food' => get_payment_methods_by_provider('99food'),
            ],
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'category' => 'required|in:cost,commission,tax,payment_method',
            'provider' => 'nullable|string|max:100',
            'type' => 'required|in:percentage,fixed',
            'value' => 'required|numeric|min:0',
            'applies_to' => 'required|in:all_orders,delivery_only,pickup_only,payment_method,custom',
            'delivery_by' => 'nullable|in:all,store,marketplace',
            'payment_type' => 'nullable|in:all,online,offline',
            'condition_value' => 'nullable|string',
            'condition_values' => 'nullable|array',
            'condition_values.*' => 'string',
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
        $cacheKey = null;
        if ($applyToExisting) {
            \App\Jobs\RecalculateOrderCostsJob::dispatch(
                $costCommission->id,
                false, // false = aplica filtro de provider/origin
                'cost_commission',
                null,
                null,
                true // onlySpecificCommission = true (recalcula apenas esta comissão)
            );
            $cacheKey = "recalculate_progress_{$validated['tenant_id']}_cost_commission_{$costCommission->id}";

            \Log::info('Taxa de pagamento criada', [
                'cost_commission_id' => $costCommission->id,
                'name' => $costCommission->name,
                'provider' => $costCommission->provider,
                'payment_type' => $costCommission->payment_type,
                'condition_values' => $costCommission->condition_values,
                'cache_key' => $cacheKey,
            ]);
        }

        return back()->with([
            'success' => 'Custo/Comissão criado com sucesso!'.($applyToExisting ? ' Recalculando custos dos pedidos existentes...' : ''),
            'recalculate_cache_key' => $cacheKey,
        ]);
    }

    /**
     * Store via API (retorna JSON ao invés de Inertia)
     */
    public function apiStore(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'category' => 'required|in:cost,commission,tax,payment_method',
            'provider' => 'nullable|string|max:100',
            'type' => 'required|in:percentage,fixed',
            'value' => 'required|numeric|min:0',
            'applies_to' => 'required|in:all_orders,delivery_only,pickup_only,payment_method,custom',
            'delivery_by' => 'nullable|in:all,store,marketplace',
            'payment_type' => 'nullable|in:all,online,offline',
            'condition_value' => 'nullable|string',
            'condition_values' => 'nullable|array',
            'condition_values.*' => 'string',
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

        $costCommission = CostCommission::create($validated);

        return response()->json([
            'success' => true,
            'message' => 'Taxa criada com sucesso!',
            'data' => $costCommission,
        ], 201);
    }

    /**
     * Index via API (retorna JSON ao invés de Inertia)
     */
    public function apiIndex(Request $request)
    {
        $query = CostCommission::where('tenant_id', $request->user()->tenant_id);

        // Filtros
        if ($request->has('category')) {
            $query->where('category', $request->category);
        }

        if ($request->has('active')) {
            $query->where('active', $request->active);
        }

        if ($request->has('provider')) {
            $query->where('provider', $request->provider);
        }

        $costCommissions = $query->orderBy('name')->get();

        return response()->json([
            'success' => true,
            'data' => $costCommissions,
        ]);
    }

    public function update(Request $request, CostCommission $costCommission)
    {
        // Verifica se pertence ao tenant
        if ($costCommission->tenant_id !== $request->user()->tenant_id) {
            abort(403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'category' => 'required|in:cost,commission,tax,payment_method',
            'provider' => 'nullable|string|max:100',
            'type' => 'required|in:percentage,fixed',
            'value' => 'required|numeric|min:0',
            'applies_to' => 'required|in:all_orders,delivery_only,pickup_only,payment_method,custom',
            'delivery_by' => 'nullable|in:all,store,marketplace',
            'payment_type' => 'nullable|in:all,online,offline',
            'condition_value' => 'nullable|string',
            'condition_values' => 'nullable|array',
            'condition_values.*' => 'string',
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

        // Se for payment_method, força provider como null (convertendo taxas antigas para "Todos")
        if ($validated['category'] === 'payment_method') {
            $validated['provider'] = null;
        }

        // Incrementar versão
        $validated['version'] = $costCommission->version + 1;
        $validated['last_modified_at'] = now();

        $costCommission->update($validated);

        // Se aplicar retroativamente, disparar job para recalcular pedidos
        $cacheKey = null;
        if ($applyRetroactively) {
            RecalculateOrderCostsJob::dispatch(
                $costCommission->id,
                false, // false = aplica filtro de provider/origin
                'cost_commission',
                null,
                null,
                true // onlySpecificCommission = true (recalcula apenas esta comissão)
            );
            $cacheKey = "recalculate_progress_{$costCommission->tenant_id}_cost_commission_{$costCommission->id}";
        }

        return back()->with([
            'success' => 'Custo/Comissão atualizado com sucesso!'.($applyRetroactively ? ' Recalculando custos dos pedidos existentes...' : ''),
            'recalculate_cache_key' => $cacheKey,
        ]);
    }

    public function toggle(Request $request, CostCommission $costCommission)
    {
        // Verifica se pertence ao tenant
        if ($costCommission->tenant_id !== $request->user()->tenant_id) {
            abort(403);
        }

        $costCommission->update([
            'active' => ! $costCommission->active,
        ]);

        return back()->with('success', 'Status atualizado com sucesso!');
    }

    public function destroy(Request $request, CostCommission $costCommission)
    {
        // Verifica se pertence ao tenant
        if ($costCommission->tenant_id !== $request->user()->tenant_id) {
            abort(403);
        }

        // Capturar dados antes de excluir
        $shouldRecalculate = $request->input('recalculate', false);
        $tenantId = $costCommission->tenant_id;
        $provider = $costCommission->provider;
        $costCommissionId = $costCommission->id;

        // Excluir o registro
        $costCommission->delete();

        // Se deve recalcular, disparar job APÓS excluir mas com dados salvos
        if ($shouldRecalculate) {
            // Remover comissão específica dos pedidos (granular)
            RecalculateOrderCostsJob::dispatch(
                $costCommissionId,
                false, // false = aplica filtro de provider/origin
                'cost_commission',
                $tenantId, // Passa tenantId para o job
                $provider,  // Passa provider para o job
                true, // onlySpecificCommission = true (remove apenas esta comissão)
                true  // isDeleting = true (indica que é uma remoção)
            );
            $cacheKey = "recalculate_progress_{$tenantId}_cost_commission_{$costCommissionId}";

            return back()->with([
                'success' => 'Custo/Comissão excluído! Recalculando pedidos existentes...',
                'recalculate_cache_key' => $cacheKey,
            ]);
        }

        return back()->with('success', 'Custo/Comissão excluído com sucesso!');
    }

    public function getRecalculateProgress(Request $request)
    {
        $tenantId = $request->user()->tenant_id;
        $cacheKey = $request->input('cache_key');

        if ($cacheKey) {
            $progress = \Cache::get($cacheKey);

            if ($progress) {
                return response()->json($progress);
            }
        }

        return response()->json([
            'status' => 'idle',
        ]);
    }
}
