<?php

namespace App\Console\Commands;

use App\Models\Order;
use App\Models\OrderItemMapping;
use App\Models\ProductMapping;
use Illuminate\Console\Command;

class DiagnoseOrderMapping extends Command
{
    protected $signature = 'orders:diagnose-mapping {order_id}';

    protected $description = 'Diagnostica estado dos mapeamentos de um pedido';

    public function handle()
    {
        $orderId = $this->argument('order_id');
        $order = Order::with('items')->find($orderId);

        if (! $order) {
            $this->error("❌ Pedido #{$orderId} não encontrado");

            return 1;
        }

        $this->info("🔍 Diagnóstico do Pedido #{$orderId}");
        $this->line('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        foreach ($order->items as $item) {
            $this->info("\n📦 Item: {$item->name}");
            $this->line("   SKU: {$item->sku}");

            foreach ($item->add_ons ?? [] as $index => $addon) {
                $addonName = $addon['name'];
                $addonSku = 'addon_'.md5($addonName);

                $this->line("\n   🔹 Add-on: {$addonName}");

                // 1. Verificar ProductMapping
                $productMapping = ProductMapping::where('tenant_id', $item->tenant_id)
                    ->where('external_item_id', $addonSku)
                    ->first();

                if ($productMapping) {
                    $this->line("      ✅ ProductMapping existe (ID: {$productMapping->id})");
                    $this->line("         - item_type: {$productMapping->item_type}");
                    $this->line("         - internal_product_id: ".($productMapping->internal_product_id ?? 'NULL'));

                    if ($productMapping->internal_product_id) {
                        $internalProduct = \App\Models\InternalProduct::find($productMapping->internal_product_id);
                        if ($internalProduct) {
                            $this->line("         - Produto: {$internalProduct->name}");
                            $this->line("         - CMV: R$ ".number_format($internalProduct->unit_cost, 2, ',', '.'));
                        }
                    } else {
                        $this->warn("         ⚠️  SEM produto vinculado!");
                    }
                } else {
                    $this->error("      ❌ ProductMapping NÃO existe");
                }

                // 2. Verificar OrderItemMapping
                $orderItemMapping = OrderItemMapping::where('order_item_id', $item->id)
                    ->where('external_reference', (string) $index)
                    ->first();

                if ($orderItemMapping) {
                    $this->line("      ✅ OrderItemMapping existe (ID: {$orderItemMapping->id})");
                    $this->line("         - internal_product_id: ".($orderItemMapping->internal_product_id ?? 'NULL'));
                    $this->line("         - quantity: {$orderItemMapping->quantity}");
                    $this->line("         - unit_cost_override: ".($orderItemMapping->unit_cost_override ?? 'NULL'));

                    if ($orderItemMapping->unit_cost_override) {
                        $this->line("         - CMV Override: R$ ".number_format($orderItemMapping->unit_cost_override, 2, ',', '.'));
                    }

                    if (! $orderItemMapping->internal_product_id) {
                        $this->warn("         ⚠️  SEM internal_product_id!");
                    }
                } else {
                    $this->error("      ❌ OrderItemMapping NÃO existe");
                }

                // 3. Diagnóstico final
                $this->line("\n      📊 DIAGNÓSTICO:");

                $hasProductMapping = $productMapping && $productMapping->internal_product_id;
                $hasOrderMapping = $orderItemMapping && $orderItemMapping->internal_product_id;
                $hasCMV = $orderItemMapping && $orderItemMapping->unit_cost_override;

                if ($hasProductMapping && $hasOrderMapping) {
                    $this->info("         ✅ CORRETO: Totalmente vinculado");
                } elseif ($hasCMV && ! $hasProductMapping) {
                    $this->error("         ❌ PROBLEMA: Tem CMV mas ProductMapping sem produto");
                    $this->line("         💡 SOLUÇÃO: Vincular produto na Triagem OU corrigir sync");
                } elseif ($hasCMV && ! $hasOrderMapping) {
                    $this->error("         ❌ PROBLEMA: Tem CMV override mas sem internal_product_id no OrderItemMapping");
                    $this->line("         💡 SOLUÇÃO: Corrigir comando fix-incorrect-fractions");
                } elseif (! $hasProductMapping && ! $hasOrderMapping) {
                    $this->warn("         ⚠️  PENDENTE: Aguardando classificação na Triagem");
                } else {
                    $this->warn("         ⚠️  SITUAÇÃO ANÔMALA: Verificar manualmente");
                }
            }
        }

        $this->line("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

        return 0;
    }
}
