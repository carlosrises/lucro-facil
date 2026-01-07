<?php

namespace App\Console\Commands;

use App\Models\Order;
use Illuminate\Console\Command;

class FixTakeatOrigins extends Command
{
    protected $signature = 'takeat:fix-origins';

    protected $description = 'Atualiza o campo origin dos pedidos Takeat baseado no sales_channel do raw';

    public function handle()
    {
        $this->info('🔄 Atualizando origin dos pedidos Takeat...');

        $orders = Order::where('provider', 'takeat')
            ->whereNotNull('raw')
            ->get();

        $updated = 0;

        foreach ($orders as $order) {
            $raw = $order->raw;

            if (! isset($raw['session'])) {
                continue;
            }

            $session = $raw['session'];
            $basket = $raw['basket'] ?? [];

            // Usar sales_channel (mais confiável) ao invés de channel
            $newOrigin = strtolower($session['sales_channel'] ?? $basket['channel'] ?? 'unknown');

            if ($order->origin !== $newOrigin) {
                $this->line("Pedido #{$order->id}: {$order->origin} → {$newOrigin}");
                $order->update(['origin' => $newOrigin]);
                $updated++;
            }
        }

        $this->info("✅ {$updated} pedidos atualizados!");

        return 0;
    }
}
