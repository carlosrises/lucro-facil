<?php

namespace App\Console\Commands;

use App\Models\OrderItem;
use App\Services\PizzaFractionService;
use Illuminate\Console\Command;

class FixIncorrectPizzaFractions extends Command
{
    protected $signature = 'orders:fix-incorrect-fractions
                            {--order_id= : ID específico do pedido}
                            {--tenant_id= : ID do tenant}
                            {--threshold=5 : Diferença mínima em reais para considerar incorreto}
                            {--dry-run : Simula sem salvar no banco}';

    protected $description = 'Identifica e corrige pedidos com frações de pizza incorretas (reassocia sabores)';

    public function handle()
    {
        $orderId = $this->option('order_id');
        $tenantId = $this->option('tenant_id');
        $threshold = (float) $this->option('threshold');
        $dryRun = $this->option('dry-run');

        if ($dryRun) {
            $this->warn('🔍 MODO DRY-RUN - Nenhuma alteração será feita');
        }

        $this->info("🔍 Buscando pedidos com add_ons (pizzas)...");
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

        $pizzaService = app(PizzaFractionService::class);

        // Processar em lotes de 50 para não estourar memória
        OrderItem::whereNotNull('add_ons')
            ->where('add_ons', '!=', '[]')
            ->when($orderId, fn($q) => $q->where('order_id', $orderId))
            ->when($tenantId, fn($q) => $q->where('tenant_id', $tenantId))
            ->with(['mappings', 'order'])
            ->chunkById(50, function ($orderItems) use (
                &$fixed,
                &$alreadyCorrect,
                &$errors,
                &$totalDifference,
                &$processed,
                $totalItems,
                $threshold,
                $dryRun,
                $pizzaService
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
                        'mapping_quantity' => $correctFraction, // USAR FRAÇÃO CALCULADA, NÃO A DO MAPPING
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

                    // Pular se NÃO é sabor de pizza (verificar pelo item_type do ProductMapping)
                    $isFlavor = $productMapping && $productMapping->item_type === 'flavor';
                    
                    if (!$isFlavor) {
                        // Se não tem ProductMapping mas tem OrderItemMapping, pode ser sabor não classificado
                        if ($orderItemMapping && (stripos($addon['name'], 'pizza') !== false || stripos($addon['name'], 'sabor') !== false)) {
                            $this->line("   └ {$addon['name']} - ⚠️  Sabor não classificado (tem OrderItemMapping)");
                            $isFlavor = true; // Processar como sabor mesmo sem classificação
                        } else {
                            $category = $productMapping ? ($productMapping->item_type ?? 'N/A') : 'N/A';
                            $this->line("   └ {$addon['name']} ({$category}) - pulado");
                            continue;
                        }
                    }

                    $hasPizzaFlavor = true;

                    // Calcular como o frontend calcula (order-financial-card.tsx linha 1052-1070)
                    // const addonCost = (unitCost ?? 0) * (mappingQuantity ?? 1) * addonQuantity;
                    $currentCMV = $addon['unit_cost_override'] ?? 0;
                    $mappingQuantity = $addon['mapping_quantity'] ?? 1.0;
                    $addonQuantity = $addon['quantity'] ?? 1;

                    $currentSubtotal = $currentCMV * $mappingQuantity * $addonQuantity;

                    // Calcular CMV correto por tamanho
                    $correctCMV = $pizzaSize ? $product->calculateCMV($pizzaSize) : $currentCMV;
                    $correctSubtotal = $correctCMV * $mappingQuantity * $addonQuantity;

                    $currentTotal += $currentSubtotal;
                    $correctTotal += $correctSubtotal;

                    $fraction = $mappingQuantity == 0.5 ? '1/2' : ($mappingQuantity == 0.33 ? '1/3' : ($mappingQuantity == 0.25 ? '1/4' : $mappingQuantity));
                    $isIncorrect = abs($currentCMV - $correctCMV) > 0.01;

                    if ($isIncorrect) {
                        $this->line("   ├ ⚠️  {$fraction} {$product->name}");
                        $this->line('      OrderItemMapping ID: '.($addon['order_item_mapping_id'] ?? 'N/A'));
                        $this->line('      ❌ ATUAL (CMV): R$ '.number_format($currentCMV, 2, ',', '.').' × '.$mappingQuantity.' × '.$addonQuantity.' = R$ '.number_format($currentSubtotal, 2, ',', '.'));
                        $this->line("      ✅ CORRETO ({$pizzaSize}): R$ ".number_format($correctCMV, 2, ',', '.').' × '.$mappingQuantity.' × '.$addonQuantity.' = R$ '.number_format($correctSubtotal, 2, ',', '.'));
                        $hasIncorrectCost = true;
                    } else {
                        $this->line("   ├ ✅ {$fraction} {$product->name}");
                        $this->line('      💰 R$ '.number_format($currentSubtotal, 2, ',', '.'));
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

                if (! $hasIncorrectCost || $difference < $threshold) {
                    $this->comment('   ✅ OK');
                    $alreadyCorrect++;

                    continue;
                }

                $this->warn('   ⚠️  NECESSITA CORREÇÃO');

                if (! $dryRun) {
                    // Deletar mappings antigos de addons para forçar reassociação
                    $deletedCount = \App\Models\OrderItemMapping::where('order_item_id', $orderItem->id)
                        ->where('mapping_type', 'addon')
                        ->delete();

                    if ($deletedCount > 0) {
                        $this->line("   🗑️  Deletados {$deletedCount} mappings antigos");
                    }

                    // Recriar mappings para cada sabor
                    $remappedCount = 0;
                    $skippedCount = 0;
                    $skippedNames = [];

                    foreach ($orderItem->add_ons as $index => $addOn) {
                        $addOnName = is_array($addOn) ? ($addOn['name'] ?? '') : $addOn;

                        // Gerar SKU do addon como a Triagem faz
                        $addonSku = 'addon_'.md5($addOnName);

                        // Buscar ProductMapping do sabor pelo SKU
                        $mapping = \App\Models\ProductMapping::where('tenant_id', $orderItem->tenant_id)
                            ->where('external_item_id', $addonSku)
                            ->where('item_type', 'flavor')
                            ->first();

                        if (!$mapping || !$mapping->internal_product_id) {
                            $skippedCount++;
                            $skippedNames[] = $addOnName;
                            continue;
                        }

                        $product = $mapping->internalProduct;
                        if (!$product) continue;

                        // Calcular CMV correto baseado no tamanho (mesma lógica do FlavorMappingService)
                        $correctCMV = $pizzaSize ? $product->calculateCMV($pizzaSize) : $product->unit_cost;

                        // Obter quantidade do add-on
                        $addOnQuantity = is_array($addOn) ? ($addOn['quantity'] ?? $addOn['qty'] ?? 1) : 1;

                        // Criar novo OrderItemMapping (mesma estrutura do FlavorMappingService linha 227-239)
                        \App\Models\OrderItemMapping::create([
                            'tenant_id' => $orderItem->tenant_id,
                            'order_item_id' => $orderItem->id,
                            'internal_product_id' => $product->id,
                            'quantity' => $correctFraction * $addOnQuantity, // Fração x Quantidade do add-on
                            'mapping_type' => 'addon',
                            'option_type' => 'pizza_flavor',
                            'auto_fraction' => true,
                            'external_reference' => (string) $index,
                            'external_name' => $addOnName,
                            'unit_cost_override' => $correctCMV,
                        ]);

                        $remappedCount++;
                    }

                    if ($remappedCount > 0) {
                        $this->info("   ✅ Remapeados {$remappedCount} sabores com frações corretas!");
                    }

                    if ($skippedCount > 0) {
                        $this->warn("   ⚠️  {$skippedCount} sabores NÃO CLASSIFICADOS na Triagem (pulados):");
                        foreach ($skippedNames as $name) {
                            $this->line("      - {$name}");
                        }
                        $this->comment("      💡 Classifique estes sabores em /triage para corrigir o CMV");
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

        // Contar quantos sabores estão no add_ons (mesma lógica do frontend)
        $flavorCount = 0;
        foreach ($orderItem->add_ons as $addOn) {
            $addOnName = is_array($addOn) ? ($addOn['name'] ?? '') : $addOn;

            // Gerar SKU do addon como a Triagem faz
            $addonSku = 'addon_'.md5($addOnName);

            // Procurar ProductMapping para ver se é sabor
            $mapping = \App\Models\ProductMapping::where('tenant_id', $orderItem->tenant_id)
                ->where('external_item_id', $addonSku)
                ->first();

            // Contar como sabor se:
            // 1. Tem ProductMapping com item_type='flavor' (mesma lógica do frontend linha 1118-1125)
            // 2. OU se o nome contém "pizza" (fallback para itens não classificados)
            if ($mapping && $mapping->item_type === 'flavor') {
                $flavorCount++;
            } elseif (stripos($addOnName, 'pizza') !== false || stripos($addOnName, 'sabor') !== false) {
                // Adicionar sabores não classificados mas que claramente são sabores
                $flavorCount++;
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
}
