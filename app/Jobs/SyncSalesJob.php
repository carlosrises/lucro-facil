<?php

namespace App\Jobs;

use App\Models\Sale;
use App\Models\Store;
use App\Services\IfoodClient;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Throwable;

class SyncSalesJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * Executa a sincronização de vendas para todos os tenants com integração ativa.
     * Este job deve ser agendado para rodar frequentemente (ex: a cada 2 minutos).
     */
    public function handle(): void
    {
        try {
            // logger()->info('🚀 Iniciando SyncSalesJob (multi-tenant)');

            // Busca todas as lojas integradas ao iFood (provider = 'ifood')
            $stores = Store::where('provider', 'ifood')
                ->where('active', true)
                ->get();

            foreach ($stores as $store) {
                $tenantId = $store->tenant_id;
                $storeId = $store->id;
                $externalStoreId = $store->external_store_id;
                $client = new IfoodClient($tenantId, $storeId);

                $from = now()->subMinutes(10)->toDateString(); // janela curta para minimizar atraso
                $to = now()->toDateString();

                $page = 1;
                $size = 50;
                $hasNext = true;

                try {
                    while ($hasNext) {
                        $params = [
                            'beginSalesDate' => $from,
                            'endSalesDate' => $to,
                            'page' => $page,
                            'size' => $size,
                        ];
                        $headers = [
                            // 'x-request-homologation' => 'true', // header para ambiente de homologação
                        ];

                        try {
                            $response = $client->get("financial/v3.0/merchants/{$externalStoreId}/sales", $params, $headers);
                            $sales = $response['sales'] ?? [];
                        } catch (Throwable $e) {
                            // Se 404, considera como resultado vazio (sem vendas no período)
                            if (str_contains($e->getMessage(), '404')) {
                                // logger()->info('📊 Nenhuma venda encontrada (404)', [
                                //     'tenant_id' => $tenantId,
                                //     'store_id' => $storeId,
                                //     'page' => $page,
                                // ]);
                                $sales = [];
                            } else {
                                throw $e; // Re-lança outros erros
                            }
                        }

                        // logger()->info('📊 Sales recebidos', [
                        //     'tenant_id' => $tenantId,
                        //     'store_id' => $storeId,
                        //     'page' => $page,
                        //     'qtd' => count($sales),
                        // ]);

                        DB::transaction(function () use ($sales, $tenantId, $storeId) {
                            foreach ($sales as $sale) {
                                $billingEntries = $sale['billingSummary']['billingEntries'] ?? [];
                                $expectedPaymentDate = null;

                                foreach ($sale['orderEvents'] ?? [] as $ev) {
                                    if (($ev['fullCode'] ?? null) === 'FINANCIAL_BILLED_ORDER_ENTRY') {
                                        $expectedPaymentDate = data_get($ev, 'metadata.entries.0.expectedPaymentDate');
                                    }
                                }

                                // Salva Sale
                                $saleModel = Sale::updateOrCreate(
                                    [
                                        'tenant_id' => $tenantId,
                                        'store_id' => $storeId,
                                        'sale_uuid' => $sale['id'],
                                    ],
                                    [
                                        'short_id' => $sale['shortId'] ?? null,
                                        'type' => $sale['type'] ?? null,
                                        'category' => $sale['category'] ?? null,
                                        'sales_channel' => $sale['salesChannel'] ?? null,
                                        'current_status' => $sale['currentStatus'] ?? null,

                                        'bag_value' => data_get($sale, 'saleGrossValue.bag'),
                                        'delivery_fee' => data_get($sale, 'saleGrossValue.deliveryFee'),
                                        'service_fee' => data_get($sale, 'saleGrossValue.serviceFee'),

                                        'gross_value' => data_get($sale, 'billingSummary.saleBalance'),
                                        'discount_value' => data_get($sale, 'billingSummary.discount'),
                                        'net_value' => data_get($sale, 'billingSummary.saleBalance'),

                                        'payment_method' => data_get($sale, 'payments.methods.0.method'),
                                        'payment_brand' => data_get($sale, 'payments.methods.0.card.brand'),
                                        'payment_value' => data_get($sale, 'payments.methods.0.value'),
                                        'payment_liability' => data_get($sale, 'payments.methods.0.liability'),

                                        'sale_created_at' => data_get($sale, 'createdAt'),
                                        'concluded_at' => collect($sale['orderStatusHistory'] ?? [])
                                            ->firstWhere('value', 'CONCLUDED')['createdAt'] ?? null,
                                        'expected_payment_date' => $expectedPaymentDate,

                                        'raw' => $sale,
                                    ]
                                );

                                // Vincula Sale <-> Order
                                $orderUuid = $sale['id'] ?? null;
                                if ($orderUuid) {
                                    $order = \App\Models\Order::where('tenant_id', $tenantId)
                                        ->where('store_id', $storeId)
                                        ->where('order_uuid', $orderUuid)
                                        ->first();
                                    if ($order) {
                                        $saleModel->order_id = $order->id;
                                        $saleModel->save();
                                    }
                                }
                            }
                        });

                        // Se recebeu 404, não há mais páginas (sem vendas)
                        $hasNext = ! empty($sales) && count($sales) >= $size;
                        $page++;
                    }
                } catch (Throwable $e) {
                    // Se erro de token, desativa loja
                    if (str_contains($e->getMessage(), 'token') || str_contains($e->getMessage(), '401')) {
                        $store->active = false;
                        $store->save();
                        logger()->warning('Loja desativada por erro de token iFood', [
                            'store_id' => $storeId,
                            'tenant_id' => $tenantId,
                            'error' => $e->getMessage(),
                        ]);
                    }
                    throw $e;
                }
            }

            // logger()->info('✅ SyncSalesJob multi-tenant concluído');
        } catch (Throwable $e) {
            logger()->error('❌ Erro na sync de Sales iFood', [
                'error' => $e->getMessage(),
            ]);
            throw $e;
        }
    }
}
