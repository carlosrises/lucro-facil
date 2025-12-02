<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Polling iFood a cada 30 segundos (homologação - critério 2)
// Execute com: php artisan ifood:polling
// Ou mantenha rodando em background com supervisor/systemd

// Sincronização manual de pedidos (fallback)
Schedule::command('ifood:sync-orders')
    ->everyMinute()
    ->withoutOverlapping()
    ->runInBackground();

// Sincronização de vendas (relatório financeiro)
Schedule::command('ifood:sync-sales')
    ->everyMinute()
    ->withoutOverlapping()
    ->runInBackground();

// Sincronização histórica de vendas (retroativo - últimos 7 dias para garantir)
// Executa 1x por dia às 02:00 para pegar vendas que possam ter sido perdidas
Schedule::command('ifood:sync-historical-sales --from=-7days')
    ->dailyAt('02:00')
    ->withoutOverlapping()
    ->runInBackground();

// Gerar parcelas de movimentações financeiras recorrentes
// Executa diariamente às 03:00
Schedule::command('entries:generate-recurring')
    ->dailyAt('03:00')
    ->withoutOverlapping()
    ->runInBackground();
