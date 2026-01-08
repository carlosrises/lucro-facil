/**
 * Funções compartilhadas para cálculos de pedidos
 */

type OrderItem = {
    id: number;
    sku?: string;
    name: string;
    quantity?: number;
    qty?: number;
    price?: number;
    unit_price?: number;
    add_ons?: any[];
    add_ons_enriched?: Array<{
        name: string;
        sku: string;
        product_mapping?: {
            id: number;
            item_type?: string;
            internal_product?: {
                id: number;
                name: string;
                unit_cost: string;
                product_category?: string;
                cmv_by_size?: {
                    broto?: number;
                    media?: number;
                    grande?: number;
                    familia?: number;
                };
            };
        };
    }>;
    internal_product?: {
        id: number;
        name: string;
        unit_cost: string;
    };
    mappings?: Array<{
        id: number;
        mapping_type?: 'main' | 'option' | 'addon';
        internal_product?: {
            id: number;
            name: string;
            unit_cost: string;
        };
        quantity?: number;
    }>;
};

/**
 * Calcula o custo de um item considerando múltiplas associações
 */
export function calculateItemCost(item: OrderItem): number {
    const itemQuantity = item.qty || item.quantity || 0;

    // Novo sistema: usar mappings se existir
    if (item.mappings && item.mappings.length > 0) {
        // Separar mappings do tipo 'main' (item principal) dos add-ons
        const mainMappings = item.mappings.filter(
            (m) => m.mapping_type === 'main',
        );

        // Se tem mapping 'main', calcular APENAS dele (ignorar add-ons aqui)
        if (mainMappings.length > 0) {
            const mappingsCost = mainMappings.reduce((sum, mapping) => {
                if (mapping.internal_product?.unit_cost) {
                    const unitCost = parseFloat(
                        mapping.internal_product.unit_cost,
                    );
                    const mappingQuantity = mapping.quantity || 1;
                    return sum + unitCost * mappingQuantity;
                }
                return sum;
            }, 0);
            return mappingsCost * itemQuantity;
        }

        // Se NÃO tem mapping 'main', mas tem add-ons, retorna 0
        // (os add-ons serão mostrados separadamente abaixo)
        return 0;
    }

    // Fallback: sistema legado (internal_product direto)
    if (item.internal_product?.unit_cost) {
        const unitCost = parseFloat(item.internal_product.unit_cost);
        return unitCost * itemQuantity;
    }

    return 0;
}

/**
 * Detecta o tamanho da pizza a partir do nome do item
 */
function detectPizzaSize(itemName: string): string | null {
    const itemNameLower = itemName.toLowerCase();
    if (itemNameLower.includes('broto')) {
        return 'broto';
    } else if (
        itemNameLower.includes('média') ||
        itemNameLower.includes('media')
    ) {
        return 'media';
    } else if (itemNameLower.includes('grande')) {
        return 'grande';
    } else if (
        itemNameLower.includes('família') ||
        itemNameLower.includes('familia')
    ) {
        return 'familia';
    }
    return null;
}

/**
 * Calcula o CMV total de um pedido incluindo itens e add-ons
 */
export function calculateOrderCMV(items: OrderItem[]): number {
    return items.reduce((sum: number, item: OrderItem) => {
        // Custo do item principal
        let itemTotal = calculateItemCost(item);

        // Somar custo dos add-ons vinculados
        if (item.add_ons_enriched && Array.isArray(item.add_ons_enriched)) {
            // Detectar tamanho da pizza do nome do item pai
            const pizzaSize = detectPizzaSize(item.name);

            // Contar total de sabores para calcular fração
            const totalFlavors = item.add_ons_enriched.filter(
                (a: any) => a.product_mapping?.item_type === 'flavor',
            ).length;

            const addOnsCost = item.add_ons_enriched.reduce(
                (addOnSum: number, addOn: any) => {
                    const internalProduct =
                        addOn.product_mapping?.internal_product;
                    const isFlavor =
                        addOn.product_mapping?.item_type === 'flavor';

                    let baseAddonCost = 0;

                    if (internalProduct) {
                        // Se for sabor de pizza e tiver CMV por tamanho, usar o CMV do tamanho detectado
                        if (
                            isFlavor &&
                            pizzaSize &&
                            internalProduct.cmv_by_size &&
                            internalProduct.cmv_by_size[pizzaSize]
                        ) {
                            baseAddonCost = parseFloat(
                                String(internalProduct.cmv_by_size[pizzaSize]),
                            );
                        } else if (internalProduct.unit_cost) {
                            baseAddonCost = parseFloat(
                                internalProduct.unit_cost,
                            );
                        }
                    }

                    // Aplicar fração se for sabor
                    const addonCost =
                        isFlavor && totalFlavors > 1
                            ? baseAddonCost / totalFlavors
                            : baseAddonCost;

                    return addOnSum + addonCost;
                },
                0,
            );
            itemTotal += addOnsCost;
        }

        return sum + itemTotal;
    }, 0);
}
