<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;
use App\Models\User;

class AdminRoleSeeder extends Seeder
{
    public function run(): void
    {
        // Criar role de admin se não existir
        $adminRole = Role::firstOrCreate(['name' => 'admin']);

        // Criar algumas permissões administrativas
        $permissions = [
            'manage-tenants',
            'manage-plans',
            'manage-payments',
            'manage-tickets',
            'view-admin-dashboard'
        ];

        foreach ($permissions as $permission) {
            Permission::firstOrCreate(['name' => $permission]);
            $adminRole->givePermissionTo($permission);
        }

        // Atribuir role de admin ao primeiro usuário (se existir)
        $user = User::first();
        if ($user && !$user->hasRole('admin')) {
            $user->assignRole('admin');
        }

        $this->command->info('Admin role e permissões criadas com sucesso!');
    }
}
