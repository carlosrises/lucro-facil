<?php

namespace App\Console\Commands;

use App\Models\OrderItem;
use App\Services\PizzaFractionService;
use Illuminate\Console\Command;

class FixCMV extends Command
{
    protected $signature = 'orders:fix-cmv
                            {--order_id= : ID específico do pedido}
                            {--tenant_id= : ID do tenant}
                            {--threshold=5 : Diferença mínima em reais para considerar incorreto}
                            {--dry-run : Simula sem salvar no banco}';

    protected $description = 'Corrige CMV de pedidos: frações de pizza, add-ons, sabores por tamanho e recalcula custos totais';

    public function handle()
    {
        $orderId = $this->option('order_id');
        $tenantId = $this->option('tenant_id');
        $threshold = (float) $this->option('threshold');
        $dryRun = $this->option('dry-run');

        if ($dryRun) {
            $this->warn('🔍 MODO DRY-RUN - Nenhuma alteração será feita');
        }

        $this->info('🔍 Buscando pedidos com add_ons (pizzas)...');
        $this->line('');

        // Contar total primeiro
        $countQuery = OrderItem::whereNotNull('add_ons')
            ->where('add_ons', '!=', '[]');

        if ($orderId) {
            $countQuery->where('order_id', $orderId);
        }

        if ($tenantId) {
            $countQuery->where('tenant_id', $tenantId);
        }

        $totalItems = $countQuery->count();

        $this->info("📦 Total de items com add_ons: {$totalItems}");
        $this->line('');

        $fixed = 0;
        $alreadyCorrect = 0;
        $errors = 0;
        $totalDifference = 0;
        $processed = 0;
        $affectedOrderIds = collect();

        $pizzaService = app(PizzaFractionService::class);

        // Processar em lotes de 50 para não estourar memória
        OrderItem::whereNotNull('add_ons')
            ->where('add_ons', '!=', '[]')
            ->when($orderId, fn ($q) => $q->where('order_id', $orderId))
            ->when($tenantId, fn ($q) => $q->where('tenant_id', $tenantId))
            ->with(['mappings', 'order'])
            ->chunkById(50, function ($orderItems) use (
                &$fixed,
                &$alreadyCorrect,
                &$errors,
                &$totalDifference,
                &$processed,
                &$affectedOrderIds,
                $totalItems,
                $threshold,
                $dryRun

            ) {
                foreach ($orderItems as $orderItem) {
                    try {
                        // Detectar tamanho e quantidade de sabores da pizza
                        $pizzaSize = $this->detectPizzaSize($orderItem);
                        $numFlavors = $this->detectNumFlavors($orderItem);
                        $correctFraction = $numFlavors > 0 ? (1.0 / $numFlavors) : 1.0;

                        // SEMPRE mostrar detalhes para debug
                        $this->line('');
                        $this->info("📦 Pedido #{$orderItem->order_id} - Item #{$orderItem->id}");
                        $this->line("   🍕 {$orderItem->name}");
                        $this->line('   📏 Tamanho detectado: '.($pizzaSize ?: 'não detectado'));
                        $this->line("   🍕 Sabores detectados: {$numFlavors} (fração: {$correctFraction})");
                        $this->line('');

                        // VERIFICAR SE EXISTEM OrderItemMappings de sabores
                        $existingFlavorMappings = \App\Models\OrderItemMapping::where('order_item_id', $orderItem->id)
                            ->where('mapping_type', 'addon')
                            ->where('option_type', 'pizza_flavor')
                            ->count();

                        // Se não existem mappings de sabores MAS existem ProductMappings de sabores classificados,
                        // usar FlavorMappingService para criar os mappings
                        if ($existingFlavorMappings === 0) {
                            $hasClassifiedFlavors = false;
                            foreach ($orderItem->add_ons as $addOn) {
                                $addOnName = is_array($addOn) ? ($addOn['name'] ?? '') : $addOn;
                                $addOnSku = 'addon_'.md5($addOnName);

                                $mapping = \App\Models\ProductMapping::where('external_item_id', $addOnSku)
                                    ->where('tenant_id', $orderItem->tenant_id)
                                    ->where('item_type', 'flavor')
                                    ->whereNotNull('internal_product_id')
                                    ->exists();

                                if ($mapping) {
                                    $hasClassifiedFlavors = true;
                                    break;
                                }
                            }

                            if ($hasClassifiedFlavors) {
                                $this->line('   🔍 Sabores classificados encontrados sem OrderItemMappings');
                                $this->line('   🍕 Usando FlavorMappingService para criar mappings...');

                                if (! $dryRun) {
                                    try {
                                        $flavorService = app(\App\Services\FlavorMappingService::class);
                                        $flavorService->recalculateAllFlavorsForOrderItem($orderItem);

                                        $createdMappings = \App\Models\OrderItemMapping::where('order_item_id', $orderItem->id)
                                            ->where('option_type', 'pizza_flavor')
                                            ->count();

                                        $this->info("   ✅ {$createdMappings} mappings criados via FlavorMappingService");

                                        // Refresh do orderItem para recarregar os mappings
                                        $orderItem = $orderItem->fresh(['mappings']);
                                    } catch (\Exception $e) {
                                        $this->error('   ❌ Erro ao criar mappings: '.$e->getMessage());
                                    }
                                } else {
                                    $this->comment('   🔍 [DRY-RUN] FlavorMappingService seria executado');
                                }
                                $this->line('');
                            }
                        }

                        // COPIAR EXATAMENTE A LÓGICA DO OrdersController (linhas 133-180)
                        $addOnsWithMappings = [];
                        foreach ($orderItem->add_ons as $index => $addOn) {
                            $addOnName = is_array($addOn) ? ($addOn['name'] ?? '') : $addOn;
                            $addOnQuantity = is_array($addOn) ? ($addOn['quantity'] ?? $addOn['qty'] ?? 1) : 1;
                            $addOnSku = 'addon_'.md5($addOnName);

                            // Buscar ProductMapping do add-on
                            $mapping = \App\Models\ProductMapping::where('external_item_id', $addOnSku)
                                ->where('tenant_id', $orderItem->tenant_id)
                                ->with('internalProduct:id,name,unit_cost,product_category')
                                ->first();

                            // CRÍTICO: Buscar OrderItemMapping do add-on para obter unit_cost_override e quantity (fração)
                            $orderItemMapping = \App\Models\OrderItemMapping::where('order_item_id', $orderItem->id)
                                ->where('mapping_type', 'addon')
                                ->where('external_reference', (string) $index)
                                ->first();

                            // Usar unit_cost_override do OrderItemMapping se existir, senão fallback para unit_cost do produto
                            $unitCost = null;
                            $mappingQuantity = null;
                            if ($orderItemMapping && $orderItemMapping->unit_cost_override !== null) {
                                $unitCost = (float) $orderItemMapping->unit_cost_override;
                                $mappingQuantity = (float) $orderItemMapping->quantity; // Fração do sabor (ex: 0.25 para 1/4)
                            } elseif ($mapping && $mapping->internalProduct) {
                                $unitCost = (float) $mapping->internalProduct->unit_cost;
                                $mappingQuantity = 1.0; // Sem fração
                            }

                            $addOnsWithMappings[] = [
                                'name' => $addOnName,
                                'quantity' => $addOnQuantity, // Quantidade do add-on (ex: 2 para "2x Don Rafaello")
                                'unit_cost_override' => $unitCost, // CMV unitário
                                'mapping_quantity' => $mappingQuantity, // Fração ATUAL do OrderItemMapping (para diagnóstico)
                                'product' => $mapping?->internalProduct,
                                'product_mapping' => $mapping, // Adicionar ProductMapping completo
                                'order_item_mapping_id' => $orderItemMapping?->id,
                                'order_item_mapping' => $orderItemMapping, // Adicionar OrderItemMapping completo
                            ];
                        }

                        $this->line('   🔍 Add-ons processados: '.count($addOnsWithMappings));

                        // Processar add_ons_enriched como o frontend faz
                        $hasIncorrectCost = false;
                        $hasPizzaFlavor = false;
                        $currentTotal = 0;
                        $correctTotal = 0;

                        foreach ($addOnsWithMappings as $addon) {
                            $productMapping = $addon['product_mapping'] ?? null;
                            $orderItemMapping = $addon['order_item_mapping'] ?? null;
                            $product = $addon['product'] ?? null;

                            // Verificar se é sabor de pizza
                            $isFlavor = $productMapping && $productMapping->item_type === 'flavor';

                            // Se não tem ProductMapping mas tem OrderItemMapping, pode ser sabor não classificado
                            if (! $isFlavor && $orderItemMapping && (stripos($addon['name'], 'pizza') !== false || stripos($addon['name'], 'sabor') !== false)) {
                                $this->line("   └ {$addon['name']} - ⚠️  Sabor não classificado (tem OrderItemMapping)");
                                $isFlavor = true;
                            }

                            // Se não tem nenhum mapping (nem ProductMapping nem OrderItemMapping), pular
                            if (! $productMapping && ! $orderItemMapping) {
                                $this->line("   └ {$addon['name']} - ⚠️  Sem classificação");

                                continue;
                            }

                            $hasPizzaFlavor = $hasPizzaFlavor || $isFlavor;

                            // Calcular como o frontend calcula (order-financial-card.tsx linha 1052-1070)
                            // const addonCost = (unitCost ?? 0) * (mappingQuantity ?? 1) * addonQuantity;
                            $currentCMV = $addon['unit_cost_override'] ?? 0;
                            $mappingQuantity = $addon['mapping_quantity'] ?? 1.0;
                            $addonQuantity = $addon['quantity'] ?? 1;

                            // Subtotal ATUAL (com fração atual do OrderItemMapping)
                            $currentSubtotal = $currentCMV * $mappingQuantity * $addonQuantity;

                            // Calcular CMV e subtotal CORRETO
                            if (! $productMapping || ! $productMapping->internal_product_id || ! $product) {
                                // Se não tem produto associado:
                                // - Para SABORES: CMV = 0 (precisa associar)
                                // - Para OUTROS (bebidas, etc): manter CMV atual (só corrigir fração)
                                $correctCMV = $isFlavor ? 0 : $currentCMV;
                            } else {
                                // Calcular CMV:
                                // - SABORES: usar calculateCMV por tamanho (broto, média, grande, família)
                                // - OUTROS: usar unit_cost direto (bebidas não têm tamanho)
                                if ($isFlavor && $pizzaSize) {
                                    $correctCMV = $product->calculateCMV($pizzaSize);
                                } else {
                                    $correctCMV = $product->unit_cost;
                                }
                            }

                            // Aplicar fração APENAS para sabores de pizza
                            // Outros add-ons (bebidas, complementos) são 100% completos
                            // IMPORTANTE: Para sabores, a quantidade no OrderItemMapping deve ser addonQuantity / totalFlavors
                            // Ex: 2x Portuguesa de 3 sabores = 2/3
                            $correctQuantity = $isFlavor ? ($addonQuantity / $numFlavors) : 1.0;
                            $correctSubtotal = $correctCMV * $correctQuantity;

                            $currentTotal += $currentSubtotal;
                            $correctTotal += $correctSubtotal;

                            // Formatar frações para exibição (apenas para sabores)
                            // Para correctQuantity, usar a fração real (ex: 2/3) quando quantidade > 1
                            $currentFractionText = $this->formatFraction($mappingQuantity);
                            $correctFractionText = $isFlavor && $addonQuantity > 1
                                ? "{$addonQuantity}/{$numFlavors}"
                                : $this->formatFraction($correctQuantity);

                            // Verificar se está incorreto:
                            // - CMV errado
                            // - Fração errada (para qualquer tipo de add-on)
                            $isIncorrect = abs($currentCMV - $correctCMV) > 0.01 || abs($mappingQuantity - $correctQuantity) > 0.01;

                            $productName = $product ? $product->name : $addon['name'];

                            if ($isIncorrect) {
                                $this->line("   ├ ⚠️  {$currentFractionText} {$productName}");
                                $this->line('      OrderItemMapping ID: '.($addon['order_item_mapping_id'] ?? 'N/A'));
                                $this->line('      ❌ ATUAL: R$ '.number_format($currentCMV, 2, ',', '.').' × '.$currentFractionText.' = R$ '.number_format($currentSubtotal, 2, ',', '.'));
                                $this->line("      ✅ CORRETO ({$pizzaSize}): R$ ".number_format($correctCMV, 2, ',', '.').' × '.$correctFractionText.' = R$ '.number_format($correctSubtotal, 2, ',', '.'));
                                $hasIncorrectCost = true;
                            } else {
                                // Verificar status de classificação
                                $hasProduct = $productMapping && $productMapping->internal_product_id !== null;
                                $hasClassification = $productMapping !== null;

                                if ($hasProduct) {
                                    // Tem produto vinculado
                                    $icon = '✅';
                                    $statusText = '';
                                } elseif ($hasClassification) {
                                    // Classificado mas sem produto
                                    $itemTypeLabels = [
                                        'flavor' => 'Sabor',
                                        'drink' => 'Bebida',
                                        'optional' => 'Opcional',
                                        'side' => 'Acompanhamento',
                                    ];
                                    $typeLabel = $itemTypeLabels[$productMapping->item_type] ?? $productMapping->item_type;
                                    $icon = '🏷️';
                                    $statusText = " (classificado como {$typeLabel} - associar produto na Triagem)";
                                } else {
                                    // Não classificado
                                    $icon = '🔗';
                                    $statusText = ' (não classificado - vincular na Triagem)';
                                }

                                $this->line("   ├ {$icon} {$correctFractionText} {$productName}{$statusText}");
                                $this->line('      💰 R$ '.number_format($correctSubtotal, 2, ',', '.'));
                            }
                        }

                        // Pular se não tem pizza
                        if (! $hasPizzaFlavor) {
                            $this->comment('   ⏭️  Sem sabores de pizza - pulando');

                            continue;
                        }

                        $this->line('');
                        $this->line('   💰 Total ATUAL (sabores): R$ '.number_format($currentTotal, 2, ',', '.'));
                        $this->line('   ✅ Total CORRETO (sabores): R$ '.number_format($correctTotal, 2, ',', '.'));

                        $difference = abs($currentTotal - $correctTotal);
                        $this->line('   📏 Diferença: R$ '.number_format($difference, 2, ',', '.'));

                        // SEMPRE verificar e criar mappings para add-ons não-sabor vinculados (independente da correção de sabores)
                        $createdNonFlavorCount = $this->ensureNonFlavorMappings($orderItem, $pizzaSize, $dryRun);

                        if (! $hasIncorrectCost && $difference < $threshold) {
                            if ($createdNonFlavorCount > 0) {
                                $this->info("   ✅ OK (sabores) + {$createdNonFlavorCount} bebidas/complementos vinculados!");
                            } else {
                                $this->comment('   ✅ OK');
                            }
                            $alreadyCorrect++;

                            continue;
                        }

                        $this->warn('   ⚠️  NECESSITA CORREÇÃO');

                        if (! $dryRun) {
                            // Deletar APENAS mappings de sabores (option_type = 'pizza_flavor')
                            // Preservar outros add-ons como bebidas, complementos, etc
                            $deletedCount = \App\Models\OrderItemMapping::where('order_item_id', $orderItem->id)
                                ->where('mapping_type', 'addon')
                                ->where('option_type', 'pizza_flavor')
                                ->delete();

                            if ($deletedCount > 0) {
                                $this->line("   🗑️  Deletados {$deletedCount} mappings de sabores antigos");
                            }

                            // Recriar mappings para cada sabor E criar mappings para add-ons vinculados
                            $remappedCount = 0;
                            $skippedCount = 0;
                            $skippedNames = [];
                            $createdNonFlavorCount = 0;

                            foreach ($orderItem->add_ons as $index => $addOn) {
                                $addOnName = is_array($addOn) ? ($addOn['name'] ?? '') : $addOn;

                                // Gerar SKU do addon como a Triagem faz
                                $addonSku = 'addon_'.md5($addOnName);

                                // Buscar ProductMapping do add-on pelo SKU (qualquer tipo)
                                $mapping = \App\Models\ProductMapping::where('tenant_id', $orderItem->tenant_id)
                                    ->where('external_item_id', $addonSku)
                                    ->first();

                                if (! $mapping || ! $mapping->internal_product_id) {
                                    $skippedCount++;
                                    $skippedNames[] = $addOnName;

                                    continue;
                                }

                                // Verificar se já existe OrderItemMapping para este add-on
                                $existingMapping = \App\Models\OrderItemMapping::where('order_item_id', $orderItem->id)
                                    ->where('external_reference', (string) $index)
                                    ->exists();

                                if ($existingMapping) {
                                    continue; // Já tem mapping, não precisa recriar
                                }

                                // Se for sabor, processar com frações
                                if ($mapping->item_type === 'flavor') {
                                    $this->processFlavourMapping($mapping, $orderItem, $index, $addOn, $addOnName, $numFlavors, $pizzaSize, $remappedCount);
                                } else {
                                    // Para add-ons não-sabor (bebidas, complementos), criar OrderItemMapping simples
                                    $product = $mapping->internalProduct;
                                    if (! $product) {
                                        continue;
                                    }

                                    $addOnQuantity = is_array($addOn) ? ($addOn['quantity'] ?? $addOn['qty'] ?? 1) : 1;
                                    $correctCMV = $pizzaSize && $product->product_category === 'sabor_pizza'
                                        ? $product->calculateCMV($pizzaSize)
                                        : $product->unit_cost;

                                    \App\Models\OrderItemMapping::create([
                                        'tenant_id' => $orderItem->tenant_id,
                                        'order_item_id' => $orderItem->id,
                                        'internal_product_id' => $product->id,
                                        'quantity' => $addOnQuantity,
                                        'mapping_type' => 'addon',
                                        'option_type' => 'addon',
                                        'auto_fraction' => false,
                                        'external_reference' => (string) $index,
                                        'external_name' => $addOnName,
                                        'unit_cost_override' => $correctCMV,
                                    ]);

                                    $createdNonFlavorCount++;
                                }
                            }

                            // Criar mappings para add-ons não-sabor vinculados (bebidas, complementos)
                            $createdNonFlavorCount = $this->ensureNonFlavorMappings($orderItem, $pizzaSize, false);

                            if ($remappedCount > 0) {
                                $this->info("   ✅ Remapeados {$remappedCount} sabores com frações corretas!");
                            }

                            if ($createdNonFlavorCount > 0) {
                                $this->info("   ✅ Criados {$createdNonFlavorCount} mappings para bebidas/complementos!");
                            }

                            if ($skippedCount > 0) {
                                $this->warn("   ⚠️  {$skippedCount} sabores NÃO CLASSIFICADOS na Triagem (pulados):");
                                foreach ($skippedNames as $name) {
                                    $this->line("      - {$name}");
                                }
                                $this->comment('      💡 Classifique estes sabores em /triage para corrigir o CMV');
                            }

                            // Verificar resultado
                            $orderItem->refresh();
                            $newTotal = $orderItem->calculateTotalCost();
                            $this->line('   🆕 Novo total: R$ '.number_format($newTotal, 2, ',', '.'));
                        } else {
                            $this->comment('   🔍 Seria recalculado (dry-run)');
                        }

                        $totalDifference += $difference;
                        $fixed++;
                        $affectedOrderIds->push($orderItem->order_id);

                    } catch (\Exception $e) {
                        $this->error("   ❌ Erro ao processar item #{$orderItem->id}: {$e->getMessage()}");
                        $errors++;
                    }

                    $processed++;

                    // Mostrar progresso a cada 50 items
                    if ($processed % 50 === 0) {
                        $this->info("🔄 Processados: {$processed}/{$totalItems}...");
                    }
                }
            });

        // Recalcular custos dos pedidos afetados
        if (!$dryRun && $affectedOrderIds->isNotEmpty()) {
            $uniqueOrderIds = $affectedOrderIds->unique();
            $this->line('');
            $this->info("🔄 Recalculando custos de {$uniqueOrderIds->count()} pedidos...");

            $costService = app(\App\Services\OrderCostService::class);
            foreach ($uniqueOrderIds as $orderId) {
                $order = \App\Models\Order::find($orderId);
                if ($order) {
                    try {
                        $result = $costService->calculateOrderCosts($order);
                        $order->update([
                            'calculated_costs' => $result,
                            'total_costs' => $result['total_costs'] ?? 0,
                            'total_commissions' => $result['total_commissions'] ?? 0,
                            'net_revenue' => $result['net_revenue'] ?? 0,
                            'costs_calculated_at' => now(),
                        ]);
                    } catch (\Exception $e) {
                        logger()->error('Erro ao recalcular custos do pedido', [
                            'order_id' => $orderId,
                            'error' => $e->getMessage(),
                        ]);
                    }
                }
            }
            $this->info('✅ Custos recalculados!');
        }

        $this->line('');
        $this->info('═══════════════════════════════════════');
        $this->info("📊 Total processado: {$processed} items");
        $this->info("✅ Já corretos: {$alreadyCorrect}");
        $this->info('🔧 '.($dryRun ? 'Seriam corrigidos' : 'Corrigidos').": {$fixed}");
        $this->info('💰 Diferença total encontrada: R$ '.number_format($totalDifference, 2, ',', '.'));

        if ($errors > 0) {
            $this->error("❌ Erros: {$errors}");
        }

        $this->info('═══════════════════════════════════════');

        if ($dryRun) {
            $this->warn('🔍 DRY-RUN: Nenhuma alteração foi salva. Execute sem --dry-run para aplicar.');
        }

        return 0;
    }

    /**
     * Detectar tamanho da pizza do OrderItem
     */
    protected function detectNumFlavors(OrderItem $orderItem): int
    {
        $itemName = strtolower($orderItem->name);

        // Detectar pelo nome: "Pizza Grande 2 sabores", "Pizza 3 sabores", etc
        if (preg_match('/(\d+)\s*sabor/i', $itemName, $matches)) {
            return (int) $matches[1];
        }

        // Contar sabores CLASSIFICADOS na Triagem (com ProductMapping item_type='flavor')
        // Independente de estarem ASSOCIADOS ou não (internal_product_id pode ser null)
        $flavorCount = 0;
        foreach ($orderItem->add_ons as $addOn) {
            $addOnName = is_array($addOn) ? ($addOn['name'] ?? '') : $addOn;
            $addOnQty = is_array($addOn) ? ($addOn['quantity'] ?? $addOn['qty'] ?? 1) : 1;

            // Gerar SKU do addon como a Triagem faz
            $addonSku = 'addon_'.md5($addOnName);

            // Procurar ProductMapping (classificação na Triagem)
            $mapping = \App\Models\ProductMapping::where('tenant_id', $orderItem->tenant_id)
                ->where('external_item_id', $addonSku)
                ->first();

            // Contar se está CLASSIFICADO como sabor (item_type='flavor')
            // NÃO importa se tem internal_product_id (associação)
            // SOMA a quantidade: 2x Pizza Mozarela = +2 sabores
            if ($mapping && $mapping->item_type === 'flavor') {
                $flavorCount += $addOnQty;
            }
        }

        return $flavorCount > 0 ? $flavorCount : 1;
    }

    protected function detectPizzaSize(OrderItem $orderItem): ?string
    {
        // 1. Tentar pelo produto pai (mapping principal)
        $mainMapping = $orderItem->mappings()->where('mapping_type', 'main')->first();
        if ($mainMapping && $mainMapping->internalProduct?->size) {
            return $mainMapping->internalProduct->size;
        }

        // 2. Tentar detectar do nome do item
        $itemName = strtolower($orderItem->name);

        if (preg_match('/\bbroto\b/', $itemName)) {
            return 'broto';
        }
        if (preg_match('/\bgrande\b/', $itemName)) {
            return 'grande';
        }
        if (preg_match('/\b(familia|big|don|70x35)\b/', $itemName)) {
            return 'familia';
        }
        if (preg_match('/\b(media|média|m\b)/', $itemName)) {
            return 'media';
        }

        return null;
    }

    /**
     * Processar sabor e criar OrderItemMapping com fração
     */
    protected function processFlavourMapping($mapping, $orderItem, $index, $addOn, $addOnName, $numFlavors, $pizzaSize, &$remappedCount): void
    {
        $product = $mapping->internalProduct;
        if (! $product) {
            return;
        }

        // Calcular CMV correto baseado no tamanho (mesma lógica do FlavorMappingService)
        $correctCMV = $pizzaSize ? $product->calculateCMV($pizzaSize) : $product->unit_cost;

        // Obter quantidade do add-on
        $addOnQuantity = is_array($addOn) ? ($addOn['quantity'] ?? $addOn['qty'] ?? 1) : 1;

        // Calcular fração considerando a quantidade do sabor
        // Ex: 2x Portuguesa de 3 sabores totais = 2/3
        // Isso porque detectNumFlavors() já soma as quantidades (2x + 1x = 3 sabores)
        $quantityWithFraction = ($addOnQuantity / $numFlavors);

        // Criar novo OrderItemMapping (mesma estrutura do FlavorMappingService)
        \App\Models\OrderItemMapping::create([
            'tenant_id' => $orderItem->tenant_id,
            'order_item_id' => $orderItem->id,
            'internal_product_id' => $product->id,
            'quantity' => $quantityWithFraction, // Fração baseada na quantidade (ex: 2/3 para 2x de 3 sabores)
            'mapping_type' => 'addon',
            'option_type' => 'pizza_flavor',
            'auto_fraction' => true,
            'external_reference' => (string) $index,
            'external_name' => $addOnName,
            'unit_cost_override' => $correctCMV,
        ]);

        $remappedCount++;
    }

    /**
     * Verificar e criar OrderItemMapping para add-ons não-sabor que têm ProductMapping vinculado
     */
    protected function ensureNonFlavorMappings($orderItem, $pizzaSize, $dryRun): int
    {
        $createdCount = 0;

        foreach ($orderItem->add_ons as $index => $addOn) {
            $addonName = is_array($addOn) ? ($addOn['name'] ?? '') : $addOn;
            if (! $addonName) {
                continue;
            }

            $addonSku = 'addon_'.md5($addonName);

            // Buscar ProductMapping não-sabor
            $mapping = \App\Models\ProductMapping::where('tenant_id', $orderItem->tenant_id)
                ->where('external_item_id', $addonSku)
                ->where('item_type', '!=', 'flavor')
                ->first();

            // Só processar se:
            // 1. Tem ProductMapping com produto vinculado
            // 2. NÃO tem OrderItemMapping ainda
            if (! $mapping || ! $mapping->internal_product_id) {
                continue;
            }

            $existingMapping = \App\Models\OrderItemMapping::where('order_item_id', $orderItem->id)
                ->where('external_reference', (string) $index)
                ->exists();

            if ($existingMapping) {
                continue;
            }

            // Criar OrderItemMapping para o add-on
            if (! $dryRun) {
                $product = $mapping->internalProduct;
                if (! $product) {
                    continue;
                }

                $addOnQuantity = is_array($addOn) ? ($addOn['quantity'] ?? $addOn['qty'] ?? 1) : 1;
                $correctCMV = $pizzaSize && $product->product_category === 'sabor_pizza'
                    ? $product->calculateCMV($pizzaSize)
                    : $product->unit_cost;

                \App\Models\OrderItemMapping::create([
                    'tenant_id' => $orderItem->tenant_id,
                    'order_item_id' => $orderItem->id,
                    'internal_product_id' => $product->id,
                    'quantity' => $addOnQuantity,
                    'mapping_type' => 'addon',
                    'option_type' => 'addon',
                    'auto_fraction' => false,
                    'external_reference' => (string) $index,
                    'external_name' => $addonName,
                    'unit_cost_override' => $correctCMV,
                ]);

                $createdCount++;
            }
        }

        return $createdCount;
    }

    /**
     * Formatar fração para exibição legível
     */
    protected function formatFraction(float $fraction): string
    {
        if (abs($fraction - 0.5) < 0.01) {
            return '1/2';
        }
        if (abs($fraction - 0.33) < 0.01 || abs($fraction - 1 / 3) < 0.01) {
            return '1/3';
        }
        if (abs($fraction - 0.25) < 0.01) {
            return '1/4';
        }
        if (abs($fraction - 0.66) < 0.01 || abs($fraction - 2 / 3) < 0.01) {
            return '2/3';
        }
        if (abs($fraction - 0.75) < 0.01) {
            return '3/4';
        }

        return number_format($fraction, 2);
    }
}
