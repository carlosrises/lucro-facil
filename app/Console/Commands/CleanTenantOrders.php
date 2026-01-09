<?php

namespace App\Console\Commands;

use App\Models\FinancialEvent;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderItemMapping;
use App\Models\Sale;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class CleanTenantOrders extends Command
{
    protected $signature = 'tenant:clean-orders {tenantId} {--force : Executar sem confirmação}';

    protected $description = 'Limpa todos os pedidos e dados relacionados de um tenant específico';

    public function handle(): int
    {
        $tenantId = (int) $this->argument('tenantId');
        $force = $this->option('force');

        $this->info("═══════════════════════════════════════════════════════════════");
        $this->warn("⚠️  LIMPEZA DE PEDIDOS DO TENANT {$tenantId}");
        $this->info("═══════════════════════════════════════════════════════════════");
        $this->newLine();

        // Contar registros antes
        $counts = $this->getCounts($tenantId);

        $this->info("📊 Registros que serão EXCLUÍDOS:");
        $this->line("   • Order Item Mappings: {$counts['order_item_mappings']}");
        $this->line("   • Order Items: {$counts['order_items']}");
        $this->line("   • Orders: {$counts['orders']}");
        $this->line("   • Financial Events: {$counts['financial_events']}");
        $this->line("   • Sales: {$counts['sales']}");
        $this->newLine();

        // Verificar se há algo para excluir
        $total = array_sum($counts);
        if ($total === 0) {
            $this->info("✅ Não há registros para excluir.");
            return 0;
        }

        // Confirmação
        if (!$force) {
            $this->warn("🚨 ATENÇÃO: Esta operação é IRREVERSÍVEL!");
            $this->warn("🚨 Todos os pedidos, itens, mapeamentos, eventos financeiros e vendas serão PERMANENTEMENTE excluídos.");
            $this->newLine();

            if (!$this->confirm("Você tem CERTEZA que deseja continuar?", false)) {
                $this->info("❌ Operação cancelada.");
                return 1;
            }

            if (!$this->confirm("Confirme novamente digitando o ID do tenant: {$tenantId}", false)) {
                $this->info("❌ Operação cancelada.");
                return 1;
            }
        }

        $this->newLine();
        $this->info("🔄 Iniciando limpeza...");
        $this->newLine();

        DB::beginTransaction();

        try {
            // 1. Order Item Mappings (referencia order_items)
            $this->info("🗑️  Excluindo Order Item Mappings...");
            $deleted = OrderItemMapping::where('tenant_id', $tenantId)->delete();
            $this->line("   ✅ {$deleted} registros excluídos");

            // 2. Order Items (referencia orders)
            $this->info("🗑️  Excluindo Order Items...");
            $deleted = OrderItem::where('tenant_id', $tenantId)->delete();
            $this->line("   ✅ {$deleted} registros excluídos");

            // 3. Financial Events (referencia orders via order_uuid)
            $this->info("🗑️  Excluindo Financial Events...");
            $deleted = FinancialEvent::where('tenant_id', $tenantId)->delete();
            $this->line("   ✅ {$deleted} registros excluídos");

            // 4. Sales (independente, mas relacionado ao tenant)
            $this->info("🗑️  Excluindo Sales...");
            $deleted = Sale::where('tenant_id', $tenantId)->delete();
            $this->line("   ✅ {$deleted} registros excluídos");

            // 5. Orders (tabela principal)
            $this->info("🗑️  Excluindo Orders...");
            $deleted = Order::where('tenant_id', $tenantId)->delete();
            $this->line("   ✅ {$deleted} registros excluídos");

            DB::commit();

            $this->newLine();
            $this->info("═══════════════════════════════════════════════════════════════");
            $this->info("✅ Limpeza concluída com sucesso!");
            $this->info("═══════════════════════════════════════════════════════════════");

            // Mostrar contagem após
            $this->newLine();
            $countsAfter = $this->getCounts($tenantId);
            $this->info("📊 Registros restantes:");
            $this->line("   • Order Item Mappings: {$countsAfter['order_item_mappings']}");
            $this->line("   • Order Items: {$countsAfter['order_items']}");
            $this->line("   • Orders: {$countsAfter['orders']}");
            $this->line("   • Financial Events: {$countsAfter['financial_events']}");
            $this->line("   • Sales: {$countsAfter['sales']}");

            return 0;

        } catch (\Exception $e) {
            DB::rollBack();
            $this->error("❌ Erro durante a limpeza: {$e->getMessage()}");
            $this->error("Stack trace: {$e->getTraceAsString()}");
            return 1;
        }
    }

    private function getCounts(int $tenantId): array
    {
        return [
            'order_item_mappings' => OrderItemMapping::where('tenant_id', $tenantId)->count(),
            'order_items' => OrderItem::where('tenant_id', $tenantId)->count(),
            'orders' => Order::where('tenant_id', $tenantId)->count(),
            'financial_events' => FinancialEvent::where('tenant_id', $tenantId)->count(),
            'sales' => Sale::where('tenant_id', $tenantId)->count(),
        ];
    }
}
