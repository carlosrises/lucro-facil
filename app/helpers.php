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
            'takeat' => [
                ['value' => 'CREDIT_CARD', 'label' => 'Cartão de Crédito'],
                ['value' => 'DEBIT_CARD', 'label' => 'Cartão de Débito'],
                ['value' => 'VOUCHER', 'label' => 'Vale Refeição/Alimentação'],
                ['value' => 'PIX', 'label' => 'PIX'],
                ['value' => 'MONEY', 'label' => 'Dinheiro'],
            ],
            '99food' => [
                ['value' => 'CREDIT_CARD', 'label' => 'Cartão de Crédito'],
                ['value' => 'DEBIT_CARD', 'label' => 'Cartão de Débito'],
                ['value' => 'VOUCHER', 'label' => 'Vale Refeição/Alimentação'],
                ['value' => 'PIX', 'label' => 'PIX'],
                ['value' => 'MONEY', 'label' => 'Dinheiro'],
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
            ['value' => 'ifood', 'label' => 'iFood (Direto)'],
            ['value' => 'takeat-ifood', 'label' => 'iFood (via Takeat)'],
            ['value' => '99food', 'label' => '99Food (Direto)'],
            ['value' => 'takeat-99food', 'label' => '99Food (via Takeat)'],
            ['value' => 'rappi', 'label' => 'Rappi'],
            ['value' => 'uber_eats', 'label' => 'Uber Eats'],
            ['value' => 'keeta', 'label' => 'Keeta (via Takeat)'],
            ['value' => 'neemo', 'label' => 'Neemo (via Takeat)'],
            ['value' => 'takeat', 'label' => 'Takeat (Delivery Próprio)'],
            ['value' => 'pdv', 'label' => 'PDV/Presencial'],
        ];
    }
}

if (!function_exists('is_online_payment_method')) {
    /**
     * Verifica se um método de pagamento é considerado online.
     */
    function is_online_payment_method(string $method): bool
    {
        $onlineMethods = [
            // iFood direto
            'CREDIT', 'DEBIT', 'MEAL_VOUCHER', 'FOOD_VOUCHER', 'DIGITAL_WALLET',
            // Takeat keywords (99Food, Keeta, Neemo, iFood, etc) - pagamento via marketplace
            '99food_pagamento_online', 'keeta_pagamento_online', 'neemo_pagamento_online',
            'ifood_pagamento_online', 'rappi_pagamento_online',
            'online_ifood', 'online_99food', 'online_keeta', 'online_neemo', 'online_rappi',
            // Rappi
            'credit_card', 'debit_card', 'rappi_pay',
            // Uber Eats
            'uber_credits',
        ];

        // Métodos detectados (maiúsculos) são considerados OFFLINE por padrão
        // Apenas quando tem prefixo/keyword de marketplace é que é online
        // Ex: CREDIT_CARD, DEBIT_CARD, PIX, VOUCHER sem prefixo = offline (pagamento no estabelecimento)

        return in_array($method, $onlineMethods);
    }
}
