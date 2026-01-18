<?php

namespace App\Console\Commands;

use App\Models\InternalProduct;
use App\Models\OrderItem;
use App\Models\OrderItemMapping;
use App\Models\ProductMapping;
use App\Services\PizzaFractionService;
use Illuminate\Console\Command;

class ReapplyAllProductMappings extends Command
{
    protected $signature = 'mappings:reapply-all
                            {--tenant-id= : ID do tenant específico}
                            {--sku= : SKU específico para reaplicar}
                            {--dry-run : Simula sem salvar no banco}';

    protected $description = 'Reaplicar mapeamentos de produtos para OrderItems que não têm OrderItemMapping (mesma lógica da Triagem)';

    public function handle(): int
    {
        $tenantId = $this->option('tenant-id');
        $specificSku = $this->option('sku');
        $isDryRun = $this->option('dry-run');

        if ($isDryRun) {
            $this->warn('🔍 Modo DRY-RUN ativado - Nenhuma alteração será salva');
        }

        // Buscar todos os ProductMappings com produto vinculado
        $mappingsQuery = ProductMapping::whereNotNull('internal_product_id');

        if ($tenantId) {
            $mappingsQuery->where('tenant_id', $tenantId);
        }

        if ($specificSku) {
            $mappingsQuery->where('external_item_id', $specificSku);
        }

        $mappings = $mappingsQuery->get();

        $this->info("📦 Encontrados {$mappings->count()} ProductMappings com produto vinculado");

        $totalProcessed = 0;
        $totalCreated = 0;
        $totalSkipped = 0;
        $totalErrors = 0;

        foreach ($mappings as $mapping) {
            try {
                $result = $this->reapplyMappingToOrders($mapping, $isDryRun);

                $totalProcessed += $result['processed'];
                $totalCreated += $result['created'];
                $totalSkipped += $result['skipped'];

                if ($result['created'] > 0) {
                    $this->line("  ✅ SKU: {$mapping->external_item_id} - {$result['created']} OrderItemMappings criados");
                }
            } catch (\Exception $e) {
                $totalErrors++;
                $this->error("  ❌ Erro ao processar SKU {$mapping->external_item_id}: {$e->getMessage()}");
                logger()->error('Erro ao reaplicar mapeamento', [
                    'mapping_id' => $mapping->id,
                    'sku' => $mapping->external_item_id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        $this->newLine();
        $this->info('📊 Resumo:');
        $this->table(
            ['Métrica', 'Quantidade'],
            [
                ['ProductMappings processados', $mappings->count()],
                ['OrderItems analisados', $totalProcessed],
                ['OrderItemMappings criados', $totalCreated],
                ['OrderItems ignorados (já tinham mapping)', $totalSkipped],
                ['Erros', $totalErrors],
            ]
        );

        if ($isDryRun) {
            $this->warn('🔍 DRY-RUN: Nenhuma alteração foi salva. Execute sem --dry-run para aplicar.');
        }

        return self::SUCCESS;
    }

    /**
     * Reaplicar mapeamento para todos os pedidos com este SKU
     * (Mesma lógica do ItemTriageController::applyMappingToHistoricalOrders)
     */
    protected function reapplyMappingToOrders(ProductMapping $mapping, bool $isDryRun): array
    {
        $processed = 0;
        $created = 0;
        $skipped = 0;

        // Buscar todos os OrderItems com este SKU que NÃO têm OrderItemMapping do tipo 'main'
        $orderItems = OrderItem::where('tenant_id', $mapping->tenant_id)
            ->where('sku', $mapping->external_item_id)
            ->whereDoesntHave('mappings', function ($q) {
                $q->where('mapping_type', 'main');
            })
            ->get();

        foreach ($orderItems as $orderItem) {
            $processed++;

            // Buscar produto interno para calcular CMV
            $product = InternalProduct::find($mapping->internal_product_id);

            if (! $product) {
                $skipped++;

                continue;
            }

            $correctCMV = $this->calculateCorrectCMV($product, $orderItem);

            // logger()->info('🔄 Reaplicando mapeamento', [
            //     'order_item_id' => $orderItem->id,
            //     'order_id' => $orderItem->order_id,
            //     'sku' => $orderItem->sku,
            //     'product_id' => $product->id,
            //     'product_name' => $product->name,
            //     'cmv' => $correctCMV,
            //     'dry_run' => $isDryRun,
            // ]);

            if (! $isDryRun) {
                // Criar OrderItemMapping principal
                OrderItemMapping::create([
                    'tenant_id' => $mapping->tenant_id,
                    'order_item_id' => $orderItem->id,
                    'internal_product_id' => $mapping->internal_product_id,
                    'quantity' => 1.0,
                    'mapping_type' => 'main',
                    'option_type' => 'regular',
                    'auto_fraction' => false,
                    'unit_cost_override' => $correctCMV,
                ]);

                // Mapear add-ons se houverem
                $this->mapAddOns($orderItem, $mapping);
            }

            $created++;
        }

        return [
            'processed' => $processed,
            'created' => $created,
            'skipped' => $skipped,
        ];
    }

    /**
     * Mapear add-ons do OrderItem
     */
    protected function mapAddOns(OrderItem $orderItem, ProductMapping $parentMapping): void
    {
        $addOns = $orderItem->add_ons ?? [];
        $hasPizzaFlavors = false;

        foreach ($addOns as $index => $addOn) {
            $addonName = $addOn['name'] ?? '';
            $addonQty = $addOn['quantity'] ?? $addOn['qty'] ?? 1;

            // Buscar mapeamento para o add-on
            $addonMapping = ProductMapping::where('tenant_id', $orderItem->tenant_id)
                ->where(function ($q) use ($addonName) {
                    $q->where('external_item_name', 'LIKE', "%{$addonName}%");
                })
                ->first();

            if ($addonMapping && $addonMapping->internal_product_id) {
                // Detectar se é sabor de pizza
                $isPizzaFlavor = stripos($addOn['name'] ?? '', 'pizza') !== false
                    || stripos($parentMapping->external_item_name ?? '', 'pizza') !== false
                    || $addonMapping->item_type === 'flavor';

                if ($isPizzaFlavor) {
                    $hasPizzaFlavors = true;
                }

                // Buscar produto do addon para calcular CMV
                $addonProduct = InternalProduct::find($addonMapping->internal_product_id);
                $addonCMV = $addonProduct ? $this->calculateCorrectCMV($addonProduct, $orderItem) : null;

                // Verificar se já existe mapping para evitar duplicatas
                $existingMapping = OrderItemMapping::where('order_item_id', $orderItem->id)
                    ->where('mapping_type', 'addon')
                    ->where('external_reference', (string) $index)
                    ->first();

                if (! $existingMapping) {
                    OrderItemMapping::create([
                        'tenant_id' => $orderItem->tenant_id,
                        'order_item_id' => $orderItem->id,
                        'internal_product_id' => $addonMapping->internal_product_id,
                        'quantity' => $addonQty,
                        'mapping_type' => 'addon',
                        'option_type' => $isPizzaFlavor ? 'pizza_flavor' : 'addon',
                        'auto_fraction' => $isPizzaFlavor,
                        'external_reference' => (string) $index,
                        'external_name' => $addonName,
                        'unit_cost_override' => $addonCMV,
                    ]);

                    // logger()->info('🍕 Add-on mapeado', [
                    //     'order_item' => $orderItem->id,
                    //     'addon_name' => $addonName,
                    //     'product_id' => $addonMapping->internal_product_id,
                    //     'is_pizza_flavor' => $isPizzaFlavor,
                    //     'cmv' => $addonCMV,
                    // ]);
                }
            }
        }

        // Se houver sabores de pizza, recalcular frações
        if ($hasPizzaFlavors) {
            $pizzaFractionService = app(PizzaFractionService::class);
            $result = $pizzaFractionService->recalculateFractions($orderItem);

            // logger()->info('🍕 Frações recalculadas', [
            //     'order_item' => $orderItem->id,
            //     'pizza_flavors' => $result['pizza_flavors'],
            //     'fraction' => $result['fraction'],
            //     'updated' => $result['updated'],
            // ]);
        }
    }

    /**
     * Calcular CMV correto baseado no tamanho do produto
     * (Mesma lógica do ItemTriageController)
     */
    protected function calculateCorrectCMV(InternalProduct $product, OrderItem $orderItem): ?float
    {
        // Se não for sabor de pizza, usar unit_cost padrão
        if ($product->product_category !== 'sabor_pizza') {
            return $product->unit_cost;
        }

        // Detectar tamanho da pizza
        $pizzaSize = $this->detectPizzaSize($product, $orderItem);

        if (! $pizzaSize) {
            logger()->warning('⚠️ Não foi possível detectar tamanho da pizza', [
                'product_id' => $product->id,
                'product_name' => $product->name,
                'order_item_name' => $orderItem->name,
            ]);

            return $product->unit_cost; // Fallback
        }

        // Calcular CMV pelo tamanho
        $correctCMV = $product->calculateCMV($pizzaSize);

        // logger()->info('🍕 CMV calculado por tamanho', [
        //     'product_id' => $product->id,
        //     'product_name' => $product->name,
        //     'size' => $pizzaSize,
        //     'cmv' => $correctCMV,
        //     'generic_unit_cost' => $product->unit_cost,
        // ]);

        return $correctCMV;
    }

    /**
     * Detectar tamanho da pizza
     * (Mesma lógica do ItemTriageController)
     */
    protected function detectPizzaSize(InternalProduct $product, OrderItem $orderItem): ?string
    {
        // 1. Tentar detectar pelo produto pai (se houver mapping principal)
        $mainMapping = OrderItemMapping::where('order_item_id', $orderItem->id)
            ->where('mapping_type', 'main')
            ->with('internalProduct')
            ->first();

        if ($mainMapping && $mainMapping->internalProduct?->size) {
            return $mainMapping->internalProduct->size;
        }

        // 2. Tentar detectar do nome do OrderItem
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

        // 3. Se o produto interno tem size, usar ele
        if ($product->size) {
            return $product->size;
        }

        return null;
    }
}
