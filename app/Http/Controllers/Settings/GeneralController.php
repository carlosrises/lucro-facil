<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Inertia\Inertia;

class GeneralController extends Controller
{
    public function edit(Request $request)
    {
        $tenant = $request->user()->tenant;

        return Inertia::render('settings/general', [
            'settings' => [
                'margin_excellent' => (float) ($tenant->margin_excellent ?? 100.00),
                'margin_good_min' => (float) ($tenant->margin_good_min ?? 30.00),
                'margin_good_max' => (float) ($tenant->margin_good_max ?? 99.99),
                'margin_poor' => (float) ($tenant->margin_poor ?? 0.00),
            ]
        ]);
    }

    public function update(Request $request)
    {
        $validated = $request->validate([
            'margin_excellent' => ['required', 'numeric', 'min:0', 'max:100'],
            'margin_good_min' => ['required', 'numeric', 'min:0', 'max:100'],
            'margin_good_max' => ['required', 'numeric', 'min:0', 'max:100'],
            'margin_poor' => ['required', 'numeric', 'min:0', 'max:100'],
        ]);

        // Validar que margin_poor < margin_good_min < margin_good_max < margin_excellent
        if ($validated['margin_poor'] >= $validated['margin_good_min']) {
            return back()->withErrors([
                'margin_poor' => 'A margem ruim deve ser menor que a margem boa mínima.'
            ]);
        }

        if ($validated['margin_good_min'] >= $validated['margin_good_max']) {
            return back()->withErrors([
                'margin_good_min' => 'A margem boa mínima deve ser menor que a margem boa máxima.'
            ]);
        }

        if ($validated['margin_good_max'] >= $validated['margin_excellent']) {
            return back()->withErrors([
                'margin_good_max' => 'A margem boa máxima deve ser menor que a margem excelente.'
            ]);
        }

        $request->user()->tenant->update($validated);

        return back()->with('success', 'Configurações atualizadas com sucesso!');
    }
}
