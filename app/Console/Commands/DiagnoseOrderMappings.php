<?php

namespace App\Console\Commands;

use App\Models\InternalProduct;
use App\Models\OrderItem;
use App\Models\ProductMapping;
use Illuminate\Console\Command;

class DiagnoseOrderMappings extends Command
{
    protected $signature = 'orders:diagnose-mappings {tenant_id}';

    protected $description = 'Diagnóstico de mapeamento de produtos por tenant';

    public function handle()
    {
        $tenantId = $this->argument('tenant_id');

        $this->info("🔍 Diagnóstico para Tenant ID: {$tenantId}");
        $this->newLine();

        // 1. Produtos Internos
        $internalProductsCount = InternalProduct::where('tenant_id', $tenantId)->count();
        $this->info("📦 Produtos Internos cadastrados: {$internalProductsCount}");

        if ($internalProductsCount > 0) {
            $products = InternalProduct::where('tenant_id', $tenantId)
                ->select('id', 'name', 'sku')
                ->limit(5)
                ->get();
            $this->table(['ID', 'Nome', 'SKU'], $products->map(fn ($p) => [$p->id, $p->name, $p->sku ?? 'N/A']));
        }

        $this->newLine();

        // 2. Itens de Pedidos
        $orderItemsCount = OrderItem::where('tenant_id', $tenantId)->count();
        $orderItemsWithSku = OrderItem::where('tenant_id', $tenantId)->whereNotNull('sku')->count();
        $this->info("📋 Total de Order Items: {$orderItemsCount}");
        $this->info("📋 Order Items com SKU: {$orderItemsWithSku}");

        $this->newLine();

        // 3. Mapeamentos
        $mappingsCount = ProductMapping::where('tenant_id', $tenantId)->count();
        $this->info("🔗 Mapeamentos existentes: {$mappingsCount}");

        if ($mappingsCount > 0) {
            $mappings = ProductMapping::where('tenant_id', $tenantId)
                ->with('internalProduct:id,name')
                ->limit(5)
                ->get();
            $this->table(
                ['External SKU', 'External Name', 'Produto Interno'],
                $mappings->map(fn ($m) => [
                    $m->external_item_id,
                    $m->external_item_name,
                    $m->internalProduct->name ?? 'N/A',
                ])
            );
        }

        $this->newLine();

        // 4. Produtos não mapeados (lógica do controller)
        $unmappedCount = OrderItem::query()
            ->where('tenant_id', $tenantId)
            ->whereNotNull('sku')
            ->whereNotIn('sku', function ($query) use ($tenantId) {
                $query->select('external_item_id')
                    ->from('product_mappings')
                    ->where('tenant_id', $tenantId);
            })
            ->distinct('sku')
            ->count('sku');

        $this->warn("⚠️  Produtos NÃO mapeados: {$unmappedCount}");

        if ($unmappedCount > 0) {
            $unmapped = OrderItem::query()
                ->where('tenant_id', $tenantId)
                ->whereNotNull('sku')
                ->whereNotIn('sku', function ($query) use ($tenantId) {
                    $query->select('external_item_id')
                        ->from('product_mappings')
                        ->where('tenant_id', $tenantId);
                })
                ->select('sku', 'name')
                ->distinct()
                ->limit(10)
                ->get();

            $this->table(['SKU', 'Nome do Item'], $unmapped->map(fn ($i) => [$i->sku, $i->name]));
        }

        $this->newLine();

        // Resumo
        if ($internalProductsCount === 0) {
            $this->error('❌ PROBLEMA: Não há produtos internos cadastrados!');
            $this->info('💡 Solução: Cadastre produtos internos em Cadastros > Produtos');
        } elseif ($unmappedCount === 0) {
            $this->info('✅ Todos os produtos já estão associados!');
        } else {
            $this->warn("⚠️  Existem {$unmappedCount} produtos sem associação");
            $this->info('💡 O banner deveria estar aparecendo na página de Pedidos');
        }

        return Command::SUCCESS;
    }
}
