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

        $this->info("🔍 Buscando pedidos com diferença > R$ {$threshold} no cálculo...");
        $this->line('');

        // Buscar OrderItems que têm sabores de pizza
        $query = OrderItem::whereHas('mappings', function ($q) {
            $q->where('mapping_type', 'addon')
                ->where('option_type', 'pizza_flavor');
        })->with([
            'mappings' => function ($q) {
                $q->orderBy('mapping_type')->orderBy('id');
            },
            'mappings.internalProduct',
            'order',
        ]);

        if ($orderId) {
            $query->where('order_id', $orderId);
        }

        if ($tenantId) {
            $query->where('tenant_id', $tenantId);
        }

        $orderItems = $query->get();

        $this->info("📦 Encontrados {$orderItems->count()} items com sabores de pizza");
        $this->line('');

        $fixed = 0;
        $alreadyCorrect = 0;
        $errors = 0;
        $totalDifference = 0;

        $pizzaService = app(PizzaFractionService::class);

        foreach ($pizzaItems as $orderItem) {
            try {
                // Detectar tamanho da pizza
                $pizzaSize = $this->detectPizzaSize($orderItem);

                // Calcular total atual (o que está salvo)
                $currentTotal = $this->calculateCurrentTotal($orderItem);

                // Calcular total correto (o que deveria estar)
                $correctTotal = $this->calculateCorrectTotal($orderItem, $pizzaSize);

                // Calcular diferença
                $difference = abs($currentTotal - $correctTotal);

                // SEMPRE mostrar detalhes para debug
                $this->line('');
                $this->info("📦 Pedido #{$orderItem->order_id} - Item #{$orderItem->id}");
                $this->line("   🍕 {$orderItem->name}");
                $this->line('   📏 Tamanho detectado: '.($pizzaSize ?: 'não detectado'));
                $this->line('');

                // Mostrar detalhes dos mappings
                $hasIncorrectCost = false;

                $this->line('   🔍 Total de mappings: '.$orderItem->mappings->count());

                foreach ($orderItem->mappings as $mapping) {
                    $currentCost = $mapping->unit_cost_override ?? $mapping->internalProduct?->unit_cost ?? 0;
                    $qty = $mapping->quantity ?? 1.0;
                    $currentSubtotal = $currentCost * $qty;
                    $prodName = $mapping->internalProduct?->name ?? 'N/A';

                    $this->line("   🔍 Mapping ID {$mapping->id}: type={$mapping->mapping_type}, option_type={$mapping->option_type}, product={$prodName}");

                    if ($mapping->mapping_type === 'main') {
                        $this->line("   📦 [{$mapping->mapping_type}] {$prodName}");
                        $this->line('      💰 R$ '.number_format($currentSubtotal, 2, ',', '.'));
                    } elseif ($mapping->option_type === 'pizza_flavor' && $pizzaSize) {
                        // Para sabores de pizza, calcular o CMV correto
                        $product = $mapping->internalProduct;
                        if ($product) {
                            $correctCMV = $product->calculateCMV($pizzaSize);
                            $correctSubtotal = $correctCMV * $qty;
                            $isIncorrect = abs($currentCost - $correctCMV) > 0.01;

                            $fraction = $qty == 0.5 ? '1/2' : ($qty == 0.33 ? '1/3' : ($qty == 0.25 ? '1/4' : $qty));

                            if ($isIncorrect) {
                                $this->line("   ├ ⚠️  {$fraction} {$prodName}");
                                $this->line('      ❌ ATUAL (genérico): R$ '.number_format($currentSubtotal, 2, ',', '.').' (CMV: R$ '.number_format($currentCost, 2, ',', '.').')');
                                $this->line("      ✅ CORRETO ({$pizzaSize}): R$ ".number_format($correctSubtotal, 2, ',', '.').' (CMV: R$ '.number_format($correctCMV, 2, ',', '.').')');
                                $hasIncorrectCost = true;
                            } else {
                                $this->line("   ├ ✅ {$fraction} {$prodName}");
                                $this->line('      💰 R$ '.number_format($currentSubtotal, 2, ',', '.'));
                            }
                        }
                    } else {
                        $this->line("   └ {$prodName}");
                        $this->line('      💰 R$ '.number_format($currentSubtotal, 2, ',', '.'));
                    }
                }

                $this->line('');
                $this->line('   💰 Total ATUAL: R$ '.number_format($currentTotal, 2, ',', '.'));
                $this->line('   ✅ Total CORRETO: R$ '.number_format($correctTotal, 2, ',', '.'));
                $this->line('   📏 Diferença: R$ '.number_format($difference, 2, ',', '.'));

                if (! $hasIncorrectCost || $difference < $threshold) {
                    $this->comment('   ✅ OK');
                    $alreadyCorrect++;

                    continue;
                }

                $this->warn('   ⚠️  NECESSITA CORREÇÃO');

                if (! $dryRun) {
                    // Recalcular frações (reassocia como se fosse na Triagem)
                    $result = $pizzaService->recalculateFractions($orderItem);

                    // Recalcular após a correção
                    $orderItem->refresh();
                    $newManualTotal = $this->calculateManualTotal($orderItem);
                    $newModelTotal = $orderItem->calculateTotalCost();
                    $newDifference = abs($newManualTotal - $newModelTotal);

                    $this->info('   ✅ Recalculado!');
                    $this->line('   🆕 Total manual: R$ '.number_format($newManualTotal, 2, ',', '.'));
                    $this->line('   🆕 Total modelo: R$ '.number_format($newModelTotal, 2, ',', '.'));
                    $this->line('   🆕 Diferença: R$ '.number_format($newDifference, 2, ',', '.'));

                    if ($newDifference < 1.0) {
                        $this->info('   ✨ Corrigido com sucesso!');
                    } else {
                        $this->warn('   ⚠️  Ainda há diferença após correção');
                    }
                } else {
                    $this->comment('   🔍 Seria recalculado (dry-run)');
                }

                $totalDifference += $difference;
                $fixed++;

            } catch (\Exception $e) {
                $this->error("   ❌ Erro ao processar item #{$orderItem->id}: {$e->getMessage()}");
                $errors++;
            }
        }

        $this->line('');
        $this->info('═══════════════════════════════════════');
        $this->info("📊 Total analisado: {$orderItems->count()} items");
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
     * Calcular total atual (o que está salvo no banco)
     */
    protected function calculateCurrentTotal(OrderItem $orderItem): float
    {
        $total = 0;

        foreach ($orderItem->mappings as $mapping) {
            $cost = $mapping->unit_cost_override ?? $mapping->internalProduct?->unit_cost ?? 0;
            $quantity = $mapping->quantity ?? 1.0;
            $total += $cost * $quantity;
        }

        return $total;
    }

    /**
     * Calcular total correto (como deveria estar)
     */
    protected function calculateCorrectTotal(OrderItem $orderItem, ?string $pizzaSize): float
    {
        $total = 0;

        foreach ($orderItem->mappings as $mapping) {
            $quantity = $mapping->quantity ?? 1.0;

            if ($mapping->option_type === 'pizza_flavor' && $pizzaSize && $mapping->internalProduct) {
                // Para sabores de pizza, usar CMV por tamanho
                $correctCMV = $mapping->internalProduct->calculateCMV($pizzaSize);
                $total += $correctCMV * $quantity;
            } else {
                // Para outros items, usar o valor atual
                $cost = $mapping->unit_cost_override ?? $mapping->internalProduct?->unit_cost ?? 0;
                $total += $cost * $quantity;
            }
        }

        return $total;
    }

    /**
     * Detectar tamanho da pizza do OrderItem
     */
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
