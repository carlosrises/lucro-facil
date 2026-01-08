<?php

namespace App\Console\Commands;

use App\Models\CostCommission;
use App\Models\Order;
use Illuminate\Console\Command;

class CompareTaxInOrders extends Command
{
    protected $signature = 'orders:compare-tax {id : ID da taxa} {--tenant= : ID do tenant}';

    protected $description = 'Comparar dados da taxa no banco vs nos pedidos';

    public function handle(): int
    {
        $taxId = $this->argument('id');
        $tenantId = $this->option('tenant');

        // Buscar taxa no banco
        $tax = CostCommission::find($taxId);

        if (! $tax) {
            $this->error("❌ Taxa ID {$taxId} não encontrada no banco");

            return 1;
        }

        $this->info("✅ Taxa no banco:");
        $this->table(
            ['Campo', 'Valor'],
            [
                ['ID', $tax->id],
                ['Nome', $tax->name],
                ['Tipo', $tax->type],
                ['Valor', $tax->value],
                ['Categoria', $tax->category],
                ['Provider', $tax->provider ?? 'todos'],
                ['Ativo', $tax->active ? 'Sim' : 'Não'],
            ]
        );

        $this->newLine();
        $this->info('🔍 Buscando como esta taxa aparece nos pedidos...');

        // Buscar pedidos com esta taxa
        $query = Order::whereNotNull('calculated_costs')
            ->whereRaw("JSON_SEARCH(calculated_costs, 'one', ?, NULL, '$**.id') IS NOT NULL", [$taxId]);

        if ($tenantId) {
            $query->where('tenant_id', $tenantId);
        }

        $orders = $query->limit(10)->get();

        if ($orders->isEmpty()) {
            $this->warn('⚠️  Nenhum pedido encontrado com esta taxa');

            return 0;
        }

        $this->info('📊 Encontrados pedidos com esta taxa. Mostrando variações:');
        $variations = [];

        foreach ($orders as $order) {
            $costs = $order->calculated_costs;
            $categories = ['costs', 'commissions', 'taxes', 'payment_methods'];

            foreach ($categories as $category) {
                if (! empty($costs[$category])) {
                    foreach ($costs[$category] as $item) {
                        if (($item['id'] ?? null) == $taxId) {
                            $key = json_encode([
                                'name' => $item['name'] ?? '',
                                'type' => $item['type'] ?? '',
                                'value' => $item['value'] ?? '',
                                'category' => $item['category'] ?? '',
                            ]);

                            if (! isset($variations[$key])) {
                                $variations[$key] = [
                                    'data' => $item,
                                    'count' => 0,
                                    'example_order' => $order->code,
                                ];
                            }
                            $variations[$key]['count']++;
                        }
                    }
                }
            }
        }

        $this->newLine();
        $this->info('📋 Variações encontradas nos pedidos:');

        foreach ($variations as $variation) {
            $item = $variation['data'];
            $this->line("\n  Variação (em {$variation['count']} pedidos):");
            $this->line("    Nome: {$item['name']}");
            $this->line("    Tipo: {$item['type']}");
            $this->line("    Valor: {$item['value']}");
            $this->line("    Categoria: {$item['category']}");
            $this->line("    Exemplo: pedido {$variation['example_order']}");
        }

        $this->newLine();

        // Verificar se há diferenças
        $currentData = [
            'name' => $tax->name,
            'type' => $tax->type,
            'value' => (string) $tax->value,
            'category' => $tax->category,
        ];

        $hasDifferences = false;
        foreach ($variations as $variation) {
            $item = $variation['data'];
            if (
                $item['name'] !== $currentData['name'] ||
                $item['type'] !== $currentData['type'] ||
                (string) $item['value'] !== $currentData['value'] ||
                $item['category'] !== $currentData['category']
            ) {
                $hasDifferences = true;
                break;
            }
        }

        if ($hasDifferences) {
            $this->warn('⚠️  ENCONTRADAS DIFERENÇAS entre banco e pedidos!');
            $this->line('Os pedidos têm dados antigos desta taxa.');
            $this->newLine();
            $this->line('Para atualizar todos os pedidos com os dados atuais, execute:');
            $this->line("php artisan orders:recalculate-all-costs --provider={$tax->provider}".($tenantId ? " --tenant={$tenantId}" : ''));
        } else {
            $this->info('✅ Dados nos pedidos estão consistentes com o banco');
        }

        return 0;
    }
}
