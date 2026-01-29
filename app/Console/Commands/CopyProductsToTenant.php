<?php

namespace App\Console\Commands;

use App\Models\Category;
use App\Models\Ingredient;
use App\Models\InternalProduct;
use App\Models\ProductCost;
use App\Models\TaxCategory;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class CopyProductsToTenant extends Command
{
    protected $signature = 'tenant:copy-products {sourceTenantId} {targetTenantId} {--force : Executar sem confirmação}';

    protected $description = 'Copia insumos, produtos e categorias de um tenant para outro';

    private array $categoryMap = [];

    private array $taxCategoryMap = [];

    private array $ingredientMap = [];

    private array $productMap = [];

    public function handle(): int
    {
        $sourceTenantId = (int) $this->argument('sourceTenantId');
        $targetTenantId = (int) $this->argument('targetTenantId');
        $force = $this->option('force');

        $this->info('═══════════════════════════════════════════════════════════════');
        $this->info('📦 CÓPIA DE PRODUTOS ENTRE TENANTS');
        $this->info('═══════════════════════════════════════════════════════════════');
        $this->newLine();

        // Validar tenants
        if ($sourceTenantId === $targetTenantId) {
            $this->error('❌ Tenant de origem e destino não podem ser iguais!');

            return 1;
        }

        $this->info("🔵 Tenant ORIGEM: {$sourceTenantId}");
        $this->info("🟢 Tenant DESTINO: {$targetTenantId}");
        $this->newLine();

        // Contar registros na origem
        $sourceCounts = $this->getSourceCounts($sourceTenantId);
        $this->info('📊 Registros na ORIGEM:');
        $this->line("   • Categorias: {$sourceCounts['categories']}");
        $this->line("   • Categorias Fiscais: {$sourceCounts['tax_categories']}");
        $this->line("   • Insumos: {$sourceCounts['ingredients']}");
        $this->line("   • Produtos: {$sourceCounts['products']}");
        $this->line("   • Relações Produto-Insumo: {$sourceCounts['product_costs']}");
        $this->newLine();

        // Contar registros no destino
        $targetCounts = $this->getSourceCounts($targetTenantId);
        $this->info('📊 Registros no DESTINO (antes):');
        $this->line("   • Categorias: {$targetCounts['categories']}");
        $this->line("   • Categorias Fiscais: {$targetCounts['tax_categories']}");
        $this->line("   • Insumos: {$targetCounts['ingredients']}");
        $this->line("   • Produtos: {$targetCounts['products']}");
        $this->line("   • Relações Produto-Insumo: {$targetCounts['product_costs']}");
        $this->newLine();

        if ($sourceCounts['products'] === 0 && $sourceCounts['ingredients'] === 0) {
            $this->warn('⚠️  Não há produtos ou insumos para copiar!');

            return 0;
        }

        // Confirmação
        if (! $force) {
            $this->warn('⚠️  Os dados serão ADICIONADOS ao tenant destino.');
            $this->warn('⚠️  Se já existirem categorias/insumos/produtos com mesmo nome, serão criados duplicados.');
            $this->newLine();

            if (! $this->confirm('Deseja continuar?', false)) {
                $this->info('❌ Operação cancelada.');

                return 1;
            }
        }

        $this->newLine();
        $this->info('🔄 Iniciando cópia...');
        $this->newLine();

        DB::beginTransaction();

        try {
            // 1. Copiar Categorias de Produtos
            $this->copyCategories($sourceTenantId, $targetTenantId);

            // 2. Copiar Categorias Fiscais
            $this->copyTaxCategories($sourceTenantId, $targetTenantId);

            // 3. Copiar Insumos
            $this->copyIngredients($sourceTenantId, $targetTenantId);

            // 4. Copiar Produtos
            $this->copyProducts($sourceTenantId, $targetTenantId);

            // 5. Copiar Relações Produto-Insumo
            $this->copyProductCosts($sourceTenantId, $targetTenantId);

            DB::commit();

            $this->newLine();
            $this->info('═══════════════════════════════════════════════════════════════');
            $this->info('✅ Cópia concluída com sucesso!');
            $this->info('═══════════════════════════════════════════════════════════════');

            // Mostrar contagem após
            $this->newLine();
            $targetCountsAfter = $this->getSourceCounts($targetTenantId);
            $this->info('📊 Registros no DESTINO (depois):');
            $this->line("   • Categorias: {$targetCountsAfter['categories']} (+".($targetCountsAfter['categories'] - $targetCounts['categories']).')');
            $this->line("   • Categorias Fiscais: {$targetCountsAfter['tax_categories']} (+".($targetCountsAfter['tax_categories'] - $targetCounts['tax_categories']).')');
            $this->line("   • Insumos: {$targetCountsAfter['ingredients']} (+".($targetCountsAfter['ingredients'] - $targetCounts['ingredients']).')');
            $this->line("   • Produtos: {$targetCountsAfter['products']} (+".($targetCountsAfter['products'] - $targetCounts['products']).')');
            $this->line("   • Relações: {$targetCountsAfter['product_costs']} (+".($targetCountsAfter['product_costs'] - $targetCounts['product_costs']).')');

            return 0;

        } catch (\Exception $e) {
            DB::rollBack();
            $this->error("❌ Erro durante a cópia: {$e->getMessage()}");
            $this->error("Stack trace: {$e->getTraceAsString()}");

            return 1;
        }
    }

    private function copyCategories(int $sourceTenantId, int $targetTenantId): void
    {
        $this->info('📁 Copiando Categorias...');

        $categories = Category::where('tenant_id', $sourceTenantId)->get();

        foreach ($categories as $category) {
            // Evitar duplicados: comparar por nome normalizado (trim + lowercase) e tipo
            $normalizedName = mb_strtolower(trim($category->name));

            $existing = Category::where('tenant_id', $targetTenantId)
                ->whereRaw('LOWER(TRIM(name)) = ?', [$normalizedName])
                ->where('type', $category->type)
                ->first();

            if ($existing) {
                $this->categoryMap[$category->id] = $existing->id;
                $this->line("   ⚠️  {$category->name} já existe no destino → ID {$existing->id}");

                continue;
            }

            // Replicar e garantir nome limpo antes de salvar
            $newCategory = $category->replicate();
            $newCategory->tenant_id = $targetTenantId;
            $newCategory->name = trim($category->name);

            try {
                $newCategory->save();
            } catch (\Illuminate\Database\QueryException $e) {
                // Em caso de race ou constraint, tentar buscar o registro existente e reutilizar
                if (str_contains($e->getMessage(), 'Integrity constraint violation')) {
                    $found = Category::where('tenant_id', $targetTenantId)
                        ->where('type', $category->type)
                        ->whereRaw('LOWER(TRIM(name)) = ?', [$normalizedName])
                        ->first();

                    if ($found) {
                        $this->categoryMap[$category->id] = $found->id;
                        $this->line("   ⚠️  {$category->name} já existe no destino (resolvido) → ID {$found->id}");

                        continue;
                    }
                }

                throw $e;
            }

            $this->categoryMap[$category->id] = $newCategory->id;
            $this->line("   ✅ {$newCategory->name} → ID {$newCategory->id}");
        }

        $this->info("   📊 Total: {$categories->count()} categorias copiadas");
        $this->newLine();
    }

    private function copyTaxCategories(int $sourceTenantId, int $targetTenantId): void
    {
        $this->info('💰 Copiando Categorias Fiscais...');

        $taxCategories = TaxCategory::where('tenant_id', $sourceTenantId)->get();

        foreach ($taxCategories as $taxCategory) {
            $newTaxCategory = $taxCategory->replicate();
            $newTaxCategory->tenant_id = $targetTenantId;
            $newTaxCategory->save();

            $this->taxCategoryMap[$taxCategory->id] = $newTaxCategory->id;
            $this->line("   ✅ {$taxCategory->name} ({$taxCategory->total_tax_rate}%) → ID {$newTaxCategory->id}");
        }

        $this->info("   📊 Total: {$taxCategories->count()} categorias fiscais copiadas");
        $this->newLine();
    }

    private function copyIngredients(int $sourceTenantId, int $targetTenantId): void
    {
        $this->info('🥕 Copiando Insumos...');

        $ingredients = Ingredient::where('tenant_id', $sourceTenantId)->get();

        foreach ($ingredients as $ingredient) {
            $newIngredient = $ingredient->replicate();
            $newIngredient->tenant_id = $targetTenantId;
            $newIngredient->save();

            $this->ingredientMap[$ingredient->id] = $newIngredient->id;
            $this->line("   ✅ {$ingredient->name} (R$ {$ingredient->unit_cost}/{$ingredient->unit}) → ID {$newIngredient->id}");
        }

        $this->info("   📊 Total: {$ingredients->count()} insumos copiados");
        $this->newLine();
    }

    private function copyProducts(int $sourceTenantId, int $targetTenantId): void
    {
        $this->info('📦 Copiando Produtos...');

        $products = InternalProduct::where('tenant_id', $sourceTenantId)->get();

        foreach ($products as $product) {
            $newProduct = $product->replicate();
            $newProduct->tenant_id = $targetTenantId;

            // Mapear category_id se existir
            if ($product->category_id && isset($this->categoryMap[$product->category_id])) {
                $newProduct->category_id = $this->categoryMap[$product->category_id];
            }

            // Mapear tax_category_id se existir
            if ($product->tax_category_id && isset($this->taxCategoryMap[$product->tax_category_id])) {
                $newProduct->tax_category_id = $this->taxCategoryMap[$product->tax_category_id];
            }

            $newProduct->save();

            $this->productMap[$product->id] = $newProduct->id;
            $this->line("   ✅ {$product->name} (R$ {$product->unit_cost}) → ID {$newProduct->id}");
        }

        $this->info("   📊 Total: {$products->count()} produtos copiados");
        $this->newLine();
    }

    private function copyProductCosts(int $sourceTenantId, int $targetTenantId): void
    {
        $this->info('🔗 Copiando Relações Produto-Insumo...');

        $productCosts = ProductCost::where('tenant_id', $sourceTenantId)->get();

        foreach ($productCosts as $productCost) {
            // Verificar se temos os mapeamentos necessários
            if (! isset($this->productMap[$productCost->internal_product_id])) {
                $this->warn("   ⚠️  Produto ID {$productCost->internal_product_id} não encontrado no mapa");

                continue;
            }

            // Determinar mapeamento para ingredient_id: pode ser um Insumo (Ingredient) ou um Produto (InternalProduct)
            $mappedIngredientId = null;

            if (isset($this->ingredientMap[$productCost->ingredient_id])) {
                $mappedIngredientId = $this->ingredientMap[$productCost->ingredient_id];
                $ingredientIsProduct = false;
            } elseif (isset($this->productMap[$productCost->ingredient_id])) {
                // O ingrediente original era um InternalProduct; mapear para o novo InternalProduct id
                $mappedIngredientId = $this->productMap[$productCost->ingredient_id];
                $ingredientIsProduct = true;
            } else {
                $this->warn("   ⚠️  Insumo/Produto ID {$productCost->ingredient_id} não encontrado no mapa");

                continue;
            }

            $newProductCost = $productCost->replicate();
            $newProductCost->tenant_id = $targetTenantId;
            $newProductCost->internal_product_id = $this->productMap[$productCost->internal_product_id];
            $newProductCost->ingredient_id = $mappedIngredientId;
            $newProductCost->save();

            $product = InternalProduct::find($this->productMap[$productCost->internal_product_id]);

            if ($ingredientIsProduct) {
                $ingredient = InternalProduct::find($mappedIngredientId);
                $ingredientName = $ingredient ? $ingredient->name : "ID {$mappedIngredientId}";
                $ingredientUnit = $ingredient ? ($ingredient->unit ?? '') : '';
            } else {
                $ingredient = Ingredient::find($mappedIngredientId);
                $ingredientName = $ingredient ? $ingredient->name : "ID {$mappedIngredientId}";
                $ingredientUnit = $ingredient ? ($ingredient->unit ?? '') : '';
            }

            $this->line("   ✅ {$product->name} → {$ingredientName} ({$productCost->qty} {$ingredientUnit})");
        }

        $this->info("   📊 Total: {$productCosts->count()} relações copiadas");
        $this->newLine();
    }

    private function getSourceCounts(int $tenantId): array
    {
        return [
            'categories' => Category::where('tenant_id', $tenantId)->count(),
            'tax_categories' => TaxCategory::where('tenant_id', $tenantId)->count(),
            'ingredients' => Ingredient::where('tenant_id', $tenantId)->count(),
            'products' => InternalProduct::where('tenant_id', $tenantId)->count(),
            'product_costs' => ProductCost::where('tenant_id', $tenantId)->count(),
        ];
    }
}
