<?php

namespace App\Listeners;

use App\Events\IngredientCostChanged;
use App\Events\ProductCostChanged;
use App\Models\InternalProduct;
use App\Models\ProductCost;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class RecalculateDependentProductCosts
{
    /**
     * Rastreia produtos já processados nesta execução para evitar loops infinitos
     */
    private static array $processedProducts = [];

    /**
     * Handle the event.
     */
    public function handle(IngredientCostChanged|ProductCostChanged $event): void
    {
        // Resetar produtos processados no início de uma nova cadeia de eventos
        if (! isset(self::$processedProducts[$event->tenantId])) {
            self::$processedProducts[$event->tenantId] = [];
        }

        $sourceId = $event instanceof IngredientCostChanged ? $event->ingredientId : $event->productId;
        $sourceType = $event instanceof IngredientCostChanged ? 'ingredient' : 'product';

        // Buscar todos os produtos que usam este insumo/produto como componente
        $dependentProductIds = ProductCost::where('tenant_id', $event->tenantId)
            ->where('ingredient_id', $sourceId)
            ->distinct()
            ->pluck('internal_product_id');

        if ($dependentProductIds->isEmpty()) {
            return;
        }

        Log::info('Recalculando custos de produtos dependentes', [
            'source_type' => $sourceType,
            'source_id' => $sourceId,
            'dependent_products_count' => $dependentProductIds->count(),
            'tenant_id' => $event->tenantId,
        ]);

        DB::beginTransaction();
        try {
            foreach ($dependentProductIds as $productId) {
                // PROTEÇÃO: Verificar se já processamos este produto nesta cadeia de eventos
                if (in_array($productId, self::$processedProducts[$event->tenantId])) {
                    Log::warning('Dependência circular detectada - produto já processado nesta cadeia', [
                        'product_id' => $productId,
                        'source_type' => $sourceType,
                        'source_id' => $sourceId,
                    ]);
                    continue;
                }

                // Marcar produto como processado ANTES de recalcular (previne loops)
                self::$processedProducts[$event->tenantId][] = $productId;

                $product = InternalProduct::find($productId);

                if (! $product) {
                    continue;
                }

                // Verificar se o produto tem ficha técnica (custos)
                $hasCosts = $product->costs()->exists();

                if ($hasCosts) {
                    // Recalcular CMV baseado na ficha técnica ATUAL
                    $newCmv = $product->calculateCMV();

                    // Atualizar o unit_cost apenas se mudou significativamente
                    if (abs($product->unit_cost - $newCmv) > 0.01) {
                        $oldCost = $product->unit_cost;
                        $product->update(['unit_cost' => $newCmv]);

                        Log::info('CMV atualizado no cadastro de produtos', [
                            'product_id' => $product->id,
                            'product_name' => $product->name,
                            'old_cost' => number_format($oldCost, 2, '.', ''),
                            'new_cost' => number_format($newCmv, 2, '.', ''),
                            'difference' => number_format($newCmv - $oldCost, 2, '.', ''),
                            'tenant_id' => $event->tenantId,
                        ]);

                        // Verificar se este produto também é usado como insumo em outros produtos
                        $isUsedAsIngredient = ProductCost::where('tenant_id', $event->tenantId)
                            ->where('ingredient_id', $product->id)
                            ->exists();

                        // Se for usado como insumo, disparar evento em cascata
                        if ($isUsedAsIngredient) {
                            Log::info('Produto é usado como insumo - disparando cascata', [
                                'product_id' => $product->id,
                                'product_name' => $product->name,
                            ]);

                            event(new ProductCostChanged(
                                $product->id,
                                $product->tenant_id,
                                $oldCost,
                                $newCmv
                            ));
                        }
                    } else {
                        Log::debug('CMV não mudou significativamente - ignorando atualização', [
                            'product_id' => $product->id,
                            'product_name' => $product->name,
                            'current_cost' => $product->unit_cost,
                            'calculated_cost' => $newCmv,
                        ]);
                    }
                }
            }

            DB::commit();

            Log::info('Recalculo de custos concluído com sucesso', [
                'source_type' => $sourceType,
                'source_id' => $sourceId,
                'products_updated' => count(self::$processedProducts[$event->tenantId]),
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Erro ao recalcular custos de produtos dependentes', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'source_type' => $sourceType,
                'source_id' => $sourceId,
            ]);

            // Limpar produtos processados em caso de erro
            self::$processedProducts[$event->tenantId] = [];
        }
    }
}
