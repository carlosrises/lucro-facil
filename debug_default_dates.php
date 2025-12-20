<?php

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make('Illuminate\Contracts\Console\Kernel');
$kernel->bootstrap();

use Carbon\Carbon;

echo "=== DIAGNÓSTICO DE DATAS PADRÃO ===\n\n";

$nowUtc = now();
$nowBrasilia = now('America/Sao_Paulo');

echo "now() [UTC]:\n";
echo "  Data/Hora: {$nowUtc->format('Y-m-d H:i:s')}\n";
echo "  Start of Month: {$nowUtc->copy()->startOfMonth()->format('Y-m-d')}\n";
echo "  End of Month: {$nowUtc->copy()->endOfMonth()->format('Y-m-d')}\n\n";

echo "now('America/Sao_Paulo') [Brasília]:\n";
echo "  Data/Hora: {$nowBrasilia->format('Y-m-d H:i:s')}\n";
echo "  Start of Month: {$nowBrasilia->copy()->startOfMonth()->format('Y-m-d')}\n";
echo "  End of Month: {$nowBrasilia->copy()->endOfMonth()->format('Y-m-d')}\n\n";

// Testar o que está sendo usado atualmente
$startDate = now()->startOfMonth()->format('Y-m-d');
$endDate = now()->endOfMonth()->format('Y-m-d');

echo "Valores atuais do código:\n";
echo "  start_date: {$startDate}\n";
echo "  end_date: {$endDate}\n";
