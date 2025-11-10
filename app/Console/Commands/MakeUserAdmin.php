<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;

class MakeUserAdmin extends Command
{
    protected $signature = 'user:make-admin {email}';
    protected $description = 'Torna um usuário administrador do sistema';

    public function handle()
    {
        $email = $this->argument('email');

        $user = User::where('email', $email)->first();

        if (!$user) {
            $this->error("Usuário com email '{$email}' não encontrado!");
            return 1;
        }

        // Atribuir roles administrativas: 'admin' e 'admin:system' para compatibilidade
        $assigned = [];
        if (!$user->hasRole('admin')) {
            $user->assignRole('admin');
            $assigned[] = 'admin';
        }
        if (!$user->hasRole('admin:system')) {
            $user->assignRole('admin:system');
            $assigned[] = 'admin:system';
        }

        if (!empty($assigned)) {
            $this->info("✅ Usuário '{$user->name}' ({$email}) recebeu roles: " . implode(', ', $assigned));
        } else {
            $this->warn("⚠️  Usuário '{$user->name}' ({$email}) já possuía as roles administrativas.");
        }

        // Mostrar roles atuais
        $this->info("Roles atuais: " . $user->roles->pluck('name')->join(', '));

        return 0;
    }
}
