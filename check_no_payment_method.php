<?php

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Order;
use App\Services\OrderCostService;

$service = new OrderCostService;
$reflection = new \ReflectionClass($service);
$method = $reflection->getMethod('getOrderPaymentMethods');
$method->setAccessible(true);

echo "=== PEDIDOS SEM MÉTODO DE PAGAMENTO ===\n\n";

$orders = Order::where('tenant_id', 1)
    ->orderByDesc('id')
    ->limit(100)
    ->get(['id', 'code', 'provider', 'origin', 'raw', 'placed_at']);

$noPaymentMethod = [];

foreach ($orders as $order) {
    $detectedMethods = $method->invoke($service, $order);

    if (empty($detectedMethods)) {
        $noPaymentMethod[] = $order;
    }
}

echo "Total de pedidos verificados: {$orders->count()}\n";
echo 'Pedidos SEM método de pagamento: '.count($noPaymentMethod)."\n\n";

if (count($noPaymentMethod) > 0) {
    echo "Lista de pedidos sem método:\n";
    foreach ($noPaymentMethod as $order) {
        echo "\n--- Pedido #{$order->id} ({$order->code}) ---\n";
        echo "Provider: {$order->provider}\n";
        echo "Origin: {$order->origin}\n";
        echo "Data: {$order->placed_at}\n";

        // Tentar ver o que tem em payments
        if ($order->provider === 'takeat') {
            $payments = $order->raw['session']['payments'] ?? [];
            echo 'Payments encontrados: '.count($payments)."\n";
            foreach ($payments as $payment) {
                $method = $payment['payment_method']['method'] ?? 'N/A';
                $keyword = $payment['payment_method']['keyword'] ?? 'N/A';
                $name = $payment['payment_method']['name'] ?? 'N/A';
                echo "  Method: $method | Keyword: $keyword | Name: $name\n";
            }
        } elseif ($order->provider === 'ifood') {
            $payments = $order->raw['payments']['methods'] ?? [];
            echo 'Payments encontrados: '.count($payments)."\n";
            foreach ($payments as $payment) {
                $method = $payment['method'] ?? 'N/A';
                $value = $payment['value'] ?? 0;
                echo "  Method: $method | Value: $value\n";
            }
        }
    }
} else {
    echo "✓ Todos os pedidos têm método de pagamento detectado!\n";
}
