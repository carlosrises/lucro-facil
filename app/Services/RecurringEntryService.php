<?php

namespace App\Services;

use App\Models\FinanceEntry;
use Carbon\Carbon;

class RecurringEntryService
{
    /**
     * Criar entrada recorrente e gerar parcelas futuras
     */
    public function createRecurringEntry(array $data): FinanceEntry
    {
        // Criar a entrada template (pai)
        $data['is_recurring'] = true;
        $data['parent_entry_id'] = null;
        $data['installment_number'] = null;

        $template = FinanceEntry::create($data);

        // Calcular quantas parcelas gerar até a data limite
        $count = $this->calculateInstallmentsCount($template);

        // Gerar parcelas
        $this->generateInstallments($template, $count);

        return $template;
    }

    /**
     * Gerar parcelas futuras de uma entrada recorrente
     */
    public function generateInstallments(FinanceEntry $template, int $count = 6): void
    {
        if (! $template->is_recurring || $template->parent_entry_id !== null) {
            return; // Só gera parcelas de templates
        }

        // Buscar última parcela gerada
        $lastInstallment = FinanceEntry::where('parent_entry_id', $template->id)
            ->orderBy('installment_number', 'desc')
            ->first();

        $startNumber = $lastInstallment ? $lastInstallment->installment_number + 1 : 1;

        // Se é a primeira parcela, usar a data do template, senão calcular a próxima
        $currentDate = $lastInstallment
            ? Carbon::parse($lastInstallment->occurred_on)
            : Carbon::parse($template->occurred_on);

        for ($i = 0; $i < $count; $i++) {
            $installmentNumber = $startNumber + $i;

            // Se não é a primeira parcela, calcular próxima data
            if ($lastInstallment || $i > 0) {
                $nextDate = $this->calculateNextDate($currentDate, $template->recurrence_type);
            } else {
                // Primeira parcela usa a data do template
                $nextDate = $currentDate->copy();
            }

            // Verificar se passou da data limite
            if ($template->recurrence_end_date && $nextDate->gt(Carbon::parse($template->recurrence_end_date))) {
                break;
            }

            // Ajustar para o próximo dia útil se necessário
            if ($template->consider_business_days) {
                $nextDate = $this->adjustToNextBusinessDay($nextDate);
            }

            // Criar parcela
            $installmentData = $template->toArray();
            unset($installmentData['id'], $installmentData['created_at'], $installmentData['updated_at']);

            $installmentData['is_recurring'] = false;
            $installmentData['parent_entry_id'] = $template->id;
            $installmentData['installment_number'] = $installmentNumber;
            $installmentData['occurred_on'] = $nextDate->format('Y-m-d');
            $installmentData['due_date'] = $nextDate->format('Y-m-d');
            $installmentData['competence_date'] = $nextDate->format('Y-m-d');
            $installmentData['status'] = 'pending';
            $installmentData['paid_at'] = null;

            FinanceEntry::create($installmentData);

            $currentDate = $nextDate;
        }
    }

    /**
     * Calcular próxima data baseado no tipo de recorrência
     */
    private function calculateNextDate(Carbon $currentDate, string $recurrenceType): Carbon
    {
        return match ($recurrenceType) {
            'weekly' => $currentDate->copy()->addWeek(),
            'biweekly' => $currentDate->copy()->addWeeks(2),
            'monthly' => $currentDate->copy()->addMonth(),
            'bimonthly' => $currentDate->copy()->addMonths(2),
            'quarterly' => $currentDate->copy()->addMonths(3),
            'semiannual' => $currentDate->copy()->addMonths(6),
            'annual' => $currentDate->copy()->addYear(),
            default => $currentDate->copy()->addMonth(),
        };
    }

    /**
     * Ajustar data para o próximo dia útil (pula fins de semana)
     */
    private function adjustToNextBusinessDay(Carbon $date): Carbon
    {
        $adjusted = $date->copy();

        // Se é sábado (6), avança para segunda-feira
        if ($adjusted->dayOfWeek === Carbon::SATURDAY) {
            $adjusted->addDays(2);
        }
        // Se é domingo (0), avança para segunda-feira
        elseif ($adjusted->dayOfWeek === Carbon::SUNDAY) {
            $adjusted->addDay();
        }

        return $adjusted;
    }

    /**
     * Atualizar template e regenerar parcelas futuras não pagas
     */
    public function updateRecurringEntry(FinanceEntry $template, array $data): void
    {
        if (! $template->is_recurring || $template->parent_entry_id !== null) {
            return;
        }

        $template->update($data);

        // Deletar parcelas futuras não pagas
        FinanceEntry::where('parent_entry_id', $template->id)
            ->where('status', 'pending')
            ->where('occurred_on', '>', now()->format('Y-m-d'))
            ->delete();

        // Calcular quantas parcelas gerar até a data limite
        $count = $this->calculateInstallmentsCount($template);

        // Regenerar parcelas
        $this->generateInstallments($template, $count);
    }

    /**
     * Calcular número de parcelas necessárias até a data limite
     */
    private function calculateInstallmentsCount(FinanceEntry $template): int
    {
        if (!$template->recurrence_end_date) {
            return 12; // Sem limite, gera 12 parcelas (1 ano)
        }

        // Buscar última parcela gerada
        $lastInstallment = FinanceEntry::where('parent_entry_id', $template->id)
            ->orderBy('installment_number', 'desc')
            ->first();

        $startDate = $lastInstallment
            ? Carbon::parse($lastInstallment->occurred_on)
            : Carbon::parse($template->occurred_on);

        $endDate = Carbon::parse($template->recurrence_end_date);

        // Calcular diferença aproximada baseada no tipo de recorrência
        $diffInDays = $startDate->diffInDays($endDate);

        $estimatedCount = match ($template->recurrence_type) {
            'weekly' => ceil($diffInDays / 7),
            'biweekly' => ceil($diffInDays / 14),
            'monthly' => ceil($diffInDays / 30),
            'bimonthly' => ceil($diffInDays / 60),
            'quarterly' => ceil($diffInDays / 90),
            'semiannual' => ceil($diffInDays / 180),
            'annual' => ceil($diffInDays / 365),
            default => ceil($diffInDays / 30),
        };

        // Adicionar 1 para incluir a primeira parcela e limitar a um máximo razoável
        return min((int)$estimatedCount + 1, 100);
    }

    /**
     * Verificar e gerar novas parcelas se necessário
     */
    public function checkAndGenerateInstallments(): void
    {
        // Buscar todos os templates ativos
        $templates = FinanceEntry::where('is_recurring', true)
            ->whereNull('parent_entry_id')
            ->where(function ($query) {
                $query->whereNull('recurrence_end_date')
                    ->orWhere('recurrence_end_date', '>=', now()->format('Y-m-d'));
            })
            ->get();

        foreach ($templates as $template) {
            // Contar parcelas futuras
            $futureInstallmentsCount = FinanceEntry::where('parent_entry_id', $template->id)
                ->where('occurred_on', '>', now()->format('Y-m-d'))
                ->count();

            // Se tiver menos de 3 parcelas futuras, gerar mais
            if ($futureInstallmentsCount < 3) {
                $this->generateInstallments($template, 6 - $futureInstallmentsCount);
            }
        }
    }
}
