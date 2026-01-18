<?php

namespace App\Http\Controllers;

use App\Models\FinanceCategory;
use App\Models\FinanceEntry;
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
        // Definir mês padrão como mês atual se não informado
        $month = $request->input('month', now()->format('Y-m'));

        $query = FinanceEntry::query()
            ->where('tenant_id', tenant_id())
            ->withoutTemplates() // Excluir templates da listagem
            ->with(['category', 'parent'])
            ->when($request->input('search'), fn ($q, $search) => $q->where(function ($query) use ($search) {
                $query->where('reference', 'like', "%{$search}%")
                    ->orWhere('supplier', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%")
                    ->orWhere('notes', 'like', "%{$search}%");
            })
            )
            ->when($request->input('category_id'), fn ($q, $categoryId) => $q->where('finance_category_id', $categoryId)
            )
            ->when($request->input('type'), fn ($q, $type) => $q->whereHas('category', function ($query) use ($type) {
                $query->where('type', $type);
            })
            )
            ->when($request->input('status'), fn ($q, $status) => $q->where('status', $status)
            )
            // Sempre aplicar filtro de mês (padrão: mês atual)
            ->whereYear('occurred_on', substr($month, 0, 4))
            ->whereMonth('occurred_on', substr($month, 5, 2))
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
            'filters' => [
                'search' => $request->input('search'),
                'category_id' => $request->input('category_id'),
                'type' => $request->input('type'),
                'status' => $request->input('status'),
                'month' => $request->input('month', now()->format('Y-m')), // Pré-setar com mês atual
            ],
        ]);
    }

    public function store(Request $request)
    {
        try {
            $validated = $request->validate([
                'finance_category_id' => 'required|exists:finance_categories,id',
                'occurred_on' => 'required|date',
                'amount' => 'required|numeric|min:0.01',
                'reference' => 'nullable|string|max:255',
                'notes' => 'nullable|string',
                'supplier' => 'nullable|string|max:255',
                'description' => 'required|string|max:255',
                'due_date' => 'nullable|date',
                'recurrence_type' => 'required|in:single,weekly,biweekly,monthly,bimonthly,quarterly,semiannual,annual',
                'recurrence_end_date' => 'nullable|required_unless:recurrence_type,single|date|after_or_equal:occurred_on',
                'consider_business_days' => 'nullable|boolean',
                'payment_method' => 'nullable|string|max:255',
                'financial_account' => 'nullable|string|max:255',
                'competence_date' => 'nullable|date',
                'status' => 'nullable|in:pending,paid',
                'paid_at' => 'nullable|date',
            ], [
                'recurrence_end_date.after_or_equal' => 'A data limite deve ser igual ou posterior à data de emissão.',
                'recurrence_end_date.required_unless' => 'A data limite é obrigatória para movimentações recorrentes.',
            ]);

            $validated['tenant_id'] = tenant_id();

            // Se status for 'paid' e paid_at não for informado, usar a data/hora atual
            if (isset($validated['status']) && $validated['status'] === 'paid' && empty($validated['paid_at'])) {
                $validated['paid_at'] = now();
            }

            // Verificar se é recorrente
            if ($validated['recurrence_type'] !== 'single') {
                // logger()->info('Criando movimentação recorrente', [
                //     'tenant_id' => $validated['tenant_id'],
                //     'recurrence_type' => $validated['recurrence_type'],
                //     'occurred_on' => $validated['occurred_on'],
                //     'recurrence_end_date' => $validated['recurrence_end_date'] ?? null,
                // ]);

                $template = $this->recurringService->createRecurringEntry($validated);

                // logger()->info('Template criado com sucesso', [
                //     'template_id' => $template->id,
                //     'children_count' => $template->children()->count(),
                // ]);
            } else {
                // Garantir que is_recurring seja false para entradas únicas
                $validated['is_recurring'] = false;
                $entry = FinanceEntry::create($validated);

                // logger()->info('Movimentação única criada', [
                //     'entry_id' => $entry->id,
                //     'tenant_id' => $validated['tenant_id'],
                // ]);
            }

            return redirect()->back()->with('success', 'Movimentação criada com sucesso!');
        } catch (\Illuminate\Validation\ValidationException $e) {
            logger()->error('Erro de validação ao criar movimentação financeira', [
                'errors' => $e->errors(),
                'data' => $request->all(),
            ]);
            throw $e;
        } catch (\Exception $e) {
            logger()->error('Erro ao criar movimentação financeira', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'data' => $request->all(),
            ]);

            return redirect()->back()->withErrors(['error' => 'Erro ao salvar movimentação: '.$e->getMessage()]);
        }
    }

    public function update(Request $request, FinanceEntry $entry)
    {
        // Verificar se o entry pertence ao tenant
        if ($entry->tenant_id !== tenant_id()) {
            abort(403, 'Unauthorized');
        }

        try {
            $validated = $request->validate([
                'finance_category_id' => 'required|exists:finance_categories,id',
                'occurred_on' => 'required|date',
                'amount' => 'required|numeric|min:0.01',
                'reference' => 'nullable|string|max:255',
                'notes' => 'nullable|string',
                'supplier' => 'nullable|string|max:255',
                'description' => 'required|string|max:255',
                'due_date' => 'nullable|date',
                'recurrence_type' => 'required|in:single,weekly,biweekly,monthly,bimonthly,quarterly,semiannual,annual',
                'recurrence_end_date' => 'nullable|required_unless:recurrence_type,single|date|after_or_equal:occurred_on',
                'consider_business_days' => 'nullable|boolean',
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

            // Se é uma parcela filha de recorrência, atualizar o template pai
            if ($entry->parent_entry_id !== null) {
                $template = FinanceEntry::find($entry->parent_entry_id);
                if ($template && $template->is_recurring && $validated['recurrence_type'] !== 'single') {
                    // Atualizar o template com os novos dados
                    $this->recurringService->updateRecurringEntry($template, $validated);

                    return redirect()->back()->with('success', 'Recorrência atualizada! Todas as parcelas futuras foram regeneradas.');
                }
            }

            // Se é um template recorrente, atualizar e regenerar parcelas
            if ($entry->is_recurring && $entry->parent_entry_id === null && $validated['recurrence_type'] !== 'single') {
                $this->recurringService->updateRecurringEntry($entry, $validated);
            } else {
                $entry->update($validated);
            }

            return redirect()->back()->with('success', 'Movimentação atualizada com sucesso!');
        } catch (\Illuminate\Validation\ValidationException $e) {
            logger()->error('Erro de validação ao atualizar movimentação financeira', [
                'entry_id' => $entry->id,
                'errors' => $e->errors(),
                'data' => $request->all(),
            ]);
            throw $e;
        } catch (\Exception $e) {
            logger()->error('Erro ao atualizar movimentação financeira', [
                'entry_id' => $entry->id,
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'data' => $request->all(),
            ]);

            return redirect()->back()->withErrors(['error' => 'Erro ao atualizar movimentação: '.$e->getMessage()]);
        }
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
