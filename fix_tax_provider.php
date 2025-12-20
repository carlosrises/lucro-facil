<?php

require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

echo "Corrigindo taxa com provider incorreto:\n";
echo "========================================\n\n";

$tax = \App\Models\CostCommission::find(24);

if ($tax && $tax->provider === 'takeat-takeat') {
    echo "Taxa encontrada: #{$tax->id} - {$tax->name}\n";
    echo "Provider atual: {$tax->provider}\n";

    $tax->provider = 'takeat';
    $tax->save();

    echo "Provider corrigido para: {$tax->provider}\n";
    echo "✓ Taxa corrigida!\n";
} else {
    echo "Taxa #24 não encontrada ou já está correta.\n";
}
