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

// DESATIVADO TEMPORARIAMENTE - iFood
// Sincronização manual de pedidos (fallback)
// Schedule::command('ifood:sync-orders')
//     ->everyMinute()
//     ->withoutOverlapping()
//     ->runInBackground();

// DESATIVADO TEMPORARIAMENTE - iFood
// Sincronização de vendas (relatório financeiro)
// Schedule::command('ifood:sync-sales')
//     ->everyMinute()
//     ->withoutOverlapping()
//     ->runInBackground();

// DESATIVADO TEMPORARIAMENTE - iFood
// Sincronização histórica de vendas (retroativo - últimos 7 dias para garantir)
// Executa 2x por dia às 02:00 e 17:00 de Brasília para pegar vendas que possam ter sido perdidas
// Schedule::command('ifood:sync-historical-sales --from=-7days')
//     ->dailyAt('02:00')
//     ->timezone('America/Sao_Paulo')
//     ->withoutOverlapping()
//     ->runInBackground();

// Schedule::command('ifood:sync-historical-sales --from=-7days')
//     ->dailyAt('17:00')
//     ->timezone('America/Sao_Paulo')
//     ->withoutOverlapping()
//     ->runInBackground();

// Sincronização de pedidos Takeat
// Executa 2x por dia às 02:00 e 17:00 de Brasília para sincronizar pedidos do dia anterior
Schedule::command('takeat:sync-orders --date=yesterday')
    ->dailyAt('02:00')
    ->timezone('America/Sao_Paulo')
    ->withoutOverlapping()
    ->runInBackground();

Schedule::command('takeat:sync-orders --date=yesterday')
    ->dailyAt('17:00')
    ->timezone('America/Sao_Paulo')
    ->withoutOverlapping()
    ->runInBackground();

// Gerar parcelas de movimentações financeiras recorrentes
// Executa diariamente às 03:00
Schedule::command('entries:generate-recurring')
    ->dailyAt('03:00')
    ->timezone('America/Sao_Paulo')
    ->withoutOverlapping()
    ->runInBackground();

// Verificar e alertar sobre tokens próximos de expirar
// Executa diariamente às 08:00 de Brasília
Schedule::job(new \App\Jobs\RefreshTakeatTokensJob)
    ->dailyAt('08:00')
    ->timezone('America/Sao_Paulo')
    ->withoutOverlapping();
