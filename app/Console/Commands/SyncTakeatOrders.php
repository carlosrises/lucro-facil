<?php

namespace App\Console\Commands;

use App\Models\InternalProduct;
use App\Models\OrderItemMapping;
use App\Models\ProductMapping;
use App\Models\Store;
use App\Services\FlavorMappingService;
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

        $this->info('🔄 Iniciando sincronização Takeat');

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
                $this->error('❌ Data inválida. Use o formato: Y-m-d (ex: 2025-12-08)');

                return 1;
            }
        } else {
            // Usar horas para trás (comportamento antigo)
            $endDate = Carbon::now('America/Sao_Paulo')->setTimezone('UTC');
            $startDate = $endDate->copy()->subHours($hours);
            $this->info("📅 Buscando pedidos das últimas {$hours} horas");
        }

        if ($dryRun) {
            $this->warn('⚠️  Modo DRY-RUN ativado - nenhum dado será salvo');
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
            $this->error('❌ Nenhuma loja Takeat ativa encontrada');

            return 1;
        }

        $this->info("🏪 Encontradas {$stores->count()} lojas Takeat");

        foreach ($stores as $store) {
            $this->line('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            $this->info("🏪 Loja: {$store->display_name} (ID: {$store->id})");

            if (! $store->oauthToken || $store->oauthToken->expires_at->isPast()) {
                $this->error('  ❌ Token expirado ou não encontrado. Faça login novamente.');

                continue;
            }

            $excludedChannels = $store->excluded_channels ?? [];
            if (! empty($excludedChannels)) {
                $this->warn('  ⚠️  Canais excluídos: '.implode(', ', $excludedChannels));
            }

            try {
                $client = new TakeatClient($store->tenant_id, $store->id);

                // As datas já foram calculadas no início do handle()
                if (! isset($startDate) || ! isset($endDate)) {
                    $this->error('  ❌ Erro ao calcular período de datas');

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

                logger()->info('📦 Iniciando processamento de sessões', [
                    'store_id' => $store->id,
                    'session_count' => $sessionCount,
                ]);

                foreach ($tableSessions as $sessionIndex => $session) {
                    logger()->info('🔄 Processando sessão', [
                        'session_index' => $sessionIndex + 1,
                        'session_id' => $session['id'] ?? 'unknown',
                        'bills_count' => count($session['bills'] ?? []),
                    ]);

                    foreach ($session['bills'] ?? [] as $billIndex => $bill) {
                        logger()->info('📄 Processando bill', [
                            'bill_index' => $billIndex + 1,
                            'baskets_count' => count($bill['order_baskets'] ?? []),
                        ]);

                        foreach ($bill['order_baskets'] ?? [] as $basketIndex => $basket) {
                            $totalOrders++;
                            $basketId = $basket['basket_id'] ?? $basket['id'] ?? 'unknown';

                            logger()->info('🛒 Processando basket', [
                                'basket_index' => $basketIndex + 1,
                                'basket_id' => $basketId,
                                'total_orders_so_far' => $totalOrders,
                            ]);

                            $channel = $basket['channel'] ?? 'unknown';

                            // Filtrar por excluded_channels
                            if (in_array($channel, $excludedChannels)) {
                                $this->line("  ⏩ Ignorando pedido do canal excluído: {$channel}");
                                logger()->info('⏩ Pedido ignorado (canal excluído)', [
                                    'basket_id' => $basketId,
                                    'channel' => $channel,
                                ]);

                                continue;
                            }

                            $filteredOrders++;

                            if (! $dryRun) {
                                try {
                                    logger()->info('💾 Salvando pedido', ['basket_id' => $basketId]);
                                    $this->processOrderBasket($basket, $session, $store);
                                    $savedOrders++;
                                    logger()->info('✅ Pedido salvo com sucesso', [
                                        'basket_id' => $basketId,
                                        'saved_count' => $savedOrders,
                                    ]);
                                } catch (\Throwable $e) {
                                    $this->error("  ❌ Erro ao salvar pedido: {$e->getMessage()}");
                                    logger()->error('Erro ao salvar pedido Takeat', [
                                        'basket_id' => $basketId,
                                        'error' => $e->getMessage(),
                                        'trace' => $e->getTraceAsString(),
                                    ]);
                                }
                            }
                        }

                        logger()->info('✅ Bill processada', ['bill_index' => $billIndex + 1]);
                    }

                    logger()->info('✅ Sessão processada', ['session_index' => $sessionIndex + 1]);
                }

                logger()->info('🎉 Todas as sessões processadas', [
                    'store_id' => $store->id,
                    'total_orders' => $totalOrders,
                    'saved_orders' => $savedOrders,
                ]);

                $excluded = $totalOrders - $filteredOrders;
                $this->info("  ✅ Total de pedidos: {$totalOrders}");
                $this->info("  ⏩ Pedidos excluídos (canais filtrados): {$excluded}");
                $this->info("  💾 Pedidos a processar: {$filteredOrders}");

                if (! $dryRun) {
                    $this->info("  ✅ Pedidos salvos: {$savedOrders}");
                } else {
                    $this->warn('  ⚠️  Nenhum dado foi salvo (dry-run)');
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

        $this->line('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        $this->info('✅ Sincronização concluída!');

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

        // Data do pedido - Takeat retorna start_time já em BRT (America/Sao_Paulo)
        // Precisamos converter para UTC antes de salvar no banco
        $placedAt = \Carbon\Carbon::parse($basket['start_time'] ?? $session['start_time'], 'America/Sao_Paulo')
            ->setTimezone('UTC');

        // Criar ou atualizar Order
        $existingOrder = \App\Models\Order::where('tenant_id', $store->tenant_id)
            ->where('order_uuid', $orderUuid)
            ->exists();

        $order = \App\Models\Order::updateOrCreate(
            [
                'tenant_id' => $store->tenant_id,
                'order_uuid' => $orderUuid,
            ],
            [
                'store_id' => $store->id,
                'provider' => 'takeat',
                'code' => $basketId,
                'short_reference' => $session['attendance_password'] ?? null, // Número sequencial diário (#1, #2, #3...)
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

        // Disparar evento de novo pedido se foi criado agora
        if (! $existingOrder) {
            // \Log::info('🚀 [WebSocket] Disparando evento OrderCreated (Takeat)', [
            //     'tenant_id' => $store->tenant_id,
            //     'order_id' => $order->id,
            //     'order_code' => $order->code,
            //     'provider' => $order->provider,
            //     'origin' => $order->origin,
            //     'channel' => "orders.tenant.{$store->tenant_id}",
            //     'broadcast_driver' => config('broadcasting.default'),
            // ]);
            event(new \App\Events\OrderCreated($order));
        }

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
            if (! empty($item['canceled_at'])) {
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

            $orderItem = \App\Models\OrderItem::create([
                'tenant_id' => $order->tenant_id,
                'order_id' => $order->id,
                'sku' => (string) $productId,
                'name' => $productName,
                'qty' => $quantity,
                'unit_price' => $unitPrice,
                'total' => $totalPrice,
                'add_ons' => $addOns,
            ]);

            // Auto-aplicar mapeamento se existir ProductMapping para este SKU
            $this->autoApplyMappings($orderItem);
        }
    }

    /**
     * Auto-aplicar mapeamentos ao OrderItem baseado em ProductMapping
     */
    protected function autoApplyMappings(\App\Models\OrderItem $orderItem): void
    {
        logger()->info('🔍 Iniciando auto-apply mappings', [
            'order_item_id' => $orderItem->id,
            'sku' => $orderItem->sku,
            'name' => $orderItem->name,
        ]);

        // Buscar ProductMapping pelo SKU
        $productMapping = ProductMapping::where('tenant_id', $orderItem->tenant_id)
            ->where('external_item_id', $orderItem->sku)
            ->first();

        if (! $productMapping || ! $productMapping->internal_product_id) {
            logger()->info('⏩ Sem mapeamento configurado', ['sku' => $orderItem->sku]);

            return; // Sem mapeamento configurado
        }

        logger()->info('✅ Mapeamento principal encontrado', [
            'mapping_id' => $productMapping->id,
            'product_id' => $productMapping->internal_product_id,
        ]);

        // Buscar o produto interno para calcular CMV correto
        $product = InternalProduct::find($productMapping->internal_product_id);
        $correctCMV = $product ? $this->calculateCorrectCMV($product, $orderItem) : null;

        logger()->info('💰 CMV calculado', ['cmv' => $correctCMV]);

        // Criar OrderItemMapping principal
        OrderItemMapping::create([
            'tenant_id' => $orderItem->tenant_id,
            'order_item_id' => $orderItem->id,
            'internal_product_id' => $productMapping->internal_product_id,
            'quantity' => 1.0,
            'mapping_type' => 'main',
            'option_type' => 'regular',
            'auto_fraction' => false,
            'unit_cost_override' => $correctCMV,
        ]);

        logger()->info('✅ Mapping principal criado');

        // Auto-mapear complementos (add_ons) se houverem
        $addOns = $orderItem->add_ons ?? [];
        logger()->info('🔍 Processando add-ons', ['count' => count($addOns)]);

        $hasFlavors = false; // Flag para detectar se há sabores

        foreach ($addOns as $index => $addOn) {
            $addonName = $addOn['name'] ?? '';
            if (! $addonName) {
                continue;
            }

            logger()->info('🔍 Processando add-on', [
                'index' => $index,
                'name' => $addonName,
            ]);

            // Criar SKU único para o add-on baseado no nome (mesmo padrão da Triagem)
            $addonSku = 'addon_'.md5($addonName);

            // Tentar encontrar mapeamento para o complemento
            $addonMapping = ProductMapping::where('tenant_id', $orderItem->tenant_id)
                ->where('external_item_id', $addonSku)
                ->first();

            // Se não existe ProductMapping, criar um pendente
            // O vínculo será feito manualmente na Triagem
            if (! $addonMapping) {
                // Detectar automaticamente se é sabor baseado no contexto
                $isPizza = $this->isPizzaItem($orderItem);
                $detectedItemType = $isPizza ? 'flavor' : 'beverage';

                logger()->info('📝 Criando ProductMapping pendente para add-on', [
                    'name' => $addonName,
                    'sku' => $addonSku,
                    'detected_type' => $detectedItemType,
                    'is_pizza' => $isPizza,
                ]);

                $addonMapping = ProductMapping::firstOrCreate(
                    [
                        'tenant_id' => $orderItem->tenant_id,
                        'external_item_id' => $addonSku,
                    ],
                    [
                        'external_item_name' => $addonName,
                        'item_type' => $detectedItemType,
                        'internal_product_id' => null, // Pendente - será vinculado na Triagem
                        'provider' => 'takeat',
                    ]
                );
            }

            // Processar add-on baseado no tipo e se tem produto vinculado
            if ($addonMapping->item_type === 'flavor') {
                // Para sabores, marcar flag para processar depois via FlavorMappingService
                $hasFlavors = true;
                logger()->info('🍕 Sabor detectado, será processado via FlavorMappingService', [
                    'name' => $addonName,
                    'product_id' => $addonMapping->internal_product_id,
                    'has_product' => $addonMapping->internal_product_id !== null,
                ]);
            } elseif ($addonMapping->internal_product_id) {
                // Para add-ons não-sabor COM produto vinculado, criar OrderItemMapping
                // MESMA LÓGICA DA TRIAGEM (applyMappingToHistoricalOrders)
                $addonQty = $addOn['quantity'] ?? 1;

                // Buscar produto do addon para calcular CMV
                $addonProduct = InternalProduct::find($addonMapping->internal_product_id);
                $addonCMV = $addonProduct ? $this->calculateCorrectCMV($addonProduct, $orderItem) : null;

                OrderItemMapping::create([
                    'tenant_id' => $orderItem->tenant_id,
                    'order_item_id' => $orderItem->id,
                    'internal_product_id' => $addonMapping->internal_product_id,
                    'quantity' => $addonQty,
                    'mapping_type' => 'addon',
                    'option_type' => 'addon',
                    'auto_fraction' => false,
                    'external_reference' => (string) $index,
                    'external_name' => $addonName,
                    'unit_cost_override' => $addonCMV,
                ]);

                logger()->info('✅ Add-on não-sabor mapeado', [
                    'name' => $addonName,
                    'quantity' => $addonQty,
                    'cmv' => $addonCMV,
                ]);
            } else {
                // Add-on classificado mas SEM produto vinculado - apenas criar ProductMapping (já existe)
                logger()->info('🔗 Add-on classificado mas sem produto vinculado', [
                    'name' => $addonName,
                    'item_type' => $addonMapping->item_type,
                    'message' => 'Aguardando vínculo na Triagem',
                ]);
            }
        }

        // Processar sabores usando FlavorMappingService
        // MESMA LÓGICA DA TRIAGEM (mapFlavorToAllOccurrences mas só para este pedido)
        if ($hasFlavors) {
            logger()->info('🍕 Processando sabores via FlavorMappingService', [
                'order_item_id' => $orderItem->id,
            ]);

            try {
                $flavorService = app(FlavorMappingService::class);
                $flavorService->recalculateAllFlavorsForOrderItem($orderItem);

                logger()->info('✅ Sabores processados com sucesso via FlavorMappingService');
            } catch (\Exception $e) {
                logger()->error('❌ Erro ao processar sabores via FlavorMappingService', [
                    'error' => $e->getMessage(),
                    'order_item_id' => $orderItem->id,
                    'trace' => $e->getTraceAsString(),
                ]);
            }
        }
    }

    /**
     * Calcular CMV correto baseado no tamanho do produto
     * (Mesmo método usado no ItemTriageController)
     */
    protected function calculateCorrectCMV(InternalProduct $product, \App\Models\OrderItem $orderItem): ?float
    {
        // Se o produto não for sabor de pizza, usar unit_cost padrão
        if ($product->product_category !== 'sabor_pizza') {
            return $product->unit_cost;
        }

        // Detectar tamanho da pizza
        $pizzaSize = $this->detectPizzaSize($product, $orderItem);

        if (! $pizzaSize) {
            // logger()->warning('⚠️ Takeat: Não foi possível detectar tamanho da pizza', [
            //     'product_id' => $product->id,
            //     'product_name' => $product->name,
            //     'order_item_name' => $orderItem->name,
            // ]);

            return $product->unit_cost; // Fallback para unit_cost genérico
        }

        // Calcular CMV pelo tamanho
        $correctCMV = $product->calculateCMV($pizzaSize);

        // logger()->info('🍕 Takeat: CMV calculado por tamanho', [
        //     'product_id' => $product->id,
        //     'product_name' => $product->name,
        //     'size' => $pizzaSize,
        //     'cmv' => $correctCMV,
        //     'generic_unit_cost' => $product->unit_cost,
        // ]);

        return $correctCMV;
    }

    /**
     * Detectar tamanho da pizza a partir do nome do item
     */
    protected function detectPizzaSize(InternalProduct $product, \App\Models\OrderItem $orderItem): ?string
    {
        // Tentar detectar do nome do OrderItem
        $itemName = strtolower($orderItem->name);

        $sizePatterns = [
            'broto' => '/\b(broto|brotinho|pequena|p)\b/i',
            'media' => '/\b(media|média|m)\b/i',
            'grande' => '/\b(grande|g)\b/i',
            'familia' => '/\b(familia|família|gigante|gg)\b/i',
        ];

        foreach ($sizePatterns as $size => $pattern) {
            if (preg_match($pattern, $itemName)) {
                return $size;
            }
        }

        // Se o produto interno tem size definido, usar ele
        if ($product->size) {
            return $product->size;
        }

        return null;
    }

    /**
     * Detectar se um OrderItem é uma pizza baseado no nome
     */
    protected function isPizzaItem(\App\Models\OrderItem $orderItem): bool
    {
        $itemName = strtolower($orderItem->name);

        // Palavras-chave que indicam pizza
        $pizzaKeywords = [
            'pizza',
            'sabor',
            'fatias',
            'broto',
            'brotinho',
            'média',
            'media',
            'grande',
            'família',
            'familia',
            'gigante',
        ];

        foreach ($pizzaKeywords as $keyword) {
            if (str_contains($itemName, $keyword)) {
                return true;
            }
        }

        return false;
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

        return match ($orderStatus) {
            'pending' => 'PLACED',
            'confirmed' => 'CONFIRMED',
            'ready' => 'READY_TO_PICKUP',
            'delivered' => 'CONCLUDED',
            'finished' => 'CONCLUDED',
            default => 'PLACED',
        };
    }
}
