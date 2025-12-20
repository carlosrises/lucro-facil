<?php

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use App\Models\Order;

echo "=== ORIGINS E PROVIDERS DISTINTOS ===\n\n";

$origins = Order::distinct()->pluck('origin')->filter();
$providers = Order::distinct()->pluck('provider')->filter();

echo "Providers:\n";
foreach ($providers as $provider) {
    echo "  - {$provider}\n";
}

echo "\nOrigins:\n";
foreach ($origins as $origin) {
    echo "  - {$origin}\n";
}

echo "\n=== CONTAGEM POR PROVIDER E ORIGIN ===\n\n";

$combinations = Order::selectRaw('provider, origin, COUNT(*) as total')
    ->groupBy('provider', 'origin')
    ->orderBy('total', 'desc')
    ->get();

foreach ($combinations as $combo) {
    echo "{$combo->provider} / {$combo->origin}: {$combo->total} pedidos\n";
}
