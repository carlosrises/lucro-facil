<?php

use Illuminate\Support\Facades\Auth;

if (!function_exists('tenant_id')) {
    /**
     * Retorna o tenant_id atual.
     */
    function tenant_id(): ?int
    {
        return Auth::user()?->tenant_id;
    }
}

if (!function_exists('get_payment_methods_by_provider')) {
    /**
     * Retorna os métodos de pagamento disponíveis por marketplace/provider.
     */
    function get_payment_methods_by_provider(string $provider): array
    {
        $methods = [
            'ifood' => [
                ['value' => 'CREDIT', 'label' => 'Cartão de Crédito'],
                ['value' => 'DEBIT', 'label' => 'Cartão de Débito'],
                ['value' => 'MEAL_VOUCHER', 'label' => 'Vale Refeição'],
                ['value' => 'FOOD_VOUCHER', 'label' => 'Vale Alimentação'],
                ['value' => 'DIGITAL_WALLET', 'label' => 'Carteira Digital'],
                ['value' => 'PIX', 'label' => 'PIX'],
                ['value' => 'CASH', 'label' => 'Dinheiro'],
            ],
            'rappi' => [
                ['value' => 'credit_card', 'label' => 'Cartão de Crédito'],
                ['value' => 'debit_card', 'label' => 'Cartão de Débito'],
                ['value' => 'cash', 'label' => 'Dinheiro'],
                ['value' => 'rappi_pay', 'label' => 'Rappi Pay'],
            ],
            'uber_eats' => [
                ['value' => 'credit_card', 'label' => 'Cartão de Crédito'],
                ['value' => 'debit_card', 'label' => 'Cartão de Débito'],
                ['value' => 'cash', 'label' => 'Dinheiro'],
                ['value' => 'uber_credits', 'label' => 'Créditos Uber'],
            ],
        ];

        return $methods[$provider] ?? [];
    }
}

if (!function_exists('get_all_providers')) {
    /**
     * Retorna lista de providers/marketplaces disponíveis.
     */
    function get_all_providers(): array
    {
        return [
            ['value' => 'ifood', 'label' => 'iFood'],
            ['value' => 'rappi', 'label' => 'Rappi'],
            ['value' => 'uber_eats', 'label' => 'Uber Eats'],
        ];
    }
}
