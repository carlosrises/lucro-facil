<?php

namespace App\Console\Commands;

use App\Models\CostCommission;
use Illuminate\Console\Command;

class CheckTaxStatus extends Command
{
    protected $signature = 'orders:check-tax {id : ID da taxa para verificar}';

    protected $description = 'Verificar status de uma taxa específica no banco';

    public function handle(): int
    {
        $taxId = $this->argument('id');

        $this->info("🔍 Buscando taxa ID: {$taxId}");

        $tax = CostCommission::withTrashed()->find($taxId);

        if (! $tax) {
            $this->error("❌ Taxa ID {$taxId} não encontrada no banco (foi permanentemente deletada)");

            return 1;
        }

        $this->newLine();
        $this->info("✅ Taxa encontrada:");
        $this->table(
            ['Campo', 'Valor'],
            [
                ['ID', $tax->id],
                ['Nome', $tax->name],
                ['Tipo', $tax->type],
                ['Valor', $tax->value],
                ['Categoria', $tax->category],
                ['Provider', $tax->provider ?? 'todos'],
                ['Ativo', $tax->active ? '✓ Sim' : '✗ Não'],
                ['Tenant ID', $tax->tenant_id],
                ['Criado em', $tax->created_at],
                ['Atualizado em', $tax->updated_at],
                ['Deletado em', $tax->deleted_at ?? 'N/A'],
            ]
        );

        $this->newLine();

        if (! $tax->active) {
            $this->warn('⚠️  Esta taxa está INATIVA (active = false)');
            $this->line('   Ela não será aplicada a novos pedidos');
            $this->line('   Para remover de pedidos existentes, use:');
            $this->line("   php artisan orders:find-orphan-taxes --include-inactive --fix");
        }

        if ($tax->trashed()) {
            $this->error('🗑️  Esta taxa foi DELETADA (soft delete)');
            $this->line('   Para remover de pedidos existentes, use:');
            $this->line("   php artisan orders:find-orphan-taxes --fix");
        }

        return 0;
    }
}
