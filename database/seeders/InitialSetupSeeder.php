<?php

namespace Database\Seeders;

use App\Models\User;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

use Illuminate\Support\Str;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;

class InitialSetupSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // 1) Roles básicas
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        $roles = ['admin:system','admin:tenant','manager','operator'];
        foreach ($roles as $role) {
            \Spatie\Permission\Models\Role::firstOrCreate(['name' => $role]);
        }

        // 2) Plano padrão
        DB::table('plans')->updateOrInsert(
            ['code' => 'start'],
            [
                'name' => 'Start',
                'price_month' => 99.90,
                'max_stores' => 1,
                'retention_days' => 365,
                'reports_advanced' => false,
                'features' => json_encode(['dashboard_basic' => true, 'exports' => true]),
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );

        // 3) Tenant inicial (para testes)
        $tenantId = DB::table('tenants')->insertGetId([
            'uuid' => (string) Str::uuid(),
            'name' => "Carlos Rises's Workspace",
            'email' => 'risescorporation@gmail.com',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // 4) Assinatura do tenant no plano Start
        $plan = DB::table('plans')->where('code', 'start')->first();
        DB::table('subscriptions')->updateOrInsert(
            ['tenant_id' => $tenantId, 'plan_id' => $plan->id],
            [
                'status' => 'active',
                'started_on' => now()->toDateString(),
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );

        // 5) Admin do sistema
        $admin = User::firstOrCreate(
            ['email' => 'risescorporation@gmail.com'],
            [
                'name' => 'Carlos Rises',
                'password' => Hash::make('Admin@123'),
                'tenant_id' => $tenantId,
            ]
        );
        $admin->assignRole('admin:system');

        // 6) Regras de bandeira padrão para o tenant
        // CREDITO 3%, PIX 0%, TICKET/VR 7%, DEBITO 0,8%
        DB::table('payment_flag_rules')->updateOrInsert(
            ['tenant_id' => $tenantId, 'flag' => 'CREDITO'],
            ['fee_percent' => 3.0, 'fee_fixed' => 0, 'created_at' => now(), 'updated_at' => now()]
        );
        DB::table('payment_flag_rules')->updateOrInsert(
            ['tenant_id' => $tenantId, 'flag' => 'PIX'],
            ['fee_percent' => 0.0, 'fee_fixed' => 0, 'created_at' => now(), 'updated_at' => now()]
        );
        DB::table('payment_flag_rules')->updateOrInsert(
            ['tenant_id' => $tenantId, 'flag' => 'TICKET_VR'],
            ['fee_percent' => 7.0, 'fee_fixed' => 0, 'created_at' => now(), 'updated_at' => now()]
        );
        DB::table('payment_flag_rules')->updateOrInsert(
            ['tenant_id' => $tenantId, 'flag' => 'DEBITO'],
            ['fee_percent' => 0.8, 'fee_fixed' => 0, 'created_at' => now(), 'updated_at' => now()]
        );
    }
}
