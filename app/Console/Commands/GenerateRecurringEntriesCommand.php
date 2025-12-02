<?php

namespace App\Console\Commands;

use App\Services\RecurringEntryService;
use Illuminate\Console\Command;

class GenerateRecurringEntriesCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'entries:generate-recurring';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Gera parcelas futuras de entradas financeiras recorrentes';

    /**
     * Execute the console command.
     */
    public function handle(RecurringEntryService $recurringService)
    {
        $this->info('Gerando parcelas recorrentes...');

        $recurringService->checkAndGenerateInstallments();

        $this->info('Parcelas recorrentes geradas com sucesso!');

        return Command::SUCCESS;
    }
}
