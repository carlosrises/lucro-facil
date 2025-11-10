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

        // Atribuir role admin:system
        if (!$user->hasRole('admin:system')) {
            $user->assignRole('admin:system');
            $this->info("✅ Usuário '{$user->name}' ({$email}) agora é admin:system!");
        } else {
            $this->warn("⚠️  Usuário '{$user->name}' ({$email}) já é admin:system!");
        }

        // Mostrar roles atuais
        $this->info("Roles atuais: " . $user->roles->pluck('name')->join(', '));

        return 0;
    }
}
