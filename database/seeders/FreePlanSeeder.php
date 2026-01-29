<?php

namespace Database\Seeders;

use App\Models\Plan;
use App\Models\PlanPrice;
use Illuminate\Database\Seeder;

class FreePlanSeeder extends Seeder
{
    public function run(): void
    {
        $plans = [
            [
                'code' => 'START',
                'name' => 'Start',
                'description' => 'Perfeito para quem está começando',
                'features' => [
                    '0 a 500 pedidos/mês',
                    'Pedidos excedentes: valor proporcional em centavos',
                    'Acesso completo às funcionalidades',
                    'Suporte prioritário',
                    'Lojas integradas ilimitadas',
                ],
                'active' => true,
                'is_visible' => true,
                'is_contact_plan' => false,
                'is_featured' => false,
                'display_order' => 0,
                'prices' => [
                    [
                        'key' => 'monthly',
                        'label' => 'Mensal',
                        'amount' => 99.90,
                        'interval' => 'month',
                        'period_label' => 'por mês',
                        'is_annual' => false,
                        'active' => true,
                    ],
                    [
                        'key' => 'annual',
                        'label' => 'Anual',
                        'amount' => 997.90, // ~10% desconto
                        'interval' => 'year',
                        'period_label' => 'por ano',
                        'is_annual' => true,
                        'active' => true,
                    ],
                ],
            ],
            [
                'code' => 'GROWTH',
                'name' => 'Growth',
                'description' => 'Para negócios em crescimento',
                'features' => [
                    '501 a 3.000 pedidos/mês',
                    'Acesso completo às funcionalidades',
                    'Suporte prioritário',
                    'Lojas integradas ilimitadas',
                ],
                'active' => true,
                'is_visible' => true,
                'is_contact_plan' => false,
                'is_featured' => true,
                'display_order' => 1,
                'prices' => [
                    [
                        'key' => 'monthly',
                        'label' => 'Mensal',
                        'amount' => 299.90,
                        'interval' => 'month',
                        'period_label' => 'por mês',
                        'is_annual' => false,
                        'active' => true,
                    ],
                    [
                        'key' => 'annual',
                        'label' => 'Anual',
                        'amount' => 2999.00, // ~17% desconto
                        'interval' => 'year',
                        'period_label' => 'por ano',
                        'is_annual' => true,
                        'active' => true,
                    ],
                ],
            ],
            [
                'code' => 'SCALE',
                'name' => 'Scale',
                'description' => 'Para operações de alto volume',
                'features' => [
                    'Até 7.000 pedidos/mês',
                    'Acesso completo às funcionalidades',
                    'Suporte prioritário',
                    'Lojas integradas ilimitadas',
                ],
                'active' => true,
                'is_visible' => true,
                'is_contact_plan' => false,
                'is_featured' => false,
                'display_order' => 2,
                'prices' => [
                    [
                        'key' => 'monthly',
                        'label' => 'Mensal',
                        'amount' => 499.90,
                        'interval' => 'month',
                        'period_label' => 'por mês',
                        'is_annual' => false,
                        'active' => true,
                    ],
                    [
                        'key' => 'annual',
                        'label' => 'Anual',
                        'amount' => 4999.00, // ~17% desconto
                        'interval' => 'year',
                        'period_label' => 'por ano',
                        'is_annual' => true,
                        'active' => true,
                    ],
                ],
            ],
            [
                'code' => 'ENTERPRISE',
                'name' => 'Enterprise',
                'description' => 'Solução personalizada para grandes empresas',
                'features' => [
                    'Volume ilimitado de pedidos',
                    'Acesso completo às funcionalidades',
                    'Suporte premium 24/7',
                    'Gerente de conta dedicado',
                    'Integrações customizadas',
                    'Treinamento personalizado',
                    'SLA garantido',
                ],
                'active' => true,
                'is_visible' => true,
                'is_contact_plan' => true,
                'contact_url' => 'https://wa.me/5511999999999?text=Olá,%20gostaria%20de%20saber%20mais%20sobre%20o%20plano%20Enterprise',
                'is_featured' => false,
                'display_order' => 3,
                'prices' => [], // Plano sob consulta não tem preços definidos
            ],
        ];

        foreach ($plans as $planData) {
            $prices = $planData['prices'] ?? [];
            unset($planData['prices']);

            $plan = Plan::updateOrCreate(
                ['code' => $planData['code']],
                $planData
            );

            // Criar ou atualizar preços
            if (!empty($prices)) {
                // Remove preços antigos
                $plan->prices()->delete();

                // Cria novos preços
                foreach ($prices as $priceData) {
                    $plan->prices()->create($priceData);
                }
            }
        }

        $this->command->info('Planos e preços criados/atualizados com sucesso!');
    }
}
