<?php

namespace App\Console\Commands;

use App\Models\OrderItem;
use App\Models\OrderItemMapping;
use App\Models\ProductMapping;
use Illuminate\Console\Command;

class ReapplyProductMappings extends Command
{
    protected $signature = 'mappings:reapply {--tenant_id=}';

    protected $description = 'Reaplicar todos os ProductMappings existentes aos OrderItems históricos';

    public function handle()
    {
        $tenantId = $this->option('tenant_id');

        if (! $tenantId) {
            $this->error('❌ Informe o tenant_id: --tenant_id=X');

            return 1;
        }

        $this->info("🔄 Reaplicando mapeamentos para tenant {$tenantId}...");

        // Buscar todos os ProductMappings do tenant
        $mappings = ProductMapping::where('tenant_id', $tenantId)->get();

        $this->info("📋 Encontrados {$mappings->count()} mapeamentos");

        $totalItemsMapped = 0;

        foreach ($mappings as $mapping) {
            $this->line("\n🔍 Processando: {$mapping->external_item_name} (SKU: {$mapping->external_item_id})");

            // Buscar todos os OrderItems com este SKU
            $orderItems = OrderItem::where('tenant_id', $tenantId)
                ->where('sku', $mapping->external_item_id)
                ->get();

            $this->info("   ├─ Encontrados {$orderItems->count()} items com este SKU");

            foreach ($orderItems as $orderItem) {
                // Verificar se já tem mapping principal
                $hasMainMapping = OrderItemMapping::where('order_item_id', $orderItem->id)
                    ->where('mapping_type', 'main')
                    ->exists();

                if ($hasMainMapping) {
                    $this->line("   ├─ Item {$orderItem->id} (Pedido {$orderItem->order_id}) já tem mapping");

                    continue;
                }

                // Criar OrderItemMapping principal
                OrderItemMapping::create([
                    'tenant_id' => $tenantId,
                    'order_item_id' => $orderItem->id,
                    'internal_product_id' => $mapping->internal_product_id,
                    'quantity' => 1.0,
                    'mapping_type' => 'main',
                    'option_type' => 'regular',
                    'auto_fraction' => false,
                ]);

                $this->info("   ├─ ✅ Criado mapping para item {$orderItem->id} (Pedido {$orderItem->order_id})");
                $totalItemsMapped++;
            }
        }

        $this->newLine();
        $this->info("✅ Concluído! Total de items mapeados: {$totalItemsMapped}");

        return 0;
    }
}
