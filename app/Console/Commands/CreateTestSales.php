<?php

namespace App\Console\Commands;

use App\Models\Sale;
use App\Models\Store;
use Illuminate\Console\Command;

class CreateTestSales extends Command
{
    protected $signature = 'sales:create-test';
    protected $description = 'Create test sales data for development';

    public function handle()
    {
        $store = Store::where('provider', 'ifood')->first();

        if (!$store) {
            $this->error('No iFood store found. Create a store first.');
            return 1;
        }

        // Use o tenant_id da loja encontrada
        $tenantId = $store->tenant_id;

        $this->info('Creating test sales...');

        $testSales = [
            [
                'tenant_id' => $tenantId,
                'store_id' => $store->id,
                'sale_uuid' => 'TEST-001-' . time(),
                'short_id' => 'T001',
                'type' => 'DELIVERY',
                'category' => 'FOOD',
                'sales_channel' => 'IFOOD',
                'current_status' => 'CONCLUDED',
                'bag_value' => 4500, // R$ 45,00
                'delivery_fee' => 500, // R$ 5,00
                'service_fee' => 200, // R$ 2,00
                'gross_value' => 5200, // R$ 52,00
                'discount_value' => 0,
                'net_value' => 5200,
                'payment_method' => 'CREDIT',
                'payment_brand' => 'VISA',
                'payment_value' => 5200,
                'payment_liability' => 'MARKETPLACE',
                'sale_created_at' => now()->subHours(2),
                'concluded_at' => now()->subHours(1),
                'expected_payment_date' => now()->addDays(2),
                'raw' => json_encode([
                    'id' => 'TEST-001-' . time(),
                    'items' => [
                        [
                            'id' => 'item-1',
                            'name' => 'Hambúrguer Artesanal',
                            'quantity' => 1,
                            'unitPrice' => 2500,
                            'totalPrice' => 2500,
                            'options' => [
                                [
                                    'id' => 'opt-1',
                                    'name' => 'Ponto da Carne',
                                    'quantity' => 1,
                                    'unitPrice' => 0,
                                    'totalPrice' => 0,
                                    'customizations' => [
                                        [
                                            'id' => 'cust-1',
                                            'name' => 'Mal Passado',
                                            'quantity' => 1,
                                            'unitPrice' => 0,
                                            'totalPrice' => 0,
                                        ]
                                    ]
                                ]
                            ]
                        ],
                        [
                            'id' => 'item-2',
                            'name' => 'Batata Frita',
                            'quantity' => 1,
                            'unitPrice' => 1500,
                            'totalPrice' => 1500,
                        ],
                        [
                            'id' => 'item-3',
                            'name' => 'Refrigerante',
                            'quantity' => 1,
                            'unitPrice' => 500,
                            'totalPrice' => 500,
                        ]
                    ]
                ])
            ],
            [
                'tenant_id' => $tenantId,
                'store_id' => $store->id,
                'sale_uuid' => 'TEST-002-' . time(),
                'short_id' => 'T002',
                'type' => 'DELIVERY',
                'category' => 'FOOD',
                'sales_channel' => 'IFOOD',
                'current_status' => 'CANCELLED',
                'bag_value' => 3200,
                'delivery_fee' => 500,
                'service_fee' => 200,
                'gross_value' => 3900,
                'discount_value' => 500,
                'net_value' => 3400,
                'payment_method' => 'PIX',
                'payment_brand' => null,
                'payment_value' => 3400,
                'payment_liability' => 'MARKETPLACE',
                'sale_created_at' => now()->subHours(4),
                'concluded_at' => null,
                'expected_payment_date' => null,
                'raw' => json_encode([
                    'id' => 'TEST-002-' . time(),
                    'items' => [
                        [
                            'id' => 'item-4',
                            'name' => 'Pizza Margherita',
                            'quantity' => 1,
                            'unitPrice' => 3200,
                            'totalPrice' => 3200,
                        ]
                    ]
                ])
            ],
            [
                'tenant_id' => $tenantId,
                'store_id' => $store->id,
                'sale_uuid' => 'TEST-003-' . time(),
                'short_id' => 'T003',
                'type' => 'TAKEOUT',
                'category' => 'FOOD',
                'sales_channel' => 'IFOOD',
                'current_status' => 'CONFIRMED',
                'bag_value' => 2800,
                'delivery_fee' => 0,
                'service_fee' => 150,
                'gross_value' => 2950,
                'discount_value' => 200,
                'net_value' => 2750,
                'payment_method' => 'DEBIT',
                'payment_brand' => 'MASTERCARD',
                'payment_value' => 2750,
                'payment_liability' => 'MARKETPLACE',
                'sale_created_at' => now()->subMinutes(30),
                'concluded_at' => null,
                'expected_payment_date' => now()->addDays(1),
                'raw' => json_encode([
                    'id' => 'TEST-003-' . time(),
                    'items' => [
                        [
                            'id' => 'item-5',
                            'name' => 'Açaí 500ml',
                            'quantity' => 1,
                            'unitPrice' => 1800,
                            'totalPrice' => 1800,
                            'options' => [
                                [
                                    'id' => 'opt-2',
                                    'name' => 'Complementos',
                                    'quantity' => 1,
                                    'unitPrice' => 1000,
                                    'totalPrice' => 1000,
                                ]
                            ]
                        ]
                    ]
                ])
            ]
        ];

        foreach ($testSales as $saleData) {
            Sale::create($saleData);
        }

        $this->info('Created ' . count($testSales) . ' test sales successfully!');
        return 0;
    }
}
