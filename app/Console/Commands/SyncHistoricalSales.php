<?php

namespace App\Console\Commands;

use App\Models\Store;
use App\Services\IfoodClient;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Throwable;

class SyncHistoricalSales extends Command
{
    /**
     * @var string
     */
    protected $signature = 'ifood:sync-historical-sales
                            {--store= : ID da loja (opcional, se omitido sincroniza todas)}
                            {--from= : Data inicial (formato: Y-m-d, padrão: 30 dias atrás)}
                            {--to= : Data final (formato: Y-m-d, padrão: hoje)}
                            {--page-size=50 : Quantidade de vendas por página}
                            {--delay=1 : Delay em segundos entre requisições (evitar rate limit)}';

    /**
     * @var string
     */
    protected $description = 'Sincroniza vendas históricas do iFood (retroativo) sem duplicar';

    public function handle(): int
    {
        $this->info('🚀 Iniciando sincronização histórica de vendas...');

        // Parâmetros
        $storeIdFilter = $this->option('store');
        $from = $this->option('from') ?? now()->subDays(30)->toDateString();
        $to = $this->option('to') ?? now()->toDateString();
        $pageSize = (int) $this->option('page-size');
        $delay = (int) $this->option('delay');

        $this->info("📅 Período: {$from} até {$to}");
        $this->info("📄 Tamanho da página: {$pageSize}");
        $this->info("⏱️  Delay entre requisições: {$delay}s");

        // Busca lojas
        $storesQuery = Store::where('provider', 'ifood')->where('active', true);

        if ($storeIdFilter) {
            $storesQuery->where('id', $storeIdFilter);
        }

        $stores = $storesQuery->get();

        if ($stores->isEmpty()) {
            $this->error('❌ Nenhuma loja ativa encontrada');

            return Command::FAILURE;
        }

        $this->info("🏪 Lojas a sincronizar: {$stores->count()}");
        $this->newLine();

        $totalSynced = 0;
        $totalCreated = 0;
        $totalUpdated = 0;

        foreach ($stores as $store) {
            $this->info("🏪 Loja: {$store->name} (ID: {$store->id})");

            try {
                $result = $this->syncStoreHistoricalSales(
                    store: $store,
                    from: $from,
                    to: $to,
                    pageSize: $pageSize,
                    delay: $delay
                );

                $totalSynced += $result['synced'];
                $totalCreated += $result['created'];
                $totalUpdated += $result['updated'];

                $this->info("  ✅ {$result['synced']} vendas processadas ({$result['created']} novas, {$result['updated']} atualizadas)");
            } catch (Throwable $e) {
                $this->error("  ❌ Erro: {$e->getMessage()}");

                if ($this->option('verbose')) {
                    $this->error($e->getTraceAsString());
                }
            }

            $this->newLine();
        }

        $this->info('✅ Sincronização concluída!');
        $this->table(
            ['Métrica', 'Valor'],
            [
                ['Total Processado', $totalSynced],
                ['Novas Vendas', $totalCreated],
                ['Atualizadas', $totalUpdated],
            ]
        );

        return Command::SUCCESS;
    }

    /**
     * Sincroniza vendas históricas de uma loja específica
     */
    private function syncStoreHistoricalSales(
        Store $store,
        string $from,
        string $to,
        int $pageSize,
        int $delay
    ): array {
        $client = new IfoodClient($store->tenant_id, $store->id);
        $externalStoreId = $store->external_store_id;

        $page = 1;
        $hasNext = true;
        $synced = 0;
        $created = 0;
        $updated = 0;

        // Divide o período em chunks de 7 dias para evitar timeout
        $currentFrom = \Carbon\Carbon::parse($from);
        $finalTo = \Carbon\Carbon::parse($to);

        while ($currentFrom->lte($finalTo)) {
            $currentTo = $currentFrom->copy()->addDays(6);
            if ($currentTo->gt($finalTo)) {
                $currentTo = $finalTo->copy();
            }

            $this->line("  📅 Buscando: {$currentFrom->toDateString()} até {$currentTo->toDateString()}");

            $page = 1;
            $hasNext = true;

            while ($hasNext) {
                try {
                    $params = [
                        'beginSalesDate' => $currentFrom->toDateString(),
                        'endSalesDate' => $currentTo->toDateString(),
                        'page' => $page,
                        'size' => $pageSize,
                    ];

                    $response = $client->get(
                        "financial/v3.0/merchants/{$externalStoreId}/sales",
                        $params
                    );

                    $sales = $response['sales'] ?? [];

                    if (empty($sales)) {
                        $hasNext = false;
                        break;
                    }

                    $this->line("    📄 Página {$page}: ".count($sales).' vendas');

                    // Processa em transação
                    DB::transaction(function () use ($sales, $store, &$created, &$updated) {
                        foreach ($sales as $sale) {
                            $wasRecentlyCreated = $this->saveSale($sale, $store);

                            if ($wasRecentlyCreated) {
                                $created++;
                            } else {
                                $updated++;
                            }
                        }
                    });

                    $synced += count($sales);

                    // Verifica se há próxima página
                    $hasNext = count($sales) >= $pageSize;
                    $page++;

                    // Delay para evitar rate limit
                    if ($hasNext && $delay > 0) {
                        sleep($delay);
                    }

                } catch (Throwable $e) {
                    // Se 404, não há vendas neste período
                    if (str_contains($e->getMessage(), '404')) {
                        $hasNext = false;
                        break;
                    }

                    throw $e;
                }
            }

            // Avança para o próximo chunk
            $currentFrom = $currentTo->copy()->addDay();
        }

        return [
            'synced' => $synced,
            'created' => $created,
            'updated' => $updated,
        ];
    }

    /**
     * Salva ou atualiza uma venda no banco (com proteção contra duplicação)
     *
     * @return bool True se foi criada, false se foi atualizada
     */
    private function saveSale(array $sale, Store $store): bool
    {
        $billingEntries = $sale['billingSummary']['billingEntries'] ?? [];
        $expectedPaymentDate = null;

        // Busca data de pagamento esperada nos eventos
        foreach ($sale['orderEvents'] ?? [] as $ev) {
            if (($ev['fullCode'] ?? null) === 'FINANCIAL_BILLED_ORDER_ENTRY') {
                $expectedPaymentDate = data_get($ev, 'metadata.entries.0.expectedPaymentDate');
            }
        }

        // updateOrCreate com chave única (tenant_id + store_id + sale_uuid)
        $saleModel = \App\Models\Sale::updateOrCreate(
            [
                'tenant_id' => $store->tenant_id,
                'store_id' => $store->id,
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

        // Vincula Sale <-> Order se existir
        $orderUuid = $sale['id'] ?? null;
        if ($orderUuid && ! $saleModel->order_id) {
            $order = \App\Models\Order::where('tenant_id', $store->tenant_id)
                ->where('store_id', $store->id)
                ->where('order_uuid', $orderUuid)
                ->first();

            if ($order) {
                $saleModel->order_id = $order->id;
                $saleModel->save();
            }
        }

        return $saleModel->wasRecentlyCreated;
    }
}
