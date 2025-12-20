<?php

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\CostCommission;

echo "=== TODAS AS TAXAS DE PAGAMENTO ATIVAS ===\n";
$taxes = CostCommission::where('tenant_id', 1)
    ->where('active', true)
    ->where('category', 'payment_method')
    ->get(['id', 'name', 'provider', 'payment_type', 'condition_values']);

foreach ($taxes as $tax) {
    echo "ID: {$tax->id}\n";
    echo "Nome: {$tax->name}\n";
    echo "Provider: {$tax->provider}\n";
    echo "Payment Type: {$tax->payment_type}\n";
    echo "Condition Values: " . json_encode($tax->condition_values) . "\n";
    echo "---\n";
}
