<?php

namespace App\Console\Commands;

use App\Models\FinanceEntry;
use Illuminate\Console\Command;

class CheckFinanceEntries extends Command
{
    protected $signature = 'finance:check-entries {--tenant= : ID do tenant}';

    protected $description = 'Verificar movimentações financeiras no banco';

    public function handle()
    {
        $tenantId = $this->option('tenant');

        if (! $tenantId) {
            $this->error('Por favor, informe o tenant ID usando --tenant=X');

            return 1;
        }

        $this->info("=== Verificando movimentações do tenant {$tenantId} ===");
        $this->newLine();

        // Todas as entradas (incluindo templates)
        $allEntries = FinanceEntry::where('tenant_id', $tenantId)->get();
        $this->line("Total de entradas (incluindo templates): {$allEntries->count()}");

        // Templates (is_recurring = true, parent_entry_id = null)
        $templates = FinanceEntry::where('tenant_id', $tenantId)
            ->where('is_recurring', true)
            ->whereNull('parent_entry_id')
            ->get();
        $this->line("Templates recorrentes: {$templates->count()}");

        // Parcelas (parent_entry_id não null)
        $installments = FinanceEntry::where('tenant_id', $tenantId)
            ->whereNotNull('parent_entry_id')
            ->get();
        $this->line("Parcelas geradas: {$installments->count()}");

        // Movimentações únicas (is_recurring = false, parent_entry_id = null)
        $single = FinanceEntry::where('tenant_id', $tenantId)
            ->where('is_recurring', false)
            ->whereNull('parent_entry_id')
            ->get();
        $this->line("Movimentações únicas: {$single->count()}");

        $this->newLine();

        // Mostrar últimas 10 entradas
        $this->info('Últimas 10 entradas:');
        $recent = FinanceEntry::where('tenant_id', $tenantId)
            ->orderBy('created_at', 'desc')
            ->limit(10)
            ->get();

        foreach ($recent as $entry) {
            $type = $entry->is_recurring ? 'TEMPLATE' : ($entry->parent_entry_id ? 'PARCELA' : 'ÚNICA');
            $this->line(sprintf(
                '  [%s] ID: %d | Valor: R$ %s | Data: %s | Descrição: %s',
                $type,
                $entry->id,
                number_format($entry->amount, 2, ',', '.'),
                $entry->occurred_on->format('d/m/Y'),
                $entry->description ?? $entry->reference ?? 'Sem descrição'
            ));
        }

        // Verificar templates sem parcelas (possível erro)
        $this->newLine();
        $this->info('Templates sem parcelas geradas (possível erro):');
        $brokenTemplates = FinanceEntry::where('tenant_id', $tenantId)
            ->where('is_recurring', true)
            ->whereDoesntHave('children')
            ->get();

        if ($brokenTemplates->isEmpty()) {
            $this->line('  Nenhum template sem parcelas encontrado.');
        } else {
            foreach ($brokenTemplates as $template) {
                $this->warn(sprintf(
                    '  ⚠️  Template ID: %d | Recorrência: %s | Data: %s | Descrição: %s',
                    $template->id,
                    $template->recurrence_type,
                    $template->occurred_on->format('d/m/Y'),
                    $template->description ?? $template->reference ?? 'Sem descrição'
                ));
            }
        }

        return 0;
    }
}
