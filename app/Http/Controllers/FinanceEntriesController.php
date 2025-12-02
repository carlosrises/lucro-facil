<?php

namespace App\Http\Controllers;

use App\Models\FinanceEntry;
use App\Models\FinanceCategory;
use App\Services\RecurringEntryService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class FinanceEntriesController extends Controller
{
    public function __construct(
        private RecurringEntryService $recurringService
    ) {}

    public function index(Request $request)
    {
        $query = FinanceEntry::query()
            ->where('tenant_id', tenant_id())
            ->withoutTemplates() // Excluir templates da listagem
            ->with(['category', 'parent'])
            ->when($request->input('search'), fn ($q, $search) =>
                $q->where(function ($query) use ($search) {
                    $query->where('reference', 'like', "%{$search}%")
                        ->orWhere('supplier', 'like', "%{$search}%")
                        ->orWhere('notes', 'like', "%{$search}%");
                })
            )
            ->when($request->input('category_id'), fn ($q, $categoryId) =>
                $q->where('finance_category_id', $categoryId)
            )
            ->when($request->input('type'), fn ($q, $type) =>
                $q->whereHas('category', function ($query) use ($type) {
                    $query->where('type', $type);
                })
            )
            ->when($request->input('status'), fn ($q, $status) =>
                $q->where('status', $status)
            )
            ->when($request->input('month'), fn ($q, $month) =>
                $q->whereYear('occurred_on', substr($month, 0, 4))
                  ->whereMonth('occurred_on', substr($month, 5, 2))
            )
            ->orderBy('occurred_on', 'desc');

        $perPage = (int) $request->input('per_page', 10);
        $entries = $query->paginate($perPage)->withQueryString();

        // Buscar categorias para o formulário
        $categories = FinanceCategory::where('tenant_id', tenant_id())
            ->orderBy('type')
            ->orderBy('name')
            ->get(['id', 'name', 'type', 'parent_id']);

        return Inertia::render('financial/entries', [
            'entries' => $entries,
            'categories' => $categories,
            'filters' => $request->only(['search', 'category_id', 'type', 'status', 'month']),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'finance_category_id' => 'required|exists:finance_categories,id',
            'occurred_on' => 'required|date',
            'amount' => 'required|numeric|min:0.01',
            'reference' => 'nullable|string|max:255',
            'notes' => 'nullable|string',
            'supplier' => 'nullable|string|max:255',
            'due_date' => 'nullable|date',
            'recurrence_type' => 'required|in:single,weekly,biweekly,monthly,bimonthly,quarterly,semiannual,annual',
            'recurrence_end_date' => 'nullable|required_unless:recurrence_type,single|date|after:occurred_on',
            'payment_method' => 'nullable|string|max:255',
            'financial_account' => 'nullable|string|max:255',
            'competence_date' => 'nullable|date',
            'status' => 'nullable|in:pending,paid',
            'paid_at' => 'nullable|date',
        ]);

        $validated['tenant_id'] = tenant_id();

        // Se status for 'paid' e paid_at não for informado, usar a data/hora atual
        if (isset($validated['status']) && $validated['status'] === 'paid' && empty($validated['paid_at'])) {
            $validated['paid_at'] = now();
        }

        // Verificar se é recorrente
        if ($validated['recurrence_type'] !== 'single') {
            $this->recurringService->createRecurringEntry($validated);
        } else {
            FinanceEntry::create($validated);
        }

        return redirect()->back();
    }

    public function update(Request $request, FinanceEntry $entry)
    {
        // Verificar se o entry pertence ao tenant
        if ($entry->tenant_id !== tenant_id()) {
            abort(403, 'Unauthorized');
        }

        $validated = $request->validate([
            'finance_category_id' => 'required|exists:finance_categories,id',
            'occurred_on' => 'required|date',
            'amount' => 'required|numeric|min:0.01',
            'reference' => 'nullable|string|max:255',
            'notes' => 'nullable|string',
            'supplier' => 'nullable|string|max:255',
            'due_date' => 'nullable|date',
            'recurrence_type' => 'required|in:single,weekly,biweekly,monthly,bimonthly,quarterly,semiannual,annual',
            'recurrence_end_date' => 'nullable|required_unless:recurrence_type,single|date|after:occurred_on',
            'payment_method' => 'nullable|string|max:255',
            'financial_account' => 'nullable|string|max:255',
            'competence_date' => 'nullable|date',
            'status' => 'nullable|in:pending,paid',
            'paid_at' => 'nullable|date',
        ]);

        // Se status mudou para 'paid' e paid_at não foi informado, usar a data/hora atual
        if (isset($validated['status']) && $validated['status'] === 'paid' && empty($validated['paid_at'])) {
            $validated['paid_at'] = now();
        }

        // Se é um template recorrente, atualizar e regenerar parcelas
        if ($entry->is_recurring && $entry->parent_entry_id === null && $validated['recurrence_type'] !== 'single') {
            $this->recurringService->updateRecurringEntry($entry, $validated);
        } else {
            $entry->update($validated);
        }

        return redirect()->back();
    }

    public function destroy(FinanceEntry $entry)
    {
        // Verificar se o entry pertence ao tenant
        if ($entry->tenant_id !== tenant_id()) {
            abort(403, 'Unauthorized');
        }

        $entry->delete();

        return redirect()->back();
    }
}
