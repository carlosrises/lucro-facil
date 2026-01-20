<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class FixOrdersTimezone extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'orders:fix-timezone';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Converte placed_at de todos os pedidos de BRT para UTC';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('🔄 Iniciando conversão de timezone dos pedidos...');

        $orders = DB::table('orders')->whereNotNull('placed_at')->get(['id', 'placed_at']);
        $total = $orders->count();

        $this->info("📊 Total de pedidos a atualizar: {$total}");

        $bar = $this->output->createProgressBar($total);
        $bar->start();

        $updated = 0;

        foreach ($orders as $order) {
            // Assumir que placed_at está em BRT e converter para UTC
            $placedAtBrt = Carbon::parse($order->placed_at, 'America/Sao_Paulo');
            $placedAtUtc = $placedAtBrt->setTimezone('UTC');

            DB::table('orders')->where('id', $order->id)->update([
                'placed_at' => $placedAtUtc->toDateTimeString()
            ]);

            $updated++;
            $bar->advance();
        }

        $bar->finish();
        $this->newLine(2);

        $this->info("✅ Atualização concluída!");
        $this->info("📊 Total atualizado: {$updated} pedidos");

        return 0;
    }
}
