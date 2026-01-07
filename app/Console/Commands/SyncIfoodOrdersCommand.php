<?php

namespace App\Console\Commands;

use App\Jobs\SyncOrdersJob;
use App\Models\Store;
use Illuminate\Console\Command;

class SyncIfoodOrdersCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'ifood:sync-orders';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Dispara a sincronização de pedidos do iFood para todas as lojas ativas';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $stores = Store::where('provider', 'ifood')->get();

        foreach ($stores as $store) {
            SyncOrdersJob::dispatch($store->tenant_id, $store->id)
                ->onQueue('ifood-sync');

            $this->info("Job enfileirado para loja {$store->id} (tenant {$store->tenant_id})");
        }

        return self::SUCCESS;
    }
}
