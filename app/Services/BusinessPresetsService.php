<?php

namespace App\Services;

use App\Models\Category;
use App\Models\Ingredient;
use App\Models\InternalProduct;
use App\Models\Tenant;

class BusinessPresetsService
{
    /**
     * Presets de negócios com produtos, ingredientes e categorias
     */
    protected array $presets = [
        'pizzaria' => [
            'name' => '🍕 Pizzaria',
            'categories' => [
                ['name' => 'Pizzas Tradicionais', 'type' => 'product'],
                ['name' => 'Pizzas Especiais', 'type' => 'product'],
                ['name' => 'Bebidas', 'type' => 'product'],
            ],
            'ingredients' => [
                ['name' => 'Queijo Mussarela', 'unit' => 'kg', 'cost_per_unit' => 35.00],
                ['name' => 'Tomate', 'unit' => 'kg', 'cost_per_unit' => 8.00],
                ['name' => 'Farinha de Trigo', 'unit' => 'kg', 'cost_per_unit' => 5.00],
                ['name' => 'Calabresa', 'unit' => 'kg', 'cost_per_unit' => 25.00],
                ['name' => 'Presunto', 'unit' => 'kg', 'cost_per_unit' => 22.00],
                ['name' => 'Azeitona', 'unit' => 'kg', 'cost_per_unit' => 18.00],
                ['name' => 'Orégano', 'unit' => 'un', 'cost_per_unit' => 3.50],
                ['name' => 'Catupiry', 'unit' => 'kg', 'cost_per_unit' => 45.00],
            ],
            'products' => [
                ['name' => 'Pizza Margherita', 'category' => 'Pizzas Tradicionais', 'price' => 45.00],
                ['name' => 'Pizza Calabresa', 'category' => 'Pizzas Tradicionais', 'price' => 48.00],
                ['name' => 'Pizza Portuguesa', 'category' => 'Pizzas Tradicionais', 'price' => 52.00],
                ['name' => 'Pizza Mussarela', 'category' => 'Pizzas Tradicionais', 'price' => 42.00],
                ['name' => 'Pizza 4 Queijos', 'category' => 'Pizzas Especiais', 'price' => 55.00],
                ['name' => 'Pizza Frango Catupiry', 'category' => 'Pizzas Especiais', 'price' => 52.00],
                ['name' => 'Coca-Cola 2L', 'category' => 'Bebidas', 'price' => 12.00],
                ['name' => 'Guaraná 2L', 'category' => 'Bebidas', 'price' => 10.00],
            ],
        ],
        'hamburgueria' => [
            'name' => '🍔 Hamburgueria',
            'categories' => [
                ['name' => 'Hambúrgueres', 'type' => 'product'],
                ['name' => 'Porções', 'type' => 'product'],
                ['name' => 'Bebidas', 'type' => 'product'],
            ],
            'ingredients' => [
                ['name' => 'Pão de Hambúrguer', 'unit' => 'un', 'cost_per_unit' => 2.50],
                ['name' => 'Carne Bovina (Hambúrguer)', 'unit' => 'kg', 'cost_per_unit' => 28.00],
                ['name' => 'Queijo Cheddar', 'unit' => 'kg', 'cost_per_unit' => 40.00],
                ['name' => 'Bacon', 'unit' => 'kg', 'cost_per_unit' => 32.00],
                ['name' => 'Alface', 'unit' => 'un', 'cost_per_unit' => 3.00],
                ['name' => 'Tomate', 'unit' => 'kg', 'cost_per_unit' => 8.00],
                ['name' => 'Batata Frita', 'unit' => 'kg', 'cost_per_unit' => 6.00],
            ],
            'products' => [
                ['name' => 'X-Burger', 'category' => 'Hambúrgueres', 'price' => 25.00],
                ['name' => 'X-Bacon', 'category' => 'Hambúrgueres', 'price' => 32.00],
                ['name' => 'X-Salada', 'category' => 'Hambúrgueres', 'price' => 28.00],
                ['name' => 'X-Tudo', 'category' => 'Hambúrgueres', 'price' => 38.00],
                ['name' => 'Batata Frita Grande', 'category' => 'Porções', 'price' => 18.00],
                ['name' => 'Refrigerante Lata', 'category' => 'Bebidas', 'price' => 6.00],
            ],
        ],
        'restaurante' => [
            'name' => '🍽️ Restaurante',
            'categories' => [
                ['name' => 'Pratos Principais', 'type' => 'product'],
                ['name' => 'Acompanhamentos', 'type' => 'product'],
                ['name' => 'Sobremesas', 'type' => 'product'],
            ],
            'ingredients' => [
                ['name' => 'Arroz', 'unit' => 'kg', 'cost_per_unit' => 5.00],
                ['name' => 'Feijão', 'unit' => 'kg', 'cost_per_unit' => 8.00],
                ['name' => 'Carne Bovina', 'unit' => 'kg', 'cost_per_unit' => 35.00],
                ['name' => 'Frango', 'unit' => 'kg', 'cost_per_unit' => 18.00],
                ['name' => 'Batata', 'unit' => 'kg', 'cost_per_unit' => 4.00],
                ['name' => 'Alface', 'unit' => 'un', 'cost_per_unit' => 3.00],
            ],
            'products' => [
                ['name' => 'Prato Executivo', 'category' => 'Pratos Principais', 'price' => 28.00],
                ['name' => 'Bife à Parmegiana', 'category' => 'Pratos Principais', 'price' => 35.00],
                ['name' => 'Frango Grelhado', 'category' => 'Pratos Principais', 'price' => 25.00],
                ['name' => 'Salada Completa', 'category' => 'Acompanhamentos', 'price' => 12.00],
                ['name' => 'Pudim', 'category' => 'Sobremesas', 'price' => 8.00],
            ],
        ],
        'lanchonete' => [
            'name' => '🥙 Lanchonete',
            'categories' => [
                ['name' => 'Lanches', 'type' => 'product'],
                ['name' => 'Salgados', 'type' => 'product'],
                ['name' => 'Bebidas', 'type' => 'product'],
            ],
            'ingredients' => [
                ['name' => 'Pão Francês', 'unit' => 'un', 'cost_per_unit' => 0.80],
                ['name' => 'Presunto', 'unit' => 'kg', 'cost_per_unit' => 22.00],
                ['name' => 'Queijo', 'unit' => 'kg', 'cost_per_unit' => 35.00],
                ['name' => 'Coxinha (Massa)', 'unit' => 'kg', 'cost_per_unit' => 12.00],
            ],
            'products' => [
                ['name' => 'Misto Quente', 'category' => 'Lanches', 'price' => 8.00],
                ['name' => 'Bauru', 'category' => 'Lanches', 'price' => 12.00],
                ['name' => 'Coxinha', 'category' => 'Salgados', 'price' => 5.00],
                ['name' => 'Pastel de Carne', 'category' => 'Salgados', 'price' => 6.00],
                ['name' => 'Suco Natural', 'category' => 'Bebidas', 'price' => 8.00],
            ],
        ],
    ];

    /**
     * Aplicar preset de negócio ao tenant
     */
    public function applyPreset(Tenant $tenant, string $businessType): array
    {
        if (!isset($this->presets[$businessType])) {
            throw new \InvalidArgumentException("Preset '{$businessType}' não encontrado.");
        }

        $preset = $this->presets[$businessType];
        $stats = [
            'categories' => 0,
            'ingredients' => 0,
            'products' => 0,
        ];

        // Criar categorias (evitar duplicatas)
        $categories = [];
        foreach ($preset['categories'] as $categoryData) {
            $category = Category::firstOrCreate(
                [
                    'tenant_id' => $tenant->id,
                    'name' => $categoryData['name'],
                    'type' => $categoryData['type'],
                ],
                [] // Não há campos adicionais para criar
            );
            $categories[$categoryData['name']] = $category;
            $stats['categories']++;
        }

        // Criar ingredientes (evitar duplicatas)
        foreach ($preset['ingredients'] as $ingredientData) {
            Ingredient::firstOrCreate(
                [
                    'tenant_id' => $tenant->id,
                    'name' => $ingredientData['name'],
                ],
                [
                    'unit' => $ingredientData['unit'],
                    'cost_per_unit' => $ingredientData['cost_per_unit'],
                    'stock_quantity' => 100, // Quantidade inicial padrão
                ]
            );
            $stats['ingredients']++;
        }

        // Criar produtos (evitar duplicatas)
        foreach ($preset['products'] as $productData) {
            $category = $categories[$productData['category']] ?? null;

            InternalProduct::firstOrCreate(
                [
                    'tenant_id' => $tenant->id,
                    'name' => $productData['name'],
                ],
                [
                    'category_id' => $category?->id,
                    'price' => $productData['price'],
                ]
            );
            $stats['products']++;
        }

        return $stats;
    }

    /**
     * Obter lista de presets disponíveis
     */
    public function getAvailablePresets(): array
    {
        return collect($this->presets)->map(function ($preset, $key) {
            return [
                'id' => $key,
                'name' => $preset['name'],
                'categories_count' => count($preset['categories']),
                'ingredients_count' => count($preset['ingredients']),
                'products_count' => count($preset['products']),
            ];
        })->values()->toArray();
    }

    /**
     * Obter detalhes de um preset específico
     */
    public function getPresetDetails(string $businessType): ?array
    {
        return $this->presets[$businessType] ?? null;
    }
}
