<?php

namespace App\Console\Commands;

use App\Jobs\RecalculateOrderCostsJob;
use App\Models\CostCommission;
use Illuminate\Console\Command;

class RecalculateCommission extends Command
{
    protected $signature = 'commission:recalculate {commissionId}';

    protected $description = 'Recalculate orders for a specific commission';

    public function handle()
    {
        $commissionId = $this->argument('commissionId');
        $commission = CostCommission::find($commissionId);

        if (! $commission) {
            $this->error("Commission {$commissionId} not found");

            return 1;
        }

        $this->info("Dispatching recalculation job for: {$commission->name}");
        $this->info("Provider: {$commission->provider}");
        $this->info("Applies to: {$commission->applies_to}");
        $this->info("Delivery by: {$commission->delivery_by}");

        RecalculateOrderCostsJob::dispatch(
            $commission->id,
            false, // applyToAll
            'cost_commission',
            null,
            null,
            true // onlySpecificCommission
        );

        $this->info("\n✅ Job dispatched! Running queue worker...");

        // Processar o job imediatamente
        $this->call('queue:work', [
            '--once' => true,
            '--queue' => 'default',
        ]);

        $this->info("\n✅ Job processed!");

        return 0;
    }
}
