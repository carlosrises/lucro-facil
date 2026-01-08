<?php

namespace App\Console\Commands;

use App\Models\OrderItem;
use App\Models\OrderItemMapping;
use App\Models\ProductMapping;
use Illuminate\Console\Command;

class RecalculatePizzaFractions extends Command
{
    protected $signature = 'orders:recalculate-pizza-fractions
                            {--tenant= : ID do tenant específico}
                            {--order= : Código do pedido específico}
                            {--dry-run : Simular sem salvar alterações}
                            {--debug : Mostrar detalhes das alterações}';

    protected $description = 'Recalcula frações de sabores de pizza e quantidades de add-ons em mappings existentes';

    public function handle(): int
    {
        $tenantId = $this->option('tenant');
        $orderCode = $this->option('order');
        $dryRun = $this->option('dry-run');
        $debug = $this->option('debug');

        $this->info('🍕 Iniciando recálculo de frações de pizza...');
        if ($dryRun) {
            $this->warn('⚠️  Modo DRY-RUN ativado - nenhuma alteração será salva');
        }

        // Buscar order_items com mappings de pizza
        $query = OrderItemMapping::whereNotNull('order_item_id')
            ->where('mapping_type', 'addon')
            ->where('option_type', 'pizza_flavor')
            ->where('auto_fraction', true);

        if ($tenantId) {
            $query->where('tenant_id', $tenantId);
            $this->info("🔍 Filtrando por tenant: {$tenantId}");
        }

        if ($orderCode) {
            $query->whereHas('orderItem.order', function ($q) use ($orderCode) {
                $q->where('code', $orderCode);
            });
            $this->info("🔍 Filtrando por pedido: {$orderCode}");
        }

        $mappings = $query->with(['orderItem.order'])->get();
        
        if ($mappings->isEmpty()) {
            $this->info('✅ Nenhum mapping de pizza encontrado para recalcular');
            return 0;
        }

        $this->info("📊 Encontrados {$mappings->count()} mappings de pizza");

        // Agrupar por order_item para processar juntos
        $mappingsByOrderItem = $mappings->groupBy('order_item_id');
        
        $stats = [
            'order_items_processed' => 0,
            'mappings_updated' => 0,
            'mappings_unchanged' => 0,
        ];

        $progressBar = $this->output->createProgressBar($mappingsByOrderItem->count());
        $progressBar->start();

        foreach ($mappingsByOrderItem as $orderItemId => $orderItemMappings) {
            $orderItem = OrderItem::find($orderItemId);
            
            if (!$orderItem) {
                $progressBar->advance();
                continue;
            }

            // Filtrar apenas sabores classificados (têm ProductMapping tipo 'flavor')
            $classifiedMappings = $orderItemMappings->filter(function ($mapping) use ($orderItem) {
                $addOns = $orderItem->add_ons;
                if (!is_array($addOns) || !isset($addOns[$mapping->external_reference])) {
                    return false;
                }

                $addOn = $addOns[$mapping->external_reference];
                $addOnName = $addOn['name'] ?? '';
                if (!$addOnName) {
                    return false;
                }

                // Verificar se tem ProductMapping tipo 'flavor'
                $addOnSku = 'addon_'.md5($addOnName);
                $productMapping = ProductMapping::where('tenant_id', $orderItem->tenant_id)
                    ->where('external_item_id', $addOnSku)
                    ->where('item_type', 'flavor')
                    ->first();

                return $productMapping !== null;
            });

            if ($classifiedMappings->isEmpty()) {
                $progressBar->advance();
                continue;
            }

            $totalFlavors = $classifiedMappings->count();
            $newFraction = 1.0 / $totalFlavors;

            if ($debug) {
                $this->newLine();
                $this->line("📦 Order Item ID: {$orderItem->id} | Pedido: {$orderItem->order->code}");
                $this->line("   Total de sabores classificados: {$totalFlavors}");
                $this->line("   Nova fração: {$newFraction}");
            }

            // Atualizar cada mapping
            foreach ($classifiedMappings as $mapping) {
                // Buscar quantidade do add-on
                $addOns = $orderItem->add_ons;
                $addOnQuantity = 1;

                if (is_array($addOns) && isset($addOns[$mapping->external_reference])) {
                    $addOn = $addOns[$mapping->external_reference];
                    $addOnQuantity = $addOn['quantity'] ?? $addOn['qty'] ?? 1;
                }

                $newQuantity = round($newFraction * $addOnQuantity, 4);
                $oldQuantity = $mapping->quantity;

                if (abs($newQuantity - $oldQuantity) < 0.0001) {
                    $stats['mappings_unchanged']++;
                    continue;
                }

                if ($debug) {
                    $addOnName = $addOns[$mapping->external_reference]['name'] ?? 'N/A';
                    $this->line("   └─ {$addOnName}");
                    $this->line("      Quantidade add-on: {$addOnQuantity}x");
                    $this->line("      Quantity antiga: {$oldQuantity} → nova: {$newQuantity}");
                }

                if (!$dryRun) {
                    $mapping->update(['quantity' => $newQuantity]);
                }

                $stats['mappings_updated']++;
            }

            $stats['order_items_processed']++;
            $progressBar->advance();
        }

        $progressBar->finish();

        $this->newLine(2);
        $this->info('📊 Estatísticas:');
        $this->table(
            ['Métrica', 'Valor'],
            [
                ['Order Items processados', $stats['order_items_processed']],
                ['Mappings atualizados', $stats['mappings_updated']],
                ['Mappings sem alteração', $stats['mappings_unchanged']],
            ]
        );

        if ($dryRun) {
            $this->warn('⚠️  Nenhuma alteração foi salva (modo dry-run)');
            $this->info('💡 Execute sem --dry-run para aplicar as mudanças');
        } else {
            $this->info('✅ Recálculo concluído com sucesso!');
            
            if ($stats['mappings_updated'] > 0) {
                $this->info('💡 Os custos dos pedidos serão recalculados automaticamente na próxima visualização');
            }
        }

        return 0;
    }
}
