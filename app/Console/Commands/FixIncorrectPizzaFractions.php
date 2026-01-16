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
        })->with(['mappings.internalProduct', 'order']);

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

        foreach ($orderItems as $orderItem) {
            try {
                // Calcular total manual (soma de todos mappings)
                $manualTotal = $this->calculateManualTotal($orderItem);
                
                // Calcular usando o método do model
                $modelTotal = $orderItem->calculateTotalCost();
                
                // Calcular diferença
                $difference = abs($manualTotal - $modelTotal);

                if ($difference < $threshold) {
                    $alreadyCorrect++;
                    continue;
                }

                $this->line('');
                $this->warn("⚠️  Pedido #{$orderItem->order_id} - Item #{$orderItem->id}: {$orderItem->name}");
                $this->line("   💰 Total manual: R$ " . number_format($manualTotal, 2, ',', '.'));
                $this->line("   📊 Total modelo: R$ " . number_format($modelTotal, 2, ',', '.'));
                $this->line("   ⚠️  Diferença: R$ " . number_format($difference, 2, ',', '.'));

                if (!$dryRun) {
                    // Recalcular frações (reassocia como se fosse na Triagem)
                    $result = $pizzaService->recalculateFractions($orderItem);
                    
                    // Recalcular após a correção
                    $orderItem->refresh();
                    $newManualTotal = $this->calculateManualTotal($orderItem);
                    $newModelTotal = $orderItem->calculateTotalCost();
                    $newDifference = abs($newManualTotal - $newModelTotal);

                    $this->info("   ✅ Recalculado!");
                    $this->line("   🆕 Total manual: R$ " . number_format($newManualTotal, 2, ',', '.'));
                    $this->line("   🆕 Total modelo: R$ " . number_format($newModelTotal, 2, ',', '.'));
                    $this->line("   🆕 Diferença: R$ " . number_format($newDifference, 2, ',', '.'));
                    
                    if ($newDifference < 1.0) {
                        $this->info("   ✨ Corrigido com sucesso!");
                    } else {
                        $this->warn("   ⚠️  Ainda há diferença após correção");
                    }
                } else {
                    $this->comment("   🔍 Seria recalculado (dry-run)");
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
        $this->info('🔧 ' . ($dryRun ? 'Seriam corrigidos' : 'Corrigidos') . ": {$fixed}");
        $this->info("💰 Diferença total encontrada: R$ " . number_format($totalDifference, 2, ',', '.'));

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
     * Calcular total manual somando todos os mappings
     */
    protected function calculateManualTotal(OrderItem $orderItem): float
    {
        $total = 0;

        foreach ($orderItem->mappings as $mapping) {
            if ($mapping->mapping_type === 'main') {
                // Item principal
                $cost = $mapping->unit_cost_override ?? $mapping->internalProduct?->unit_cost ?? 0;
                $total += $cost * $mapping->quantity;
            } elseif ($mapping->mapping_type === 'addon') {
                // Add-ons (incluindo sabores de pizza)
                $cost = $mapping->unit_cost_override ?? $mapping->internalProduct?->unit_cost ?? 0;
                $total += $cost * $mapping->quantity;
            }
        }

        return $total;
    }
}
