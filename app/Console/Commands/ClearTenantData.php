<?php

namespace App\Console\Commands;

use App\Models\Category;
use App\Models\Ingredient;
use App\Models\InternalProduct;
use App\Models\ProductCost;
use App\Models\TaxCategory;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class ClearTenantData extends Command
{
    protected $signature = 'tenant:clear {tenantId} {--force : Executar sem confirmação}';

    protected $description = 'Remove categorias, insumos, produtos e relações de um tenant (USE COM CUIDADO)';

    public function handle(): int
    {
        $tenantId = (int) $this->argument('tenantId');
        $force = $this->option('force');

        $this->info('⚠️  Comando perigoso: irá apagar dados do tenant especificado');
        $this->line("Tenant alvo: {$tenantId}");

        if (! $force) {
            $this->newLine();
            if (! $this->confirm('Deseja continuar e remover os dados listados para este tenant?', false)) {
                $this->info('❌ Operação cancelada.');
                return 1;
            }
        }

        DB::beginTransaction();

        try {
            $this->info('🔄 Iniciando remoção dos dados do tenant...');

            // Ordem importante para evitar constraint errors
            $deletedProductCosts = ProductCost::where('tenant_id', $tenantId)->delete();
            $this->line("   • Relações produto-insumo removidas: {$deletedProductCosts}");

            $deletedProducts = InternalProduct::where('tenant_id', $tenantId)->delete();
            $this->line("   • Produtos removidos: {$deletedProducts}");

            $deletedIngredients = Ingredient::where('tenant_id', $tenantId)->delete();
            $this->line("   • Insumos removidos: {$deletedIngredients}");

            $deletedCategories = Category::where('tenant_id', $tenantId)->delete();
            $this->line("   • Categorias removidas: {$deletedCategories}");

            $deletedTaxCategories = TaxCategory::where('tenant_id', $tenantId)->delete();
            $this->line("   • Categorias fiscais removidas: {$deletedTaxCategories}");

            DB::commit();

            $this->info('✅ Remoção concluída com sucesso');

            return 0;
        } catch (\Exception $e) {
            DB::rollBack();
            $this->error('❌ Erro ao remover dados: '.$e->getMessage());
            return 1;
        }
    }
}
