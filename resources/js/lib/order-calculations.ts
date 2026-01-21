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
        unit_cost_override?: number | null; // CMV unitário do OrderItemMapping
        mapping_quantity?: number | null; // Fração do sabor (ex: 0.25 = 1/4)
        product_mapping?: {
            id: number;
            item_type?: string;
            internal_product?: {
                id: number;
                name: string;
                unit_cost: string;
                product_category?: string;
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

const normalizeChannel = (value?: string | null) =>
    (value || '').toString().trim().toLowerCase();

export function isTakeatIfoodOrder(order: any): boolean {
    if (!order || order.provider !== 'takeat') {
        return false;
    }

    const origin = normalizeChannel(order.origin);
    const sessionChannel = normalizeChannel(order?.raw?.session?.sales_channel);
    return origin === 'ifood' || sessionChannel === 'ifood';
}

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

        // MÉTODO 1: Somar custo dos add-ons dos mappings (OrderItemMapping)
        if (item.mappings && Array.isArray(item.mappings)) {
            const addonMappings = item.mappings.filter(
                (m) => m.mapping_type === 'addon',
            );

            if (addonMappings.length > 0) {
                const mappingsCost = addonMappings.reduce(
                    (addOnSum: number, mapping: any) => {
                        if (!mapping.internal_product?.unit_cost) {
                            return addOnSum;
                        }

                        // Usar unit_cost_override se existir, senão usar unit_cost do produto
                        const unitCost =
                            mapping.unit_cost_override !== null &&
                            mapping.unit_cost_override !== undefined
                                ? parseFloat(String(mapping.unit_cost_override))
                                : parseFloat(
                                      mapping.internal_product.unit_cost,
                                  );

                        // APLICAR FRAÇÃO: mapping.quantity contém a fração (0.25 para 1/4)
                        const fraction = mapping.quantity || 1;

                        // unit_cost_override é o custo INTEIRO, precisa multiplicar pela fração
                        return addOnSum + unitCost * fraction;
                    },
                    0,
                );

                itemTotal += mappingsCost;

                // Se usou mappings, pular add_ons_enriched
                return sum + itemTotal;
            }
        }

        // MÉTODO 2 (FALLBACK): Somar custo dos add-ons_enriched (legado)
        if (item.add_ons_enriched && Array.isArray(item.add_ons_enriched)) {
            // Detectar tamanho da pizza do nome do item pai
            const pizzaSize = detectPizzaSize(item.name);

            // Contar total de sabores para calcular fração
            const totalFlavors = item.add_ons_enriched.filter(
                (a: any) => a.product_mapping?.item_type === 'flavor',
            ).length;

            const addOnsCost = item.add_ons_enriched.reduce(
                (addOnSum: number, addOn: any) => {
                    const isFlavor =
                        addOn.product_mapping?.item_type === 'flavor';

                    // PRIORIDADE 1: Usar unit_cost_override se existir (valor do OrderItemMapping)
                    if (
                        addOn.unit_cost_override !== undefined &&
                        addOn.unit_cost_override !== null
                    ) {
                        // unit_cost_override já é o custo final (com fração aplicada)
                        // Apenas multiplicar pela quantidade do add-on no pedido
                        const addOnQuantity = addOn.quantity || 1;
                        const cost =
                            parseFloat(String(addOn.unit_cost_override)) *
                            addOnQuantity;

                        return addOnSum + cost;
                    }

                    // FALLBACK: Usar unit_cost do produto (sistema legado)
                    const internalProduct =
                        addOn.product_mapping?.internal_product;
                    let baseAddonCost = 0;

                    if (internalProduct?.unit_cost) {
                        baseAddonCost = parseFloat(internalProduct.unit_cost);
                    }

                    // Aplicar fração se for sabor (apenas no fallback)
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

/**
 * Calcula a receita líquida de um pedido (mesma lógica do card financeiro)
 */
export function calculateNetRevenue(order: any): number {
    const items = order.items || [];
    const raw = order.raw || {};
    const calculatedCosts = order.calculated_costs || null;

    // Calcular grossTotal (receita base após descontos)
    let grossTotal = 0;
    if (order.provider === 'takeat') {
        if (raw?.session?.total_delivery_price) {
            grossTotal =
                parseFloat(String(raw.session.total_delivery_price)) || 0;
        } else if (raw?.session?.total_price) {
            grossTotal = parseFloat(String(raw.session.total_price)) || 0;
        }
    } else if (raw?.total?.orderAmount) {
        grossTotal = parseFloat(String(raw.total.orderAmount)) || 0;
    } else {
        grossTotal = parseFloat(String(order.gross_total || '0')) || 0;
    }

    const deliveryFee = parseFloat(String(order.delivery_fee || '0')) || 0;

    // Cashback (desconto da loja)
    const sessionPayments = raw?.session?.payments || [];
    const totalCashback = sessionPayments.reduce(
        (sum: number, payment: any) => {
            const paymentName = (
                payment.payment_method?.name || ''
            ).toLowerCase();
            const paymentKeyword = (
                payment.payment_method?.keyword || ''
            ).toLowerCase();
            const isCashback =
                paymentName.includes('cashback') ||
                paymentKeyword.includes('clube');
            return isCashback
                ? sum + (parseFloat(String(payment.payment_value || '0')) || 0)
                : sum;
        },
        0,
    );

    // Subsídios (excluindo cashback)
    const totalSubsidy = sessionPayments.reduce((sum: number, payment: any) => {
        const paymentName = (payment.payment_method?.name || '').toLowerCase();
        const paymentKeyword = (
            payment.payment_method?.keyword || ''
        ).toLowerCase();
        const isCashback =
            paymentName.includes('cashback') ||
            paymentKeyword.includes('clube');
        const isSubsidy =
            paymentName.includes('subsid') ||
            paymentName.includes('cupom') ||
            paymentKeyword.includes('subsid') ||
            paymentKeyword.includes('cupom');
        return isSubsidy && !isCashback
            ? sum + (parseFloat(String(payment.payment_value || '0')) || 0)
            : sum;
    }, 0);

    // Subtotal para cálculo de receita líquida
    let subtotal = grossTotal;
    const usedTotalDeliveryPrice =
        order.provider === 'takeat' &&
        Boolean(raw?.session?.total_delivery_price);
    const skipDeliveryFeeInSubtotal = isTakeatIfoodOrder(order);
    if (!usedTotalDeliveryPrice) {
        subtotal += totalSubsidy;
        if (!skipDeliveryFeeInSubtotal) {
            subtotal += deliveryFee;
        }
    } else if (skipDeliveryFeeInSubtotal && deliveryFee > 0) {
        subtotal -= deliveryFee;
    }

    // Descontar cashback do subtotal (é desconto da loja)
    subtotal -= totalCashback;

    // CMV (custo dos produtos)
    const cmv = calculateOrderCMV(items);

    // Impostos dos produtos
    const productTax = items.reduce((sum: number, item: any) => {
        if (item.internal_product?.tax_category?.total_tax_rate) {
            const quantity = item.qty || item.quantity || 0;
            const unitPrice = item.unit_price || item.price || 0;
            const taxRate =
                item.internal_product.tax_category.total_tax_rate || 0;
            const taxValue = (quantity * unitPrice * taxRate) / 100;
            return sum + (isNaN(taxValue) ? 0 : taxValue);
        }
        return sum;
    }, 0);

    // Impostos adicionais
    const additionalTaxes = calculatedCosts?.taxes || [];
    const totalAdditionalTax = additionalTaxes.reduce(
        (sum: number, tax: any) => sum + (tax.calculated_value || 0),
        0,
    );

    // Total de impostos
    const totalTax = productTax + totalAdditionalTax;

    // Custos operacionais
    const totalCosts =
        typeof order.total_costs === 'string'
            ? parseFloat(order.total_costs)
            : (order.total_costs ?? 0);

    // Comissões
    const totalCommissions =
        typeof order.total_commissions === 'string'
            ? parseFloat(order.total_commissions)
            : (order.total_commissions ?? 0);

    // Taxas de pagamento
    const paymentMethodFees = calculatedCosts?.payment_methods || [];
    const totalPaymentMethodFee = paymentMethodFees.reduce(
        (sum: number, fee: any) => sum + (fee.calculated_value || 0),
        0,
    );

    // Líquido = Subtotal - CMV - Impostos - Custos - Comissão - Taxas de Pagamento
    const netRevenue =
        subtotal -
        cmv -
        totalTax -
        totalCosts -
        totalCommissions -
        totalPaymentMethodFee;

    return netRevenue;
}
