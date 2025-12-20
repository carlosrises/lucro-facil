<?php

namespace App\Console\Commands;

use App\Models\Store;
use App\Services\OrderCostService;
use App\Services\TakeatClient;
use Carbon\Carbon;
use Illuminate\Console\Command;

class SyncTakeatOrders extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'takeat:sync-orders
                            {--store-id= : ID específico da loja Takeat}
                            {--tenant-id= : ID do tenant}
                            {--hours=24 : Quantas horas para trás buscar pedidos (máximo 72)}
                            {--date= : Data específica para buscar (formato: Y-m-d, ex: 2025-12-08). Busca o dia inteiro}
                            {--dry-run : Simula a sincronização sem salvar no banco}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Sincroniza pedidos do Takeat manualmente';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $hours = min((int) $this->option('hours'), 72); // Máximo 72h (3 dias)
        $dryRun = $this->option('dry-run');
        $storeId = $this->option('store-id');
        $tenantId = $this->option('tenant-id');
        $specificDate = $this->option('date');

        $this->info("🔄 Iniciando sincronização Takeat");

        // Se data específica foi fornecida, usar dia inteiro (00:00 até 23:59:59)
        if ($specificDate) {
            try {
                $date = Carbon::parse($specificDate, 'America/Sao_Paulo');
                $startDate = $date->copy()->startOfDay()->setTimezone('UTC');
                $endDate = $date->copy()->endOfDay()->setTimezone('UTC');

                $this->info("📅 Buscando pedidos do dia: {$date->format('d/m/Y')}");
                $this->line("   Período BRT: {$date->copy()->startOfDay()->format('Y-m-d H:i:s')} até {$date->copy()->endOfDay()->format('Y-m-d H:i:s')}");
                $this->line("   Período UTC: {$startDate->toIso8601String()} até {$endDate->toIso8601String()}");
            } catch (\Exception $e) {
                $this->error("❌ Data inválida. Use o formato: Y-m-d (ex: 2025-12-08)");
                return 1;
            }
        } else {
            // Usar horas para trás (comportamento antigo)
            $endDate = Carbon::now('America/Sao_Paulo')->setTimezone('UTC');
            $startDate = $endDate->copy()->subHours($hours);
            $this->info("📅 Buscando pedidos das últimas {$hours} horas");
        }

        if ($dryRun) {
            $this->warn("⚠️  Modo DRY-RUN ativado - nenhum dado será salvo");
        }

        // Buscar lojas Takeat ativas
        $query = Store::where('provider', 'takeat')
            ->where('active', true)
            ->with('oauthToken');

        if ($storeId) {
            $query->where('id', $storeId);
        }

        if ($tenantId) {
            $query->where('tenant_id', $tenantId);
        }

        $stores = $query->get();

        if ($stores->isEmpty()) {
            $this->error("❌ Nenhuma loja Takeat ativa encontrada");
            return 1;
        }

        $this->info("🏪 Encontradas {$stores->count()} lojas Takeat");

        foreach ($stores as $store) {
            $this->line("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            $this->info("🏪 Loja: {$store->display_name} (ID: {$store->id})");

            if (!$store->oauthToken || $store->oauthToken->expires_at->isPast()) {
                $this->error("  ❌ Token expirado ou não encontrado. Faça login novamente.");
                continue;
            }

            $excludedChannels = $store->excluded_channels ?? [];
            if (!empty($excludedChannels)) {
                $this->warn("  ⚠️  Canais excluídos: " . implode(', ', $excludedChannels));
            }

            try {
                $client = new TakeatClient($store->tenant_id, $store->id);

                // As datas já foram calculadas no início do handle()
                if (!isset($startDate) || !isset($endDate)) {
                    $this->error("  ❌ Erro ao calcular período de datas");
                    continue;
                }

                $this->line("  📅 Período: {$startDate->toIso8601String()} até {$endDate->toIso8601String()}");

                // Buscar table_sessions
                $tableSessions = $client->getTableSessions(
                    $startDate->toIso8601String(),
                    $endDate->toIso8601String()
                );

                $sessionCount = count($tableSessions);
                $this->info("  📦 {$sessionCount} sessões encontradas");

                $totalOrders = 0;
                $filteredOrders = 0;
                $savedOrders = 0;

                foreach ($tableSessions as $session) {
                    foreach ($session['bills'] ?? [] as $bill) {
                        foreach ($bill['order_baskets'] ?? [] as $basket) {
                            $totalOrders++;

                            $channel = $basket['channel'] ?? 'unknown';

                            // Filtrar por excluded_channels
                            if (in_array($channel, $excludedChannels)) {
                                $this->line("  ⏩ Ignorando pedido do canal excluído: {$channel}");
                                continue;
                            }

                            $filteredOrders++;

                            if (!$dryRun) {
                                try {
                                    $this->processOrderBasket($basket, $session, $store);
                                    $savedOrders++;
                                } catch (\Throwable $e) {
                                    $this->error("  ❌ Erro ao salvar pedido: {$e->getMessage()}");
                                    logger()->error('Erro ao salvar pedido Takeat', [
                                        'basket_id' => $basket['basket_id'] ?? null,
                                        'error' => $e->getMessage(),
                                    ]);
                                }
                            }
                        }
                    }
                }

                $excluded = $totalOrders - $filteredOrders;
                $this->info("  ✅ Total de pedidos: {$totalOrders}");
                $this->info("  ⏩ Pedidos excluídos (canais filtrados): {$excluded}");
                $this->info("  💾 Pedidos a processar: {$filteredOrders}");

                if (!$dryRun) {
                    $this->info("  ✅ Pedidos salvos: {$savedOrders}");
                } else {
                    $this->warn("  ⚠️  Nenhum dado foi salvo (dry-run)");
                }

            } catch (\Throwable $e) {
                $this->error("  ❌ Erro: {$e->getMessage()}");
                logger()->error('Takeat sync failed', [
                    'store_id' => $store->id,
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString(),
                ]);
            }
        }

        $this->line("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        $this->info("✅ Sincronização concluída!");

        return 0;
    }

    /**
     * Processa e salva um order_basket do Takeat
     */
    protected function processOrderBasket(array $basket, array $session, \App\Models\Store $store): void
    {
        $basketId = $basket['basket_id'] ?? $basket['id'] ?? null;

        // Usar sales_channel (mais confiável) ao invés de channel
        // sales_channel tem a informação correta (IFOOD, 99FOOD, etc)
        // channel pode vir como "pdv" mesmo para pedidos de marketplace
        $origin = strtolower($session['sales_channel'] ?? $basket['channel'] ?? 'unknown');

        // Criar identificador único combinando session_id + basket_id
        $orderUuid = "takeat_{$session['id']}_{$basketId}";

        // Calcular totais
        // Se houver entrega, usar total_delivery_price que já inclui a taxa
        // Caso contrário, usar total_service_price ou total_price (só produtos)
        $hasDelivery = $session['is_delivery'] ?? false;
        $grossTotal = $hasDelivery && isset($session['total_delivery_price'])
            ? (float) $session['total_delivery_price']
            : (float) ($basket['total_service_price'] ?? $basket['total_price'] ?? 0);

        $deliveryFee = $hasDelivery ? (float) ($session['delivery_tax_price'] ?? 0) : 0;
        $discount = (float) ($session['discount_total'] ?? 0);

        // Calcular net_total baseado nos pagamentos reais (excluindo subsidiados)
        // Pagamentos subsidiados geralmente têm keywords como "subsidiado", "desconto", "cupom"
        $payments = $session['payments'] ?? [];
        $realPaymentTotal = 0;

        foreach ($payments as $payment) {
            $paymentName = strtolower($payment['payment_method']['name'] ?? '');
            $paymentKeyword = strtolower($payment['payment_method']['keyword'] ?? '');

            // Ignorar pagamentos subsidiados (cupons/descontos do marketplace)
            if (
                str_contains($paymentName, 'subsidiado') ||
                str_contains($paymentName, 'desconto') ||
                str_contains($paymentName, 'cupom') ||
                str_contains($paymentKeyword, 'subsidiado') ||
                str_contains($paymentKeyword, 'desconto') ||
                str_contains($paymentKeyword, 'cupom')
            ) {
                continue;
            }

            $realPaymentTotal += (float) ($payment['payment_value'] ?? 0);
        }

        // Se não houver pagamentos ou todos forem subsidiados, usar cálculo tradicional
        $netTotal = $realPaymentTotal > 0 ? $realPaymentTotal : ($grossTotal - $discount);

        // Status baseado no order_status e completed_at
        $status = $this->mapTakeatStatus($basket['order_status'] ?? null, $session['status'] ?? null);

        // Data do pedido
        $placedAt = \Carbon\Carbon::parse($basket['start_time'] ?? $session['start_time']);

        // Criar ou atualizar Order
        $order = \App\Models\Order::updateOrCreate(
            [
                'tenant_id' => $store->tenant_id,
                'order_uuid' => $orderUuid,
            ],
            [
                'store_id' => $store->id,
                'provider' => 'takeat',
                'code' => $basketId,
                'status' => $status,
                'origin' => $origin, // ifood, 99food, keeta, pdv, delivery, totem
                'gross_total' => $grossTotal,
                'discount_total' => $discount,
                'delivery_fee' => $deliveryFee,
                'tip' => 0, // Takeat não tem tip separado
                'net_total' => $netTotal,
                'placed_at' => $placedAt,
                'raw' => [
                    'session' => $session,
                    'basket' => $basket,
                ],
            ]
        );

        // Processar items (orders dentro do basket)
        $this->processOrderItems($order, $basket['orders'] ?? []);

        // Calcular custos e comissões automaticamente
        try {
            $costService = app(OrderCostService::class);
            $costService->applyAndSaveCosts($order->fresh());
        } catch (\Exception $e) {
            logger()->error('Erro ao calcular custos do pedido Takeat', [
                'order_id' => $order->id,
                'error' => $e->getMessage(),
            ]);
        }

        logger()->info('✅ Pedido Takeat salvo', [
            'order_id' => $order->id,
            'order_uuid' => $orderUuid,
            'basket_id' => $basketId,
            'origin' => $origin,
            'sales_channel' => $session['sales_channel'] ?? null,
            'basket_channel' => $basket['channel'] ?? null,
            'gross_total' => $grossTotal,
            'net_total' => $netTotal,
            'real_payment_total' => $realPaymentTotal,
            'payments_count' => count($payments),
        ]);
    }

    /**
     * Processa e salva os items de um pedido
     */
    protected function processOrderItems(\App\Models\Order $order, array $orders): void
    {
        // Limpar items anteriores para evitar duplicatas
        $order->items()->delete();

        foreach ($orders as $item) {
            // Pular items cancelados
            if (!empty($item['canceled_at'])) {
                continue;
            }

            $productId = $item['product']['id'] ?? null;
            $productName = $item['product']['name'] ?? 'Produto sem nome';
            $quantity = (int) ($item['amount'] ?? 1);
            $unitPrice = (float) ($item['price'] ?? 0);
            $totalPrice = (float) ($item['total_service_price'] ?? $item['total_price'] ?? 0);

            // Processar complementos
            $addOns = [];
            foreach ($item['complement_categories'] ?? [] as $category) {
                foreach ($category['order_complements'] ?? [] as $complement) {
                    $addOns[] = [
                        'name' => $complement['complement']['name'] ?? 'Complemento',
                        'quantity' => $complement['amount'] ?? 1,
                        'price' => 0, // Takeat não separa preço de complemento
                    ];
                }
            }

            \App\Models\OrderItem::create([
                'tenant_id' => $order->tenant_id,
                'order_id' => $order->id,
                'sku' => (string) $productId,
                'name' => $productName,
                'qty' => $quantity,
                'unit_price' => $unitPrice,
                'total' => $totalPrice,
                'add_ons' => $addOns,
            ]);
        }
    }

    /**
     * Mapeia status do Takeat para formato padrão
     */
    protected function mapTakeatStatus(?string $orderStatus, ?string $sessionStatus): string
    {
        // order_status: pending, confirmed, ready, delivered, finished, cancelled, canceled
        // session status: open, completed, finished, cancelled, canceled

        if (in_array($sessionStatus, ['cancelled', 'canceled']) ||
            in_array($orderStatus, ['cancelled', 'canceled'])) {
            return 'CANCELLED';
        }

        if ($sessionStatus === 'completed' || $sessionStatus === 'finished' ||
            $orderStatus === 'delivered' || $orderStatus === 'finished') {
            return 'CONCLUDED';
        }

        return match($orderStatus) {
            'pending' => 'PLACED',
            'confirmed' => 'CONFIRMED',
            'ready' => 'READY_TO_PICKUP',
            'delivered' => 'CONCLUDED',
            'finished' => 'CONCLUDED',
            default => 'PLACED',
        };
    }
}
