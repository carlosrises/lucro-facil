<?php

namespace App\Http\Controllers;

use App\Models\TaxCategory;
use Illuminate\Http\Request;
use Inertia\Inertia;

class TaxCategoriesController extends Controller
{
    public function index(Request $request)
    {
        $query = TaxCategory::query()
            ->where('tenant_id', tenant_id())
            ->when($request->input('search'), fn ($q, $search) =>
                $q->where(function ($query) use ($search) {
                    $query->where('name', 'like', "%{$search}%")
                        ->orWhere('sale_cfop', 'like', "%{$search}%")
                        ->orWhere('csosn_cst', 'like', "%{$search}%")
                        ->orWhere('ncm', 'like', "%{$search}%");
                })
            )
            ->when($request->has('active'), fn ($q) =>
                $q->where('active', $request->boolean('active'))
            )
            ->when($request->input('tax_calculation_type'), fn ($q, $type) =>
                $q->where('tax_calculation_type', $type)
            )
            ->orderBy('name');

        $perPage = (int) $request->input('per_page', 10);
        $taxCategories = $query->paginate($perPage)->withQueryString();

        return Inertia::render('tax-categories', [
            'taxCategories' => $taxCategories,
            'filters' => [
                'search' => $request->input('search', ''),
                'active' => $request->input('active', ''),
                'tax_calculation_type' => $request->input('tax_calculation_type', ''),
                'per_page' => $perPage,
            ],
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'sale_cfop' => ['required', 'string', 'max:10'],
            'description' => ['nullable', 'string'],
            'icms_origin' => ['required', 'string', 'in:0,1,2,3,4,5,6,7,8'],
            'csosn_cst' => ['required', 'string', 'max:10'],
            'ncm' => ['nullable', 'string', 'max:20'],
            'tax_calculation_type' => ['required', 'in:detailed,fixed,none'],

            // Campos condicionais para 'detailed'
            'iss_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'icms_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'pis_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'cofins_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'pis_cofins_mode' => ['nullable', 'in:normal,monofasico,isento'],
            'icms_st' => ['boolean'],

            // Campo condicional para 'fixed'
            'fixed_tax_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],

            'active' => ['boolean'],
        ]);

        // Limpa campos não utilizados baseado no tipo de cálculo
        if ($validated['tax_calculation_type'] !== 'detailed') {
            $validated['iss_rate'] = null;
            $validated['icms_rate'] = null;
            $validated['pis_rate'] = null;
            $validated['cofins_rate'] = null;
            $validated['pis_cofins_mode'] = null;
            $validated['icms_st'] = false;
        }

        if ($validated['tax_calculation_type'] !== 'fixed') {
            $validated['fixed_tax_rate'] = null;
        }

        $taxCategory = TaxCategory::create([
            'tenant_id' => tenant_id(),
            ...$validated,
        ]);

        return redirect()->back()->with('success', 'Categoria fiscal criada com sucesso!');
    }

    public function update(Request $request, TaxCategory $taxCategory)
    {
        // Verifica se a categoria pertence ao tenant
        if ($taxCategory->tenant_id !== tenant_id()) {
            abort(403);
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'sale_cfop' => ['required', 'string', 'max:10'],
            'description' => ['nullable', 'string'],
            'icms_origin' => ['required', 'string', 'in:0,1,2,3,4,5,6,7,8'],
            'csosn_cst' => ['required', 'string', 'max:10'],
            'ncm' => ['nullable', 'string', 'max:20'],
            'tax_calculation_type' => ['required', 'in:detailed,fixed,none'],

            'iss_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'icms_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'pis_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'cofins_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'pis_cofins_mode' => ['nullable', 'in:normal,monofasico,isento'],
            'icms_st' => ['boolean'],

            'fixed_tax_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],

            'active' => ['boolean'],
        ]);

        // Limpa campos não utilizados baseado no tipo de cálculo
        if ($validated['tax_calculation_type'] !== 'detailed') {
            $validated['iss_rate'] = null;
            $validated['icms_rate'] = null;
            $validated['pis_rate'] = null;
            $validated['cofins_rate'] = null;
            $validated['pis_cofins_mode'] = null;
            $validated['icms_st'] = false;
        }

        if ($validated['tax_calculation_type'] !== 'fixed') {
            $validated['fixed_tax_rate'] = null;
        }

        $taxCategory->update($validated);

        return redirect()->back()->with('success', 'Categoria fiscal atualizada com sucesso!');
    }

    public function destroy(TaxCategory $taxCategory)
    {
        // Verifica se a categoria pertence ao tenant
        if ($taxCategory->tenant_id !== tenant_id()) {
            abort(403);
        }

        $taxCategory->delete();

        return redirect()->back()->with('success', 'Categoria fiscal excluída com sucesso!');
    }
}
