import {
    CostCommissionItem,
    Order,
    OrderItem,
    OrderItemMapping,
} from '@/components/orders/columns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    ArrowDownLeft,
    ArrowRightLeft,
    ArrowUpRight,
    DollarSign,
    Plus,
} from 'lucide-react';
import { useState } from 'react';
import { CreatePaymentFeeDialog } from './create-payment-fee-dialog';

/**
 * Calcula o custo de um item considerando múltiplas associações
 */
function calculateItemCost(item: OrderItem): number {
    const itemQuantity = item.qty || item.quantity || 0;

    // Novo sistema: usar mappings se existir
    if (item.mappings && item.mappings.length > 0) {
        const mappingsCost = item.mappings.reduce(
            (sum: number, mapping: OrderItemMapping) => {
                if (mapping.internal_product?.unit_cost) {
                    const unitCost = parseFloat(
                        mapping.internal_product.unit_cost,
                    );
                    const mappingQuantity = mapping.quantity || 1;
                    return sum + unitCost * mappingQuantity;
                }
                return sum;
            },
            0,
        );
        return mappingsCost * itemQuantity;
    }

    // Fallback: sistema legado (internal_product direto)
    if (item.internal_product?.unit_cost) {
        const unitCost = parseFloat(item.internal_product.unit_cost);
        return unitCost * itemQuantity;
    }

    return 0;
}

type OrderFinancialCardProps = {
    sale?: {
        id: number;
        sale_uuid: string;
        short_id: string;
        type: string;
        sales_channel: string;
        current_status: string;
        bag_value?: number;
        delivery_fee?: number;
        service_fee?: number;
        gross_value: number;
        discount_value?: number;
        net_value: number;
        payment_method: string;
        concluded_at: string | null;
        expected_payment_date: string | null;
        raw?: unknown;
    };
    order?: Order;
};

export function OrderFinancialCard({ sale, order }: OrderFinancialCardProps) {
    // Estado para controlar o dialog de criação de taxa
    const [isCreateFeeDialogOpen, setIsCreateFeeDialogOpen] = useState(false);
    const [selectedPayment, setSelectedPayment] = useState<{
        method: string;
        name: string;
    } | null>(null);

    // Função helper para calcular todos os valores financeiros
    const calculateFinancials = () => {
        // Para Takeat:
        // - orderTotal (Pedido) = old_total_price OU total_price (valor dos itens)
        // - grossTotal = total_delivery_price (usado para cálculo de subtotal)
        let orderTotal = parseFloat(String(order?.gross_total || '0')) || 0; // Valor do pedido (itens)
        let grossTotal = parseFloat(String(order?.gross_total || '0')) || 0; // Usado para subtotal

        if (order?.provider === 'takeat') {
            // orderTotal = valor dos itens ANTES do desconto (para exibição)
            if (order?.raw?.session?.old_total_price) {
                orderTotal =
                    parseFloat(String(order.raw.session.old_total_price)) || 0;
            } else if (order?.raw?.session?.total_price) {
                orderTotal =
                    parseFloat(String(order.raw.session.total_price)) || 0;
            }

            // grossTotal = valor APÓS desconto (usado no cálculo de subtotal/receita)
            // Prioridade: total_delivery_price > total_price
            if (order?.raw?.session?.total_delivery_price) {
                grossTotal =
                    parseFloat(
                        String(order.raw.session.total_delivery_price),
                    ) || 0;
            } else if (order?.raw?.session?.total_price) {
                grossTotal =
                    parseFloat(String(order.raw.session.total_price)) || 0;
            }
        }

        const discountTotal =
            parseFloat(String(order?.discount_total || '0')) || 0;
        const deliveryFee = parseFloat(String(order?.delivery_fee || '0')) || 0;
        const netTotal = parseFloat(String(order?.net_total || '0')) || 0;

        // Subsídio e métodos de pagamento (dos pagamentos da sessão)
        const sessionPayments = order?.raw?.session?.payments || [];

        // Filtrar pagamentos subsidiados
        const subsidyPayments = sessionPayments.filter((payment: unknown) => {
            const p = payment as {
                payment_method?: { name?: string; keyword?: string };
            };
            const paymentName = p.payment_method?.name?.toLowerCase() || '';
            const paymentKeyword =
                p.payment_method?.keyword?.toLowerCase() || '';
            return (
                paymentName.includes('subsid') ||
                paymentName.includes('cupom') ||
                paymentKeyword.includes('subsid') ||
                paymentKeyword.includes('cupom')
            );
        });

        // Filtrar pagamentos reais (não subsidiados)
        const realPayments = sessionPayments.filter((payment: unknown) => {
            const p = payment as {
                payment_method?: { name?: string; keyword?: string };
                payment_value?: number;
            };
            const paymentName = p.payment_method?.name?.toLowerCase() || '';
            const paymentKeyword =
                p.payment_method?.keyword?.toLowerCase() || '';
            const isSubsidized =
                paymentName.includes('subsid') ||
                paymentName.includes('cupom') ||
                paymentKeyword.includes('subsid') ||
                paymentKeyword.includes('cupom');
            return !isSubsidized && (p.payment_value || 0) > 0;
        });

        const totalSubsidy = subsidyPayments.reduce(
            (sum: number, payment: unknown) => {
                const p = payment as { payment_value?: string | number };
                const value = parseFloat(String(p.payment_value || '0')) || 0;
                return sum + value;
            },
            0,
        );

        // Desconto loja = desconto - subsídio
        const storeDiscount = discountTotal - totalSubsidy;

        // Pago pelo cliente (soma dos pagamentos reais)
        let paidByClient = realPayments.reduce(
            (sum: number, payment: unknown) => {
                const p = payment as { payment_value?: string | number };
                const value = parseFloat(String(p.payment_value || '0')) || 0;
                return sum + value;
            },
            0,
        );

        // Se não houver pagamentos, usar old_total_price como fallback
        if (paidByClient === 0 && realPayments.length === 0) {
            if (
                order?.provider === 'takeat' &&
                order?.raw?.session?.old_total_price
            ) {
                paidByClient =
                    parseFloat(String(order.raw.session.old_total_price)) || 0;
            } else if (
                order?.provider === 'takeat' &&
                order?.raw?.session?.total_price
            ) {
                paidByClient =
                    parseFloat(String(order.raw.session.total_price)) || 0;
            } else {
                paidByClient =
                    parseFloat(String(order?.gross_total || '0')) || 0;
            }
        }

        // Subtotal para cálculo de receita líquida
        // Se usar total_delivery_price, NÃO somar subsídio (já está incluído)
        // Se usar old_total_price ou total_price, SOMAR subsídio
        let subtotal = grossTotal;

        // Verifica se usou total_delivery_price (que já inclui subsídio e delivery)
        const usedTotalDeliveryPrice =
            order?.provider === 'takeat' &&
            order?.raw?.session?.total_delivery_price;

        // Se NÃO usou total_delivery_price, precisa somar subsídio e delivery
        if (!usedTotalDeliveryPrice) {
            subtotal += totalSubsidy + deliveryFee;
        }

        // CMV (custo dos produtos)
        const items = order?.items || [];
        const cmv = items.reduce(
            (sum: number, item: OrderItem) => sum + calculateItemCost(item),
            0,
        );

        // Impostos dos produtos
        const productTax = items.reduce((sum: number, item: OrderItem) => {
            if (item.internal_product?.tax_category?.total_tax_rate) {
                const quantity = item.qty || item.quantity || 0;
                const unitPrice = item.unit_price || item.price || 0;
                const taxRate =
                    item.internal_product.tax_category.total_tax_rate || 0;
                const taxValue = (quantity * unitPrice * taxRate) / 100;
                // Proteção contra NaN
                return sum + (isNaN(taxValue) ? 0 : taxValue);
            }
            return sum;
        }, 0);

        // Impostos adicionais (da categoria 'tax' em cost_commissions)
        const calculatedCosts = order?.calculated_costs || null;
        const additionalTaxes = calculatedCosts?.taxes || [];
        const totalAdditionalTax = additionalTaxes.reduce(
            (sum: number, tax: CostCommissionItem) =>
                sum + (tax.calculated_value || 0),
            0,
        );

        // Total de impostos = impostos dos produtos + impostos adicionais
        const totalTax = productTax + totalAdditionalTax;

        // Custos operacionais (do order.total_costs)
        const totalCosts =
            typeof order?.total_costs === 'string'
                ? parseFloat(order.total_costs)
                : (order?.total_costs ?? 0);

        // Comissões (do order.total_commissions)
        const totalCommissions =
            typeof order?.total_commissions === 'string'
                ? parseFloat(order.total_commissions)
                : (order?.total_commissions ?? 0);

        // Taxas do meio de pagamento (da categoria 'payment_method' em cost_commissions)
        const paymentMethodFees = calculatedCosts?.payment_methods || [];
        const totalPaymentMethodFee = paymentMethodFees.reduce(
            (sum: number, fee: CostCommissionItem) =>
                sum + (fee.calculated_value || 0),
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

        return {
            orderTotal, // Valor do pedido (itens antes de desconto)
            grossTotal,
            discountTotal,
            storeDiscount,
            paidByClient,
            totalSubsidy,
            subtotal,
            cmv,
            productTax,
            additionalTaxes,
            totalTax,
            totalCosts,
            totalCommissions,
            paymentMethodFees,
            totalPaymentMethodFee,
            netRevenue,
            deliveryFee,
            realPayments,
        };
    };

    // Se for Takeat, sempre usar dados do raw (não terá sale)
    if (order?.provider === 'takeat' && order.raw?.session) {
        const session = order.raw.session;
        const financials = calculateFinancials();
        const isDelivery = session.is_delivery;
        const channel = session.sales_channel || order.origin.toUpperCase();

        // Helper para formatar valores
        const formatCurrency = (value: number) => {
            // Proteção contra NaN
            if (isNaN(value) || !isFinite(value)) {
                return 'R$ 0,00';
            }
            return new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL',
            }).format(value);
        };

        // Helper para formatar porcentagem
        const formatPercentage = (value: number, total: number) => {
            // Proteção contra valores inválidos
            if (
                isNaN(value) ||
                isNaN(total) ||
                !isFinite(value) ||
                !isFinite(total) ||
                total === 0
            ) {
                return '0,0%';
            }
            return `${((value / total) * 100).toFixed(1).replace('.', ',')}%`;
        };

        return (
            <>
                <Card className="h-fit gap-1 border-0 bg-gray-100 p-1 text-sm shadow-none dark:bg-neutral-950">
                    <CardHeader className="gap-0 bg-gray-100 px-2 py-2 dark:bg-neutral-950">
                        <CardTitle className="flex h-[18px] items-center font-semibold">
                            Detalhamento financeiro do pedido
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="rounded-md bg-card p-0">
                        <ul className="m-0 flex w-full flex-col ps-0">
                            {/* Tipo de pedido */}
                            <li className="flex flex-col gap-2 border-b-1 px-0 py-4">
                                <div className="flex w-full flex-row items-center gap-2 px-3 py-0">
                                    <span className="text-sm leading-4 font-semibold">
                                        Tipo de pedido
                                    </span>
                                    <span className="text-sm leading-4">
                                        {isDelivery ? 'Delivery' : 'Retirada'}{' '}
                                        via {channel}
                                    </span>
                                </div>
                            </li>

                            {/* Total do Pedido */}
                            <li className="flex flex-col gap-2 border-b-1 px-0 py-4">
                                <div className="flex w-full flex-row items-center gap-2 px-3 py-0">
                                    <div className="flex items-center justify-center rounded-full bg-blue-100 p-0.5 text-blue-900">
                                        <ArrowUpRight className="h-4 w-4" />
                                    </div>
                                    <span className="flex-grow text-sm leading-4 font-semibold">
                                        Total do pedido
                                    </span>
                                    <span className="text-sm leading-4 font-semibold whitespace-nowrap">
                                        {formatCurrency(financials.orderTotal)}
                                    </span>
                                    <span className="text-sm leading-4 font-medium whitespace-nowrap text-muted-foreground">
                                        {formatPercentage(
                                            financials.orderTotal,
                                            financials.grossTotal,
                                        )}
                                    </span>
                                </div>
                            </li>

                            {/* Taxa de entrega */}
                            {financials.deliveryFee > 0 && (
                                <li className="flex flex-col gap-2 border-b-1 px-0 py-4">
                                    <div className="flex w-full flex-row items-center gap-2 px-3 py-0">
                                        <div className="flex items-center justify-center rounded-full bg-blue-100 p-0.5 text-blue-900">
                                            <ArrowUpRight className="h-4 w-4" />
                                        </div>
                                        <span className="flex-grow text-sm leading-4 font-semibold">
                                            Taxa de entrega
                                        </span>
                                        <span className="text-sm leading-4 font-semibold whitespace-nowrap">
                                            {formatCurrency(
                                                financials.deliveryFee,
                                            )}
                                        </span>
                                        <span className="text-sm leading-4 font-medium whitespace-nowrap text-muted-foreground">
                                            {formatPercentage(
                                                financials.deliveryFee,
                                                financials.grossTotal,
                                            )}
                                        </span>
                                    </div>
                                </li>
                            )}

                            {/* Descontos */}
                            {financials.discountTotal > 0 && (
                                <li className="flex flex-col gap-2 border-b-1 px-0 py-4">
                                    <div className="flex w-full flex-row items-center gap-2 px-3 py-0">
                                        <div className="flex items-center justify-center rounded-full bg-red-100 p-0.5 text-red-900">
                                            <ArrowDownLeft className="h-4 w-4" />
                                        </div>
                                        <span className="flex-grow text-sm leading-4 font-semibold">
                                            Descontos
                                        </span>
                                        <span className="text-sm leading-4 whitespace-nowrap">
                                            -
                                            {formatCurrency(
                                                financials.discountTotal,
                                            )}
                                        </span>
                                        <span className="text-sm leading-4 font-medium whitespace-nowrap text-muted-foreground">
                                            {formatPercentage(
                                                financials.discountTotal,
                                                financials.grossTotal,
                                            )}
                                        </span>
                                    </div>
                                    <ul className="flex w-full flex-col items-center justify-between gap-1 pt-2 pl-0">
                                        {financials.storeDiscount > 0 && (
                                            <li className="flex w-full flex-row items-start justify-between px-3 py-0">
                                                <span className="text-xs leading-4 font-normal text-muted-foreground">
                                                    Desconto da loja
                                                </span>
                                                <span className="text-xs leading-4 font-normal whitespace-nowrap text-muted-foreground">
                                                    -
                                                    {formatCurrency(
                                                        financials.storeDiscount,
                                                    )}
                                                </span>
                                            </li>
                                        )}
                                        {financials.totalSubsidy > 0 && (
                                            <li className="flex w-full flex-row items-start justify-between px-3 py-0">
                                                <span className="text-xs leading-4 font-normal text-muted-foreground">
                                                    Desconto do marketplace
                                                    (subsídio)
                                                </span>
                                                <span className="text-xs leading-4 font-normal whitespace-nowrap text-muted-foreground">
                                                    -
                                                    {formatCurrency(
                                                        financials.totalSubsidy,
                                                    )}
                                                </span>
                                            </li>
                                        )}
                                        {session.discount_obs && (
                                            <li className="flex w-full flex-row items-start justify-between px-3 py-2">
                                                <span className="text-xs leading-4 font-normal text-muted-foreground italic">
                                                    {session.discount_obs}
                                                </span>
                                            </li>
                                        )}
                                    </ul>
                                </li>
                            )}

                            {/* Pago pelo cliente */}
                            <li className="flex flex-col gap-2 border-b-1 px-0 py-4">
                                <div className="flex w-full flex-row items-center gap-2 px-3 py-0">
                                    <div className="flex items-center justify-center rounded-full bg-green-100 p-0.5 text-green-900">
                                        <ArrowUpRight className="h-4 w-4" />
                                    </div>
                                    <span className="flex-grow text-sm leading-4 font-semibold">
                                        Pago pelo cliente
                                    </span>
                                    <span className="text-sm leading-4 font-semibold whitespace-nowrap">
                                        {formatCurrency(
                                            financials.paidByClient,
                                        )}
                                    </span>
                                    <span className="text-sm leading-4 font-medium whitespace-nowrap text-muted-foreground">
                                        {formatPercentage(
                                            financials.paidByClient,
                                            financials.grossTotal,
                                        )}
                                    </span>
                                </div>
                            </li>

                            {/* Subsídio do marketplace */}
                            {financials.totalSubsidy > 0 && (
                                <li className="flex flex-col gap-2 px-0 py-4">
                                    <div className="flex w-full flex-row items-center gap-2 px-3 py-0">
                                        <div className="flex items-center justify-center rounded-full bg-green-100 p-0.5 text-green-900">
                                            <ArrowUpRight className="h-4 w-4" />
                                        </div>
                                        <span className="flex-grow text-sm leading-4 font-semibold">
                                            Subsídio do marketplace
                                        </span>
                                        <span className="text-sm leading-4 font-semibold whitespace-nowrap text-green-700">
                                            {formatCurrency(
                                                financials.totalSubsidy,
                                            )}
                                        </span>
                                        <span className="text-sm leading-4 font-medium whitespace-nowrap text-muted-foreground">
                                            {formatPercentage(
                                                financials.totalSubsidy,
                                                financials.grossTotal,
                                            )}
                                        </span>
                                    </div>
                                </li>
                            )}

                            {/* Linha separadora */}
                            <li className="border-b-3 border-gray-100"></li>

                            {/* Subtotal */}
                            <li className="flex flex-col gap-2 border-b-1 px-0 py-4">
                                <div className="flex w-full flex-row items-center gap-2 px-3 py-0">
                                    <div className="flex items-center justify-center rounded-full bg-gray-200 p-1 text-gray-700">
                                        <ArrowRightLeft className="h-3 w-3" />
                                    </div>
                                    <span className="flex-grow text-sm leading-4 font-semibold">
                                        Subtotal
                                    </span>
                                    <span className="text-sm leading-4 font-semibold whitespace-nowrap">
                                        {formatCurrency(financials.subtotal)}
                                    </span>
                                    <span className="text-sm leading-4 font-medium whitespace-nowrap text-muted-foreground">
                                        {formatPercentage(
                                            financials.subtotal,
                                            financials.grossTotal,
                                        )}
                                    </span>
                                </div>
                                <ul className="flex w-full flex-col items-center justify-between gap-2 pl-0">
                                    <li className="flex w-full flex-row items-start justify-between px-3 py-0">
                                        <span className="text-xs leading-4 font-normal text-muted-foreground">
                                            Total pag. pelo cliente + Subsídio
                                        </span>
                                    </li>
                                </ul>
                            </li>

                            {/* CMV */}
                            {(() => {
                                const items = order.items || [];
                                const itemsWithCost = items.filter(
                                    (item: OrderItem) =>
                                        item.internal_product?.unit_cost ||
                                        (item.mappings &&
                                            item.mappings.length > 0),
                                );

                                return financials.cmv > 0 ? (
                                    <li className="flex flex-col gap-2 border-b-1 px-0 py-4">
                                        <div className="flex w-full flex-row items-center gap-2 px-3 py-0">
                                            <div className="flex items-center justify-center rounded-full bg-orange-100 p-0.5 text-orange-900">
                                                <ArrowDownLeft className="h-4 w-4" />
                                            </div>
                                            <span className="flex-grow text-sm leading-4 font-semibold">
                                                Custo dos produtos (CMV)
                                            </span>
                                            <span className="text-sm leading-4 whitespace-nowrap">
                                                {formatCurrency(financials.cmv)}
                                            </span>
                                            <span className="text-sm leading-4 font-medium whitespace-nowrap text-muted-foreground">
                                                {formatPercentage(
                                                    financials.cmv,
                                                    financials.subtotal,
                                                )}
                                            </span>
                                        </div>
                                        {/* Detalhamento dos custos por produto */}
                                        {itemsWithCost.length > 0 && (
                                            <ul className="flex w-full flex-col items-center justify-between pl-0">
                                                {itemsWithCost.map(
                                                    (item: OrderItem) => {
                                                        const itemTotalCost =
                                                            calculateItemCost(
                                                                item,
                                                            );
                                                        const quantity =
                                                            item.qty ||
                                                            item.quantity ||
                                                            0;
                                                        const hasMappings =
                                                            item.mappings &&
                                                            item.mappings
                                                                .length > 0;

                                                        return (
                                                            <li
                                                                key={item.id}
                                                                className="flex w-full flex-col gap-1"
                                                            >
                                                                <div className="flex w-full flex-row items-start justify-between px-3 py-1.5">
                                                                    <span className="text-xs leading-4 font-medium text-muted-foreground">
                                                                        {
                                                                            quantity
                                                                        }
                                                                        x{' '}
                                                                        {
                                                                            item.name
                                                                        }
                                                                    </span>
                                                                    <span className="text-xs leading-4 font-medium whitespace-nowrap text-muted-foreground">
                                                                        {formatCurrency(
                                                                            itemTotalCost,
                                                                        )}
                                                                    </span>
                                                                </div>

                                                                {/* Detalhamento dos mappings */}
                                                                {hasMappings &&
                                                                    item.mappings && (
                                                                        <ul className="flex w-full flex-col gap-0.5 pl-3">
                                                                            {item.mappings.map(
                                                                                (
                                                                                    mapping: OrderItemMapping,
                                                                                    idx: number,
                                                                                ) => {
                                                                                    const mappingCost =
                                                                                        mapping
                                                                                            .internal_product
                                                                                            ?.unit_cost
                                                                                            ? parseFloat(
                                                                                                  mapping
                                                                                                      .internal_product
                                                                                                      .unit_cost,
                                                                                              ) *
                                                                                              (mapping.quantity ||
                                                                                                  1) *
                                                                                              quantity
                                                                                            : 0;
                                                                                    const percentage =
                                                                                        (
                                                                                            (mapping.quantity ||
                                                                                                0) *
                                                                                            100
                                                                                        ).toFixed(
                                                                                            0,
                                                                                        );
                                                                                    const mappingType =
                                                                                        mapping.mapping_type ===
                                                                                        'main'
                                                                                            ? 'Principal'
                                                                                            : mapping.mapping_type ===
                                                                                                'addon'
                                                                                              ? 'Complemento'
                                                                                              : 'Opção';

                                                                                    return (
                                                                                        <li
                                                                                            key={
                                                                                                idx
                                                                                            }
                                                                                            className="flex w-full flex-row items-start justify-between px-3 py-0"
                                                                                        >
                                                                                            <span className="text-xs leading-4 font-normal text-muted-foreground">
                                                                                                {mapping
                                                                                                    .internal_product
                                                                                                    ?.name ||
                                                                                                    'Produto'}{' '}
                                                                                                (
                                                                                                {
                                                                                                    percentage
                                                                                                }

                                                                                                %
                                                                                                -{' '}
                                                                                                {
                                                                                                    mappingType
                                                                                                }

                                                                                                )
                                                                                            </span>
                                                                                            <span className="text-xs leading-4 font-normal whitespace-nowrap text-muted-foreground">
                                                                                                {formatCurrency(
                                                                                                    mappingCost,
                                                                                                )}
                                                                                            </span>
                                                                                        </li>
                                                                                    );
                                                                                },
                                                                            )}
                                                                        </ul>
                                                                    )}
                                                            </li>
                                                        );
                                                    },
                                                )}
                                            </ul>
                                        )}
                                    </li>
                                ) : null;
                            })()}

                            {/* Impostos */}
                            {(() => {
                                const items = order.items || [];
                                const itemsWithTax = items.filter(
                                    (item: OrderItem) =>
                                        item.internal_product?.tax_category
                                            ?.total_tax_rate !== undefined &&
                                        item.internal_product?.tax_category
                                            ?.total_tax_rate !== null,
                                );

                                // Mostrar seção se tiver impostos OU se tiver detalhes para exibir
                                const hasDetails =
                                    itemsWithTax.length > 0 ||
                                    financials.additionalTaxes.length > 0;

                                return financials.totalTax > 0 || hasDetails ? (
                                    <li className="flex flex-col gap-2 border-b-1 px-0 py-4">
                                        <div className="flex w-full flex-row items-center gap-2 px-3 py-0">
                                            <div className="flex items-center justify-center rounded-full bg-orange-100 p-0.5 text-orange-900">
                                                <ArrowDownLeft className="h-4 w-4" />
                                            </div>
                                            <span className="flex-grow text-sm leading-4 font-semibold">
                                                Impostos
                                            </span>
                                            <span className="text-sm leading-4 whitespace-nowrap">
                                                {formatCurrency(
                                                    financials.totalTax,
                                                )}
                                            </span>
                                            <span className="text-sm leading-4 font-medium whitespace-nowrap text-muted-foreground">
                                                {formatPercentage(
                                                    financials.totalTax,
                                                    financials.subtotal,
                                                )}
                                            </span>
                                        </div>
                                        {/* Detalhamento dos impostos por produto */}
                                        {hasDetails && (
                                            <ul className="flex w-full flex-col items-center justify-between pt-2 pl-0">
                                                {itemsWithTax.map(
                                                    (item: OrderItem) => {
                                                        const quantity =
                                                            item.qty ||
                                                            item.quantity ||
                                                            0;
                                                        const unitPrice =
                                                            item.unit_price ||
                                                            item.price ||
                                                            0;
                                                        const itemTotal =
                                                            quantity *
                                                            unitPrice;
                                                        const taxCat =
                                                            item
                                                                .internal_product
                                                                ?.tax_category;
                                                        if (!taxCat)
                                                            return null;
                                                        const taxRate =
                                                            taxCat.total_tax_rate /
                                                            100;
                                                        const itemTax =
                                                            itemTotal * taxRate;

                                                        return (
                                                            <li
                                                                key={item.id}
                                                                className="flex w-full flex-row items-start justify-between px-3 py-0.5"
                                                            >
                                                                <span className="text-xs leading-4 font-normal text-muted-foreground">
                                                                    {quantity}x{' '}
                                                                    {item.name}{' '}
                                                                    (
                                                                    {taxCat.total_tax_rate.toFixed(
                                                                        2,
                                                                    )}
                                                                    %)
                                                                </span>
                                                                <span className="text-xs leading-4 font-normal whitespace-nowrap text-muted-foreground">
                                                                    {formatCurrency(
                                                                        itemTax,
                                                                    )}
                                                                </span>
                                                            </li>
                                                        );
                                                    },
                                                )}
                                                {/* Impostos adicionais da categoria 'tax' */}
                                                {financials.additionalTaxes
                                                    .length > 0 &&
                                                    financials.additionalTaxes.map(
                                                        (
                                                            tax: CostCommissionItem,
                                                        ) => (
                                                            <li
                                                                key={tax.id}
                                                                className="flex w-full flex-row items-start justify-between px-3 py-0.5"
                                                            >
                                                                <span className="text-xs leading-4 font-normal text-muted-foreground">
                                                                    {tax.name}
                                                                    {tax.type ===
                                                                    'percentage'
                                                                        ? ` (${String(tax.value)}%)`
                                                                        : ''}
                                                                </span>
                                                                <span className="text-xs leading-4 font-normal whitespace-nowrap text-muted-foreground">
                                                                    {formatCurrency(
                                                                        tax.calculated_value,
                                                                    )}
                                                                </span>
                                                            </li>
                                                        ),
                                                    )}
                                            </ul>
                                        )}
                                    </li>
                                ) : null;
                            })()}

                            {/* Custos operacionais */}
                            {(() => {
                                const calculatedCosts =
                                    order.calculated_costs || null;
                                const costs = calculatedCosts?.costs || [];
                                const costsWithValue = costs.filter(
                                    (cost: CostCommissionItem) =>
                                        cost.calculated_value > 0,
                                );

                                return financials.totalCosts > 0 ||
                                    costsWithValue.length > 0 ? (
                                    <li className="flex flex-col gap-2 border-b-1 px-0 py-4">
                                        <div className="flex w-full flex-row items-center gap-2 px-3 py-0">
                                            <div className="flex items-center justify-center rounded-full bg-orange-100 p-0.5 text-orange-900">
                                                <ArrowDownLeft className="h-4 w-4" />
                                            </div>
                                            <span className="flex-grow text-sm leading-4 font-semibold">
                                                Custos operacionais
                                            </span>
                                            <span className="text-sm leading-4 whitespace-nowrap">
                                                {formatCurrency(
                                                    financials.totalCosts,
                                                )}
                                            </span>
                                            <span className="text-sm leading-4 font-medium whitespace-nowrap text-muted-foreground">
                                                {formatPercentage(
                                                    financials.totalCosts,
                                                    financials.subtotal,
                                                )}
                                            </span>
                                        </div>
                                        {/* Detalhamento dos custos */}
                                        {costsWithValue.length > 0 && (
                                            <ul className="flex w-full flex-col items-center justify-between gap-1 pt-2 pl-0">
                                                {costsWithValue.map(
                                                    (
                                                        cost: CostCommissionItem,
                                                    ) => (
                                                        <li
                                                            key={cost.id}
                                                            className="flex w-full flex-row items-start justify-between px-3 py-0"
                                                        >
                                                            <span className="text-xs leading-4 font-normal text-muted-foreground">
                                                                {cost.name}
                                                                {cost.type ===
                                                                'percentage'
                                                                    ? ` (${String(cost.value)}%)`
                                                                    : ''}
                                                            </span>
                                                            <span className="text-xs leading-4 font-normal whitespace-nowrap text-muted-foreground">
                                                                {formatCurrency(
                                                                    cost.calculated_value,
                                                                )}
                                                            </span>
                                                        </li>
                                                    ),
                                                )}
                                            </ul>
                                        )}
                                    </li>
                                ) : null;
                            })()}

                            {/* COMISSÃO */}
                            {(() => {
                                const calculatedCosts =
                                    order.calculated_costs || null;
                                const commissions =
                                    calculatedCosts?.commissions || [];
                                const commissionsWithValue = commissions.filter(
                                    (comm: CostCommissionItem) =>
                                        comm.calculated_value > 0,
                                );

                                return financials.totalCommissions > 0 ||
                                    commissionsWithValue.length > 0 ? (
                                    <li className="flex flex-col gap-2 border-b-1 px-0 py-4">
                                        <div className="flex w-full flex-row items-center gap-2 px-3 py-0">
                                            <div className="flex items-center justify-center rounded-full bg-orange-100 p-0.5 text-orange-900">
                                                <ArrowDownLeft className="h-4 w-4" />
                                            </div>
                                            <span className="flex-grow text-sm leading-4 font-semibold">
                                                Comissões
                                            </span>
                                            <span className="text-sm leading-4 whitespace-nowrap">
                                                {formatCurrency(
                                                    financials.totalCommissions,
                                                )}
                                            </span>
                                            <span className="text-sm leading-4 font-medium whitespace-nowrap text-muted-foreground">
                                                {formatPercentage(
                                                    financials.totalCommissions,
                                                    financials.subtotal,
                                                )}
                                            </span>
                                        </div>
                                        {/* Detalhamento das comissões */}
                                        {commissionsWithValue.length > 0 && (
                                            <ul className="flex w-full flex-col items-center justify-between gap-1 pt-2 pl-0">
                                                {commissionsWithValue.map(
                                                    (
                                                        commission: CostCommissionItem,
                                                    ) => (
                                                        <li
                                                            key={commission.id}
                                                            className="flex w-full flex-row items-start justify-between px-3 py-0"
                                                        >
                                                            <span className="text-xs leading-4 font-normal text-muted-foreground">
                                                                {
                                                                    commission.name
                                                                }
                                                                {commission.type ===
                                                                'percentage'
                                                                    ? ` (${String(commission.value)}%)`
                                                                    : ''}
                                                            </span>
                                                            <span className="text-xs leading-4 font-normal whitespace-nowrap text-muted-foreground">
                                                                {formatCurrency(
                                                                    commission.calculated_value,
                                                                )}
                                                            </span>
                                                        </li>
                                                    ),
                                                )}
                                            </ul>
                                        )}
                                    </li>
                                ) : null;
                            })()}

                            {/* Taxa do meio de pagamento - Sempre mostrar */}
                            <li className="flex flex-col gap-2 border-b-1 px-0 py-4">
                                <div className="flex w-full flex-row items-center gap-2 px-3 py-0">
                                    <div className="flex items-center justify-center rounded-full bg-orange-100 p-0.5 text-orange-900">
                                        <ArrowDownLeft className="h-4 w-4" />
                                    </div>
                                    <span className="flex-grow text-sm leading-4 font-semibold">
                                        Taxa do meio de pagamento
                                    </span>
                                    <span className="text-sm leading-4 whitespace-nowrap">
                                        {formatCurrency(
                                            financials.totalPaymentMethodFee,
                                        )}
                                    </span>
                                    <span className="text-sm leading-4 font-medium whitespace-nowrap text-muted-foreground">
                                        {formatPercentage(
                                            financials.totalPaymentMethodFee,
                                            financials.subtotal,
                                        )}
                                    </span>
                                </div>

                                {/* Mostrar taxas aplicadas se houver */}
                                {financials.paymentMethodFees.filter(
                                    (fee: CostCommissionItem) =>
                                        fee.calculated_value > 0,
                                ).length > 0 && (
                                    <ul className="flex w-full flex-col items-center justify-between gap-1 pt-2 pl-0">
                                        {financials.paymentMethodFees
                                            .filter(
                                                (fee: CostCommissionItem) =>
                                                    fee.calculated_value > 0,
                                            )
                                            .map((fee: CostCommissionItem) => (
                                                <li
                                                    key={fee.id}
                                                    className="flex w-full flex-row items-start justify-between px-3 py-0.5"
                                                >
                                                    <span className="text-xs leading-4 font-normal text-muted-foreground">
                                                        {fee.name}
                                                        {fee.type ===
                                                        'percentage'
                                                            ? ` (${String(fee.value)}%)`
                                                            : ''}
                                                    </span>
                                                    <span className="text-xs leading-4 font-normal whitespace-nowrap text-muted-foreground">
                                                        {formatCurrency(
                                                            fee.calculated_value,
                                                        )}
                                                    </span>
                                                </li>
                                            ))}
                                    </ul>
                                )}

                                {/* Mostrar apenas meios de pagamento sem taxa vinculada */}
                                {financials.realPayments.length > 0 &&
                                    financials.paymentMethodFees.filter(
                                        (fee: CostCommissionItem) =>
                                            fee.calculated_value > 0,
                                    ).length <
                                        financials.realPayments.length && (
                                        <ul className="flex w-full flex-col items-center justify-between pt-2 pl-0">
                                            {financials.realPayments.map(
                                                (
                                                    payment: unknown,
                                                    idx: number,
                                                ) => {
                                                    const p = payment as {
                                                        payment_method?: {
                                                            name?: string;
                                                            method?: string;
                                                            keyword?: string;
                                                        };
                                                        payment_value?: number;
                                                    };
                                                    const paymentName =
                                                        p.payment_method
                                                            ?.name ||
                                                        'Pagamento';
                                                    const paymentMethod =
                                                        p.payment_method
                                                            ?.method ||
                                                        p.payment_method
                                                            ?.keyword ||
                                                        '';
                                                    const paymentValue =
                                                        p.payment_value || 0;

                                                    // Verificar se já existe taxa para este método
                                                    const hasFee =
                                                        financials.paymentMethodFees.some(
                                                            (
                                                                fee: CostCommissionItem,
                                                            ) =>
                                                                fee.calculated_value >
                                                                    0 &&
                                                                fee.name
                                                                    .toLowerCase()
                                                                    .includes(
                                                                        paymentName.toLowerCase(),
                                                                    ),
                                                        );

                                                    // Não mostrar se já tem taxa
                                                    if (hasFee) return null;

                                                    return (
                                                        <li
                                                            key={idx}
                                                            className="flex w-full flex-row items-center justify-between gap-2 px-3 py-1 hover:bg-muted/50"
                                                        >
                                                            <div className="flex flex-1 flex-col gap-0.5">
                                                                <span className="text-xs leading-4 font-normal text-muted-foreground">
                                                                    {
                                                                        paymentName
                                                                    }
                                                                    {paymentMethod &&
                                                                        ` (${paymentMethod})`}
                                                                </span>
                                                            </div>
                                                            <span className="text-xs leading-4 font-normal whitespace-nowrap text-muted-foreground">
                                                                {formatCurrency(
                                                                    paymentValue,
                                                                )}
                                                            </span>
                                                            {paymentMethod && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-6 w-6 p-0"
                                                                    onClick={() => {
                                                                        setSelectedPayment(
                                                                            {
                                                                                method: paymentMethod,
                                                                                name: paymentName,
                                                                            },
                                                                        );
                                                                        setIsCreateFeeDialogOpen(
                                                                            true,
                                                                        );
                                                                    }}
                                                                >
                                                                    <Plus className="h-3 w-3" />
                                                                </Button>
                                                            )}
                                                        </li>
                                                    );
                                                },
                                            )}
                                        </ul>
                                    )}
                            </li>

                            {/* Receita líquida */}
                            <li className="flex flex-col gap-2 px-0 py-4">
                                <div className="flex w-full flex-row items-center gap-2 px-3 py-0">
                                    <div className="flex items-center justify-center rounded-full bg-green-100 p-1 text-green-900">
                                        <DollarSign className="h-3 w-3" />
                                    </div>
                                    <span className="flex-grow text-sm leading-4 font-semibold">
                                        Receita líquida
                                    </span>
                                    <span className="text-sm leading-4 font-semibold whitespace-nowrap text-green-700">
                                        {formatCurrency(financials.netRevenue)}
                                    </span>
                                    <span className="text-sm leading-4 font-medium whitespace-nowrap text-muted-foreground">
                                        {formatPercentage(
                                            financials.netRevenue,
                                            financials.subtotal,
                                        )}
                                    </span>
                                </div>
                            </li>
                        </ul>
                    </CardContent>
                </Card>

                {/* Dialog para criar taxa de pagamento */}
                {selectedPayment && order && (
                    <CreatePaymentFeeDialog
                        open={isCreateFeeDialogOpen}
                        onOpenChange={setIsCreateFeeDialogOpen}
                        orderId={order.id}
                        paymentMethod={selectedPayment.method}
                        paymentMethodName={selectedPayment.name}
                        provider={order.provider}
                        origin={order.origin}
                    />
                )}
            </>
        );
    }

    // Para iFood e outros providers, mostrar sale ou mensagem padrão
    if (!sale) {
        return (
            <Card className="h-fit gap-1 border-0 bg-gray-100 p-1 text-sm shadow-none dark:bg-neutral-950">
                <CardHeader className="gap-0 bg-gray-100 px-2 py-2 dark:bg-neutral-950">
                    <CardTitle className="flex h-[18px] items-center font-semibold">
                        Detalhamento financeiro do pedido
                    </CardTitle>
                </CardHeader>
                <CardContent className="rounded-md bg-card p-0">
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                        <p className="text-sm text-muted-foreground">
                            Detalhamento financeiro ainda não disponível
                        </p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    // Extrair dados do raw se existir
    const saleRaw = (sale.raw || {}) as { financialData?: unknown };
    const financialData = (saleRaw.financialData || {}) as Record<
        string,
        unknown
    >;

    // Valores principais
    const grossValue = sale.gross_value || 0;
    const serviceFeePaidByCustomer = sale.service_fee || 0;
    const discountValue = sale.discount_value || 0;
    const netValue = sale.net_value || 0;
    const bagValue = sale.bag_value || 0;
    const deliveryFee = sale.delivery_fee || 0;

    // Calcular taxas e comissões do iFood (estimativa baseada no padrão)
    const paymentCommission =
        (financialData.paymentCommission as number) || bagValue * 0.0311; // ~3.11%
    const ifoodCommission =
        (financialData.ifoodCommission as number) || bagValue * 0.12; // 12%
    const totalFees = paymentCommission + ifoodCommission;

    // Calcular total recebido via loja
    const receivedAtStore = bagValue - discountValue;

    // Valor base para cálculo de taxas
    const baseValue = bagValue;

    return (
        <Card className="h-fit gap-1 border-0 bg-gray-100 p-1 text-sm shadow-none dark:bg-neutral-950">
            <CardHeader className="gap-0 bg-gray-100 px-2 py-2 dark:bg-neutral-950">
                <CardTitle className="flex h-[18px] items-center font-semibold">
                    Detalhamento financeiro do pedido
                </CardTitle>
            </CardHeader>
            <CardContent className="rounded-md bg-card p-0">
                <ul className="m-0 flex w-full flex-col ps-0">
                    {/* Valor bruto da venda */}
                    {grossValue > 0 && (
                        <li className="flex flex-col gap-2 border-b-1 px-0 py-4">
                            <div className="flex w-full flex-row items-center gap-2 px-3 py-0">
                                <div className="flex items-center justify-center rounded-full bg-green-100 p-0.5 text-green-800">
                                    <ArrowUpRight className="h-4 w-4" />
                                </div>
                                <span className="flex-grow text-sm leading-4 font-semibold">
                                    Valor bruto da venda
                                </span>
                                <span className="text-sm leading-4 whitespace-nowrap">
                                    {new Intl.NumberFormat('pt-BR', {
                                        style: 'currency',
                                        currency: 'BRL',
                                    }).format(grossValue)}
                                </span>
                            </div>
                            <ul className="flex w-full flex-col items-center justify-between gap-2 pl-0">
                                <li className="flex w-full flex-row items-start justify-between px-3 py-0">
                                    <span className="text-xs leading-4 font-normal text-muted-foreground">
                                        Total recebido via{' '}
                                        {sale.sales_channel || 'iFood'}
                                    </span>
                                </li>
                                {discountValue > 0 && (
                                    <li className="flex w-full flex-row items-start justify-between px-3 py-0">
                                        <span className="text-xs leading-4 font-normal text-muted-foreground">
                                            Promoções custeadas pela loja
                                        </span>
                                    </li>
                                )}
                                {deliveryFee !== undefined && (
                                    <li className="flex w-full flex-row items-start justify-between px-3 py-0">
                                        <span className="text-xs leading-4 font-normal text-muted-foreground">
                                            Taxa de entrega no valor de{' '}
                                            {new Intl.NumberFormat('pt-BR', {
                                                style: 'currency',
                                                currency: 'BRL',
                                            }).format(deliveryFee)}
                                        </span>
                                    </li>
                                )}
                            </ul>
                        </li>
                    )}

                    {/* Valores pagos pelo cliente devidos ao iFood */}
                    {serviceFeePaidByCustomer > 0 && (
                        <li className="flex flex-col gap-2 border-b-1 px-0 py-4">
                            <div className="flex w-full flex-row items-center gap-2 px-3 py-0">
                                <div className="flex items-center justify-center rounded-full bg-red-100 p-0.5 text-red-900">
                                    <ArrowDownLeft className="h-4 w-4" />
                                </div>
                                <span className="flex-grow text-sm leading-4 font-semibold">
                                    Valores pagos pelo cliente devidos ao iFood
                                </span>
                                <span className="text-sm leading-4 whitespace-nowrap">
                                    -{' '}
                                    {new Intl.NumberFormat('pt-BR', {
                                        style: 'currency',
                                        currency: 'BRL',
                                    }).format(serviceFeePaidByCustomer)}
                                </span>
                            </div>
                            <ul className="flex w-full flex-col items-center justify-between pl-0">
                                <li className="flex w-full flex-row items-start justify-between px-3 py-2">
                                    <span className="text-sm leading-4 font-normal">
                                        <div className="flex h-[1em] items-center">
                                            <span>
                                                Taxa de serviço iFood cobrada do
                                                cliente
                                            </span>
                                        </div>
                                    </span>
                                    <span className="text-sm leading-4 font-normal whitespace-nowrap text-gray-700">
                                        -{' '}
                                        {new Intl.NumberFormat('pt-BR', {
                                            style: 'currency',
                                            currency: 'BRL',
                                        }).format(serviceFeePaidByCustomer)}
                                    </span>
                                </li>
                            </ul>
                        </li>
                    )}

                    {/* Promoções */}
                    {discountValue > 0 && (
                        <li className="flex flex-col gap-2 border-b-1 px-0 py-4">
                            <div className="flex w-full flex-row items-center gap-2 px-3 py-0">
                                <div className="flex items-center justify-center rounded-full bg-red-100 p-0.5 text-red-900">
                                    <ArrowDownLeft className="h-4 w-4" />
                                </div>
                                <span className="flex-grow text-sm leading-4 font-semibold">
                                    Promoções
                                </span>
                                <span className="text-sm leading-4 whitespace-nowrap">
                                    -{' '}
                                    {new Intl.NumberFormat('pt-BR', {
                                        style: 'currency',
                                        currency: 'BRL',
                                    }).format(discountValue)}
                                </span>
                            </div>
                            <ul className="flex w-full flex-col items-center justify-between gap-2 pl-0">
                                <li className="flex w-full flex-row items-start justify-between px-3 py-2">
                                    <span className="text-sm leading-4 font-normal">
                                        Promoção custeada pela loja
                                    </span>
                                    <span className="text-sm leading-4 font-normal whitespace-nowrap text-gray-700">
                                        -{' '}
                                        {new Intl.NumberFormat('pt-BR', {
                                            style: 'currency',
                                            currency: 'BRL',
                                        }).format(discountValue)}
                                    </span>
                                </li>
                            </ul>
                        </li>
                    )}

                    {/* Total recebido via loja */}
                    <li className="flex flex-col gap-2 border-b-1 px-0 py-4">
                        <div className="flex w-full flex-row items-center gap-2 px-3 py-0">
                            <div className="flex items-center justify-center rounded-full bg-gray-200 p-1 text-gray-700">
                                <ArrowRightLeft className="h-3 w-3" />
                            </div>
                            <span className="flex-grow text-sm leading-4 font-semibold">
                                Total recebido via loja
                            </span>
                            <span className="text-sm leading-4 whitespace-nowrap">
                                {new Intl.NumberFormat('pt-BR', {
                                    style: 'currency',
                                    currency: 'BRL',
                                }).format(receivedAtStore)}
                            </span>
                        </div>
                        <ul className="flex w-full flex-col items-center justify-between pl-0">
                            <li className="flex w-full flex-row items-start justify-between px-3 py-2">
                                <span className="text-sm leading-4 font-normal whitespace-nowrap text-gray-700">
                                    Pedido recebido via{' '}
                                    {sale.sales_channel || 'iFood'} no valor de{' '}
                                    {new Intl.NumberFormat('pt-BR', {
                                        style: 'currency',
                                        currency: 'BRL',
                                    }).format(bagValue)}
                                </span>
                            </li>
                        </ul>
                    </li>

                    {/* Taxas e comissões iFood */}
                    {totalFees > 0 && (
                        <li className="flex flex-col gap-2 border-b-1 px-0 py-4">
                            <div className="flex w-full flex-row items-center gap-2 px-3 py-0">
                                <div className="flex items-center justify-center rounded-full bg-red-100 p-0.5 text-red-900">
                                    <ArrowDownLeft className="h-4 w-4" />
                                </div>
                                <span className="flex-grow text-sm leading-4 font-semibold">
                                    Taxas e comissões{' '}
                                    {sale.sales_channel || 'iFood'}
                                </span>
                                <span className="text-sm leading-4 whitespace-nowrap">
                                    -{' '}
                                    {new Intl.NumberFormat('pt-BR', {
                                        style: 'currency',
                                        currency: 'BRL',
                                    }).format(totalFees)}
                                </span>
                            </div>
                            <ul className="flex w-full flex-col items-center justify-between pl-0">
                                <li className="flex w-full flex-row items-start justify-between px-3 py-2">
                                    <span className="text-sm leading-4 font-normal">
                                        Comissão pela transação do pagamento
                                    </span>
                                    <span className="text-sm leading-4 font-normal whitespace-nowrap text-gray-700">
                                        -{' '}
                                        {new Intl.NumberFormat('pt-BR', {
                                            style: 'currency',
                                            currency: 'BRL',
                                        }).format(paymentCommission)}
                                    </span>
                                </li>
                                <li className="flex w-full flex-row items-start justify-between px-3 py-2">
                                    <span className="text-sm leading-4 font-normal">
                                        Comissão {sale.sales_channel || 'iFood'}{' '}
                                        (12,0%)
                                    </span>
                                    <span className="text-sm leading-4 font-normal whitespace-nowrap text-gray-700">
                                        -{' '}
                                        {new Intl.NumberFormat('pt-BR', {
                                            style: 'currency',
                                            currency: 'BRL',
                                        }).format(ifoodCommission)}
                                    </span>
                                </li>
                                <li className="flex w-full flex-row items-start justify-between px-3 py-2">
                                    <span className="text-xs leading-4 font-normal text-gray-700">
                                        O valor de{' '}
                                        {new Intl.NumberFormat('pt-BR', {
                                            style: 'currency',
                                            currency: 'BRL',
                                        }).format(baseValue)}{' '}
                                        é o valor base usado para calcular as
                                        taxas e comissões{' '}
                                        {sale.sales_channel || 'iFood'} desse
                                        pedido.
                                    </span>
                                </li>
                            </ul>
                        </li>
                    )}

                    {/* Valor líquido a receber */}
                    <li className="flex flex-col gap-2 px-0 py-4">
                        <ul className="flex w-full flex-col items-center justify-between pl-0">
                            <li className="flex w-full flex-row items-start justify-between px-3 py-2">
                                <span className="text-sm leading-4 font-semibold">
                                    Valor líquido a receber
                                </span>
                                <span className="positive text-sm leading-4 font-semibold text-green-700">
                                    {new Intl.NumberFormat('pt-BR', {
                                        style: 'currency',
                                        currency: 'BRL',
                                    }).format(netValue)}
                                </span>
                            </li>
                        </ul>
                    </li>
                </ul>
            </CardContent>
        </Card>
    );
}
