<?php

namespace App\Console\Commands;

use App\Jobs\SyncSalesJob;
use Illuminate\Console\Command;

class SyncIfoodSalesCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'ifood:sync-sales';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Dispara a sincronização de vendas do iFood para todos os tenants/lojas ativas';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        SyncSalesJob::dispatch()->onQueue('ifood-sync');
        $this->info('Job SyncSalesJob enfileirado para sincronizar vendas de todos os tenants/lojas iFood.');

        return self::SUCCESS;
    }
}
