<?php

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\CostCommission;

echo "=== TESTE DE SCOPE forProvider ===\n\n";

echo "Buscando taxas com forProvider('takeat', 'neemo'):\n";
$taxes = CostCommission::where('tenant_id', 1)
    ->active()
    ->forProvider('takeat', 'neemo')
    ->get(['id', 'name', 'provider']);

echo "Total encontrado: {$taxes->count()}\n";
foreach ($taxes as $tax) {
    echo "- ID {$tax->id}: {$tax->name} (provider: {$tax->provider})\n";
}

echo "\n\nBuscando taxas diretamente com provider='takeat-neemo':\n";
$taxes2 = CostCommission::where('tenant_id', 1)
    ->active()
    ->where('provider', 'takeat-neemo')
    ->get(['id', 'name', 'provider']);

echo "Total encontrado: {$taxes2->count()}\n";
foreach ($taxes2 as $tax) {
    echo "- ID {$tax->id}: {$tax->name} (provider: {$tax->provider})\n";
}
