import {
    CostCommissionItem,
    Order,
    OrderItem,
    OrderItemMapping,
} from '@/components/orders/columns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { calculateOrderCMV } from '@/lib/order-calculations';
import {
    AlertCircle,
    ArrowDownLeft,
    ArrowRightLeft,
    ArrowUpRight,
    Box,
    Check,
    CupSoda,
    DollarSign,
    IceCream2,
    Layers,
    Link2 as LinkIcon,
    Package,
    Pizza,
    Plus,
    Plus as PlusIcon,
    UtensilsCrossed,
} from 'lucide-react';
import { useState } from 'react';
import { CreatePaymentFeeDialog } from './create-payment-fee-dialog';
import { LinkPaymentFeeDialog } from './link-payment-fee-dialog';
import { QuickLinkDialog } from './quick-link-dialog';

/**
 * Calcula o custo de um item considerando múltiplas associações
 */
function calculateItemCost(item: OrderItem): number {
    const itemQuantity = item.qty || item.quantity || 0;

    // Novo sistema: usar mappings se existir
    if (item.mappings && item.mappings.length > 0) {
        // Separar mappings do tipo 'main' (item principal) dos add-ons
        const mainMappings = item.mappings.filter(
            (m: OrderItemMapping) => m.mapping_type === 'main',
        );

        // Se tem mapping 'main', calcular APENAS dele (ignorar add-ons aqui)
        if (mainMappings.length > 0) {
            const mappingsCost = mainMappings.reduce(
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

        // Se NÃO tem mapping 'main', mas tem add-ons, retorna 0
        // (os add-ons serão mostrados separadamente abaixo)
        return 0;
    }

    // Fallback: sistema legado (internal_product direto)
    if (item.internal_product?.unit_cost) {
        const unitCost = parseFloat(item.internal_product.unit_cost);
        return unitCost * itemQuantity;
    }

    // Se não tem nada, usar total_cost do backend se existir
    if (item.total_cost !== undefined && item.total_cost !== null) {
        return parseFloat(String(item.total_cost));
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

export function OrderFinancialCard({
    sale,
    order,
    internalProducts = [],
}: OrderFinancialCardProps) {
    // Estado para controlar o dialog de criação de taxa
    const [isCreateFeeDialogOpen, setIsCreateFeeDialogOpen] = useState(false);
    const [selectedPayment, setSelectedPayment] = useState<{
        method: string;
        name: string;
    } | null>(null);

    // Estado para controlar o dialog de vinculação de taxa existente
    const [isLinkFeeDialogOpen, setIsLinkFeeDialogOpen] = useState(false);
    const [availableFees, setAvailableFees] = useState<any[]>([]);
    const [loadingFees, setLoadingFees] = useState(false);

    // Estado para controlar o dialog de vinculação rápida
    const [isQuickLinkDialogOpen, setIsQuickLinkDialogOpen] = useState(false);
    const [selectedItemToLink, setSelectedItemToLink] = useState<{
        sku?: string;
        name: string;
        occurrences?: number;
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
                // Para Takeat, usar total_price (já com desconto) ao invés de old_total_price
                // old_total_price é o valor antes do desconto
                const totalPrice = parseFloat(String(order.raw.session.total_price)) || 0;
                paidByClient = totalPrice;
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
        let subtotal = grossTotal > 0 ? grossTotal : orderTotal;

        // Verifica se usou total_delivery_price (que já inclui subsídio e delivery)
        const usedTotalDeliveryPrice =
            order?.provider === 'takeat' &&
            order?.raw?.session?.total_delivery_price;

        // Se NÃO usou total_delivery_price, precisa somar subsídio e delivery
        if (!usedTotalDeliveryPrice) {
            subtotal += totalSubsidy + deliveryFee;
        }

        // CMV (custo dos produtos + add-ons)
        const items = order?.items || [];
        const cmv = calculateOrderCMV(items);

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

                                // Sempre mostrar a seção CMV, mesmo sem mapeamentos
                                return (
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
                                        <ul className="flex w-full flex-col items-center justify-between pl-0">
                                            {items.map((item: OrderItem) => {
                                                // Custo apenas do item principal (add-ons são listados separadamente abaixo)
                                                const itemTotalCost =
                                                    calculateItemCost(item);

                                                const quantity =
                                                    item.qty ||
                                                    item.quantity ||
                                                    0;
                                                const hasMappings =
                                                    item.mappings &&
                                                    item.mappings.length > 0;
                                                const hasLegacyProduct =
                                                    !hasMappings &&
                                                    item.internal_product
                                                        ?.unit_cost;

                                                // Verificar se tem produto interno vinculado no ITEM PRINCIPAL (mapping tipo 'main')
                                                // Não considerar apenas add-ons - esses são mostrados separadamente
                                                const hasInternalProduct =
                                                    hasMappings
                                                        ? item.mappings.some(
                                                              (
                                                                  m: OrderItemMapping,
                                                              ) =>
                                                                  m.mapping_type ===
                                                                      'main' &&
                                                                  m.internal_product_id !==
                                                                      null &&
                                                                  m.internal_product !==
                                                                      null &&
                                                                  m.internal_product !==
                                                                      undefined,
                                                          )
                                                        : hasLegacyProduct;
                                                const hasAnyMapping =
                                                    hasInternalProduct;

                                                // Determinar ícone e cor baseado no tipo de classificação
                                                const getItemIcon = () => {
                                                    // Buscar item_type do product_mapping
                                                    const itemType =
                                                        item.product_mapping
                                                            ?.item_type;

                                                    if (!itemType) {
                                                        return {
                                                            Icon: AlertCircle,
                                                            className:
                                                                'text-muted-foreground',
                                                        };
                                                    }

                                                    switch (itemType) {
                                                        case 'flavor':
                                                            return {
                                                                Icon: Pizza,
                                                                className:
                                                                    'text-purple-500',
                                                            };
                                                        case 'beverage':
                                                            return {
                                                                Icon: CupSoda,
                                                                className:
                                                                    'text-blue-500',
                                                            };
                                                        case 'complement':
                                                            return {
                                                                Icon: PlusIcon,
                                                                className:
                                                                    'text-green-500',
                                                            };
                                                        case 'parent_product':
                                                            return {
                                                                Icon: Package,
                                                                className:
                                                                    'text-orange-500',
                                                            };
                                                        case 'optional':
                                                            return {
                                                                Icon: Layers,
                                                                className:
                                                                    'text-amber-500',
                                                            };
                                                        case 'combo':
                                                            return {
                                                                Icon: Box,
                                                                className:
                                                                    'text-pink-500',
                                                            };
                                                        case 'side':
                                                            return {
                                                                Icon: UtensilsCrossed,
                                                                className:
                                                                    'text-teal-500',
                                                            };
                                                        case 'dessert':
                                                            return {
                                                                Icon: IceCream2,
                                                                className:
                                                                    'text-rose-500',
                                                            };
                                                        default:
                                                            return {
                                                                Icon: Package,
                                                                className:
                                                                    'text-muted-foreground',
                                                            };
                                                    }
                                                };

                                                const { Icon, className } =
                                                    getItemIcon();

                                                // Processar add-ons enriquecidos
                                                const addOnsEnriched =
                                                    item.add_ons_enriched || [];

                                                // Tooltip com produto interno vinculado
                                                const getMappingTooltip =
                                                    () => {
                                                        const parts = [];
                                                        if (
                                                            hasMappings &&
                                                            item.mappings
                                                        ) {
                                                            // Mostrar apenas mappings do tipo 'main' (do item principal)
                                                            item.mappings.forEach(
                                                                (
                                                                    m: OrderItemMapping,
                                                                ) => {
                                                                    // Filtrar apenas mapping principal, não add-ons
                                                                    if (
                                                                        m.mapping_type ===
                                                                            'main' &&
                                                                        m
                                                                            .internal_product
                                                                            ?.name
                                                                    ) {
                                                                        const pct =
                                                                            (
                                                                                (m.quantity ||
                                                                                    0) *
                                                                                100
                                                                            ).toFixed(
                                                                                0,
                                                                            );
                                                                        parts.push(
                                                                            `${m.internal_product.name} (${pct}% - Principal)`,
                                                                        );
                                                                    }
                                                                },
                                                            );
                                                        }

                                                        // Se não tem mapping principal, verificar product_mapping (classificação)
                                                        if (
                                                            parts.length ===
                                                                0 &&
                                                            item.product_mapping
                                                                ?.internal_product
                                                        ) {
                                                            parts.push(
                                                                `${item.product_mapping.internal_product.name} (100% - Classificado)`,
                                                            );
                                                        } else if (
                                                            parts.length ===
                                                                0 &&
                                                            hasLegacyProduct &&
                                                            item.internal_product
                                                        ) {
                                                            parts.push(
                                                                `${item.internal_product.name} (100% - Legado)`,
                                                            );
                                                        }
                                                        return parts.length > 0
                                                            ? parts.join(', ')
                                                            : null;
                                                    };

                                                const tooltipText =
                                                    getMappingTooltip();

                                                return (
                                                    <li
                                                        key={item.id}
                                                        className="flex w-full flex-col gap-1"
                                                    >
                                                        <div className="flex w-full flex-row items-center justify-between gap-2 px-3 py-1.5">
                                                            <div className="flex min-w-0 flex-1 items-center gap-2">
                                                                <Icon
                                                                    className={`h-3.5 w-3.5 shrink-0 ${className}`}
                                                                />
                                                                {quantity >
                                                                    1 && (
                                                                    <span className="rounded bg-blue-50 px-1 py-0.5 text-[10px] leading-3 font-medium text-blue-600">
                                                                        {
                                                                            quantity
                                                                        }
                                                                        x
                                                                    </span>
                                                                )}
                                                                <TooltipProvider
                                                                    delayDuration={
                                                                        300
                                                                    }
                                                                >
                                                                    <Tooltip>
                                                                        <TooltipTrigger
                                                                            asChild
                                                                        >
                                                                            <span className="cursor-help truncate text-xs leading-4 font-medium text-muted-foreground">
                                                                                {
                                                                                    item.name
                                                                                }
                                                                            </span>
                                                                        </TooltipTrigger>
                                                                        {tooltipText && (
                                                                            <TooltipContent
                                                                                side="right"
                                                                                className="max-w-xs"
                                                                            >
                                                                                <p className="text-xs">
                                                                                    Vinculado
                                                                                    a:{' '}
                                                                                    {
                                                                                        tooltipText
                                                                                    }
                                                                                </p>
                                                                            </TooltipContent>
                                                                        )}
                                                                    </Tooltip>
                                                                </TooltipProvider>
                                                                {hasAnyMapping ? (
                                                                    <Check className="h-3.5 w-3.5 shrink-0 text-green-600" />
                                                                ) : (
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-5 w-5 p-0 hover:bg-blue-100"
                                                                        onClick={(
                                                                            e,
                                                                        ) => {
                                                                            e.stopPropagation();
                                                                            setSelectedItemToLink(
                                                                                {
                                                                                    sku:
                                                                                        item.sku ||
                                                                                        item.external_code,
                                                                                    name: item.name,
                                                                                    occurrences: 1,
                                                                                },
                                                                            );
                                                                            setIsQuickLinkDialogOpen(
                                                                                true,
                                                                            );
                                                                        }}
                                                                    >
                                                                        <LinkIcon className="h-3 w-3 text-muted-foreground hover:text-blue-600" />
                                                                    </Button>
                                                                )}
                                                            </div>
                                                            <span className="text-xs leading-4 font-medium whitespace-nowrap text-muted-foreground">
                                                                {formatCurrency(
                                                                    itemTotalCost,
                                                                )}
                                                            </span>
                                                        </div>

                                                        {/* Mostrar todos os add-ons/complementos com ícones */}
                                                        {addOnsEnriched.length >
                                                            0 && (
                                                            <ul className="flex w-full flex-col gap-0.5 pl-3">
                                                                {addOnsEnriched.map(
                                                                    (
                                                                        addOn,
                                                                        addonIdx: number,
                                                                    ) => {
                                                                        const isLast =
                                                                            addonIdx ===
                                                                            addOnsEnriched.length -
                                                                                1;
                                                                        const treeChar =
                                                                            isLast
                                                                                ? '└'
                                                                                : '├';

                                                                        // Determinar ícone do add-on
                                                                        const getAddonIcon =
                                                                            () => {
                                                                                const itemType =
                                                                                    addOn
                                                                                        .product_mapping
                                                                                        ?.item_type;
                                                                                if (
                                                                                    !itemType
                                                                                ) {
                                                                                    return {
                                                                                        Icon: AlertCircle,
                                                                                        className:
                                                                                            'text-orange-500',
                                                                                    };
                                                                                }
                                                                                switch (
                                                                                    itemType
                                                                                ) {
                                                                                    case 'flavor':
                                                                                        return {
                                                                                            Icon: Pizza,
                                                                                            className:
                                                                                                'text-purple-500',
                                                                                        };
                                                                                    case 'beverage':
                                                                                        return {
                                                                                            Icon: CupSoda,
                                                                                            className:
                                                                                                'text-blue-500',
                                                                                        };
                                                                                    case 'complement':
                                                                                        return {
                                                                                            Icon: PlusIcon,
                                                                                            className:
                                                                                                'text-green-500',
                                                                                        };
                                                                                    case 'parent_product':
                                                                                        return {
                                                                                            Icon: Package,
                                                                                            className:
                                                                                                'text-orange-500',
                                                                                        };
                                                                                    case 'optional':
                                                                                        return {
                                                                                            Icon: Layers,
                                                                                            className:
                                                                                                'text-amber-500',
                                                                                        };
                                                                                    case 'combo':
                                                                                        return {
                                                                                            Icon: Box,
                                                                                            className:
                                                                                                'text-pink-500',
                                                                                        };
                                                                                    case 'side':
                                                                                        return {
                                                                                            Icon: UtensilsCrossed,
                                                                                            className:
                                                                                                'text-teal-500',
                                                                                        };
                                                                                    case 'dessert':
                                                                                        return {
                                                                                            Icon: IceCream2,
                                                                                            className:
                                                                                                'text-rose-500',
                                                                                        };
                                                                                    default:
                                                                                        return {
                                                                                            Icon: Package,
                                                                                            className:
                                                                                                'text-muted-foreground',
                                                                                        };
                                                                                }
                                                                            };

                                                                        const {
                                                                            Icon: AddonIcon,
                                                                            className:
                                                                                addonClassName,
                                                                        } =
                                                                            getAddonIcon();
                                                                        // Verificar se tem produto vinculado:
                                                                        // 1. Via ProductMapping (classificação na Triagem)
                                                                        // 2. OU via OrderItemMapping (unit_cost_override existe)
                                                                        const hasMapping =
                                                                            (!!addOn.product_mapping &&
                                                                                !!addOn
                                                                                    .product_mapping
                                                                                    .internal_product) ||
                                                                            (addOn.unit_cost_override !==
                                                                                undefined &&
                                                                                addOn.unit_cost_override !==
                                                                                    null);

                                                                        // Verificar se é sabor de pizza
                                                                        const isFlavor =
                                                                            addOn
                                                                                .product_mapping
                                                                                ?.item_type ===
                                                                            'flavor';

                                                                        // Detectar tamanho da pizza do nome do item pai
                                                                        let pizzaSize:
                                                                            | string
                                                                            | null =
                                                                            null;
                                                                        if (
                                                                            isFlavor
                                                                        ) {
                                                                            const itemNameLower =
                                                                                item.name.toLowerCase();
                                                                            if (
                                                                                itemNameLower.includes(
                                                                                    'broto',
                                                                                )
                                                                            ) {
                                                                                pizzaSize =
                                                                                    'broto';
                                                                            } else if (
                                                                                itemNameLower.includes(
                                                                                    'média',
                                                                                ) ||
                                                                                itemNameLower.includes(
                                                                                    'media',
                                                                                )
                                                                            ) {
                                                                                pizzaSize =
                                                                                    'media';
                                                                            } else if (
                                                                                itemNameLower.includes(
                                                                                    'grande',
                                                                                )
                                                                            ) {
                                                                                pizzaSize =
                                                                                    'grande';
                                                                            } else if (
                                                                                itemNameLower.includes(
                                                                                    'família',
                                                                                ) ||
                                                                                itemNameLower.includes(
                                                                                    'familia',
                                                                                )
                                                                            ) {
                                                                                pizzaSize =
                                                                                    'familia';
                                                                            }
                                                                        }

                                                                        // Calcular custo do add-on
                                                                        let addonCost = 0;
                                                                        const addonQuantity =
                                                                            addOn.quantity ||
                                                                            1;

                                                                        // PRIORIDADE 1: Usar unit_cost_override se existir (valor do OrderItemMapping)
                                                                        if (
                                                                            addOn.unit_cost_override !==
                                                                                undefined &&
                                                                            addOn.unit_cost_override !==
                                                                                null
                                                                        ) {
                                                                            // Aplicar a fração (mapping_quantity) se existir
                                                                            const mappingQuantity =
                                                                                addOn.mapping_quantity ||
                                                                                1.0;
                                                                            addonCost =
                                                                                parseFloat(
                                                                                    String(
                                                                                        addOn.unit_cost_override,
                                                                                    ),
                                                                                ) *
                                                                                mappingQuantity *
                                                                                addonQuantity;
                                                                        } else {
                                                                            // FALLBACK: Sistema legado
                                                                            const internalProduct =
                                                                                addOn
                                                                                    .product_mapping
                                                                                    ?.internal_product;

                                                                            let baseAddonCost = 0;
                                                                            if (
                                                                                internalProduct?.unit_cost
                                                                            ) {
                                                                                baseAddonCost =
                                                                                    parseFloat(
                                                                                        internalProduct.unit_cost,
                                                                                    );
                                                                            }

                                                                            // Contar total de sabores no item para calcular denominador
                                                                            const totalFlavors =
                                                                                isFlavor
                                                                                    ? addOnsEnriched.filter(
                                                                                          (
                                                                                              a,
                                                                                          ) =>
                                                                                              a
                                                                                                  .product_mapping
                                                                                                  ?.item_type ===
                                                                                              'flavor',
                                                                                      )
                                                                                          .length
                                                                                    : 0;

                                                                            // Aplicar fração ao custo se for sabor
                                                                            addonCost =
                                                                                isFlavor &&
                                                                                totalFlavors >
                                                                                    1
                                                                                    ? (baseAddonCost /
                                                                                          totalFlavors) *
                                                                                      addonQuantity
                                                                                    : baseAddonCost *
                                                                                      addonQuantity;
                                                                        }

                                                                        // Calcular fração para exibição
                                                                        // PRIORIDADE: usar mapping_quantity (valor real salvo no OrderItemMapping)
                                                                        let fractionText:
                                                                            | string
                                                                            | null =
                                                                            null;
                                                                        if (
                                                                            isFlavor &&
                                                                            addOn.mapping_quantity !==
                                                                                undefined &&
                                                                            addOn.mapping_quantity !==
                                                                                null
                                                                        ) {
                                                                            const fraction =
                                                                                addOn.mapping_quantity;
                                                                            // Converter decimal para fração visual
                                                                            if (
                                                                                Math.abs(
                                                                                    fraction -
                                                                                        0.5,
                                                                                ) <
                                                                                0.01
                                                                            ) {
                                                                                fractionText =
                                                                                    '1/2';
                                                                            } else if (
                                                                                Math.abs(
                                                                                    fraction -
                                                                                        0.333,
                                                                                ) <
                                                                                    0.01 ||
                                                                                Math.abs(
                                                                                    fraction -
                                                                                        1 /
                                                                                            3,
                                                                                ) <
                                                                                    0.01
                                                                            ) {
                                                                                fractionText =
                                                                                    '1/3';
                                                                            } else if (
                                                                                Math.abs(
                                                                                    fraction -
                                                                                        0.25,
                                                                                ) <
                                                                                0.01
                                                                            ) {
                                                                                fractionText =
                                                                                    '1/4';
                                                                            } else if (
                                                                                Math.abs(
                                                                                    fraction -
                                                                                        0.2,
                                                                                ) <
                                                                                0.01
                                                                            ) {
                                                                                fractionText =
                                                                                    '1/5';
                                                                            } else if (
                                                                                Math.abs(
                                                                                    fraction -
                                                                                        0.166,
                                                                                ) <
                                                                                    0.01 ||
                                                                                Math.abs(
                                                                                    fraction -
                                                                                        1 /
                                                                                            6,
                                                                                ) <
                                                                                    0.01
                                                                            ) {
                                                                                fractionText =
                                                                                    '1/6';
                                                                            } else if (
                                                                                fraction <
                                                                                1
                                                                            ) {
                                                                                fractionText = `${(fraction * 100).toFixed(0)}%`;
                                                                            }
                                                                        } else if (
                                                                            isFlavor
                                                                        ) {
                                                                            // FALLBACK: contar sabores (sistema legado)
                                                                            // SOMA as quantidades: 2x Calabresa = 2 sabores
                                                                            const totalFlavors =
                                                                                addOnsEnriched
                                                                                    .filter(
                                                                                        (
                                                                                            a,
                                                                                        ) =>
                                                                                            a
                                                                                                .product_mapping
                                                                                                ?.item_type ===
                                                                                            'flavor',
                                                                                    )
                                                                                    .reduce(
                                                                                        (
                                                                                            sum,
                                                                                            a,
                                                                                        ) =>
                                                                                            sum +
                                                                                            (a.quantity ||
                                                                                                1),
                                                                                        0,
                                                                                    );
                                                                            if (
                                                                                totalFlavors >
                                                                                1
                                                                            ) {
                                                                                fractionText = `1/${totalFlavors}`;
                                                                            }
                                                                        }

                                                                        // Tooltip para add-on
                                                                        const internalProduct =
                                                                            addOn
                                                                                .product_mapping
                                                                                ?.internal_product;
                                                                        const addonTooltipText =
                                                                            internalProduct?.name
                                                                                ? `${internalProduct.name} (100% - Complemento)`
                                                                                : null;

                                                                        return (
                                                                            <li
                                                                                key={
                                                                                    addonIdx
                                                                                }
                                                                                className="flex w-full flex-row items-start justify-between px-3 py-0"
                                                                            >
                                                                                <div className="flex items-center gap-1.5">
                                                                                    <span className="font-mono text-xs leading-4 font-normal text-muted-foreground/70">
                                                                                        {
                                                                                            treeChar
                                                                                        }
                                                                                    </span>
                                                                                    <AddonIcon
                                                                                        className={`h-3 w-3 shrink-0 ${addonClassName}`}
                                                                                    />
                                                                                    {fractionText && (
                                                                                        <span className="rounded bg-purple-50 px-1 py-0.5 text-[10px] leading-3 font-medium text-purple-600">
                                                                                            {
                                                                                                fractionText
                                                                                            }
                                                                                        </span>
                                                                                    )}
                                                                                    {addonQuantity >
                                                                                        1 && (
                                                                                        <span className="rounded bg-blue-50 px-1 py-0.5 text-[10px] leading-3 font-medium text-blue-600">
                                                                                            {
                                                                                                addonQuantity
                                                                                            }

                                                                                            x
                                                                                        </span>
                                                                                    )}
                                                                                    {addonTooltipText ? (
                                                                                        <TooltipProvider
                                                                                            delayDuration={
                                                                                                300
                                                                                            }
                                                                                        >
                                                                                            <Tooltip>
                                                                                                <TooltipTrigger
                                                                                                    asChild
                                                                                                >
                                                                                                    <span className="cursor-help text-xs leading-4 font-normal text-muted-foreground/70">
                                                                                                        {
                                                                                                            addOn.name
                                                                                                        }
                                                                                                    </span>
                                                                                                </TooltipTrigger>
                                                                                                <TooltipContent
                                                                                                    side="right"
                                                                                                    className="max-w-xs"
                                                                                                >
                                                                                                    <p className="text-xs">
                                                                                                        Vinculado
                                                                                                        a:{' '}
                                                                                                        {
                                                                                                            addonTooltipText
                                                                                                        }
                                                                                                    </p>
                                                                                                </TooltipContent>
                                                                                            </Tooltip>
                                                                                        </TooltipProvider>
                                                                                    ) : (
                                                                                        <span className="text-xs leading-4 font-normal text-muted-foreground/70">
                                                                                            {
                                                                                                addOn.name
                                                                                            }
                                                                                        </span>
                                                                                    )}
                                                                                    {hasMapping ? (
                                                                                        <Check className="h-3 w-3 shrink-0 text-green-600" />
                                                                                    ) : (
                                                                                        <Button
                                                                                            variant="ghost"
                                                                                            size="sm"
                                                                                            className="h-4 w-4 p-0 hover:bg-blue-100"
                                                                                            onClick={(
                                                                                                e,
                                                                                            ) => {
                                                                                                e.stopPropagation();
                                                                                                setSelectedItemToLink(
                                                                                                    {
                                                                                                        sku:
                                                                                                            addOn.sku ||
                                                                                                            addOn.external_code,
                                                                                                        name: addOn.name,
                                                                                                        occurrences: 1,
                                                                                                    },
                                                                                                );
                                                                                                setIsQuickLinkDialogOpen(
                                                                                                    true,
                                                                                                );
                                                                                            }}
                                                                                        >
                                                                                            <LinkIcon className="h-2.5 w-2.5 text-muted-foreground hover:text-blue-600" />
                                                                                        </Button>
                                                                                    )}
                                                                                </div>
                                                                                <span className="text-xs leading-4 font-normal whitespace-nowrap text-muted-foreground/70">
                                                                                    {formatCurrency(
                                                                                        addonCost,
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
                                            })}
                                        </ul>
                                    </li>
                                );
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
                                                                    title="Vincular taxa de pagamento"
                                                                    onClick={async () => {
                                                                        setSelectedPayment(
                                                                            {
                                                                                method: paymentMethod,
                                                                                name: paymentName,
                                                                            },
                                                                        );

                                                                        // Carregar taxas disponíveis
                                                                        if (
                                                                            order
                                                                        ) {
                                                                            setLoadingFees(
                                                                                true,
                                                                            );
                                                                            try {
                                                                                // Passar paymentMethod e paymentType para obter análise de compatibilidade
                                                                                const response =
                                                                                    await fetch(
                                                                                        `/orders/${order.id}/available-payment-fees?payment_method=${paymentMethod}&payment_type=offline`,
                                                                                    );
                                                                                const fees =
                                                                                    await response.json();
                                                                                setAvailableFees(
                                                                                    fees,
                                                                                );
                                                                                setIsLinkFeeDialogOpen(
                                                                                    true,
                                                                                );
                                                                            } catch (error) {
                                                                                console.error(
                                                                                    'Erro ao carregar taxas:',
                                                                                    error,
                                                                                );
                                                                                // Fallback: abrir dialog de criação
                                                                                setIsCreateFeeDialogOpen(
                                                                                    true,
                                                                                );
                                                                            } finally {
                                                                                setLoadingFees(
                                                                                    false,
                                                                                );
                                                                            }
                                                                        }
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

                {/* Dialog para vincular taxa existente */}
                {order && selectedPayment && (
                    <LinkPaymentFeeDialog
                        open={isLinkFeeDialogOpen}
                        onOpenChange={setIsLinkFeeDialogOpen}
                        orderId={order.id}
                        paymentMethod={selectedPayment.method}
                        paymentMethodName={selectedPayment.name}
                        provider={order.provider}
                        origin={order.origin}
                        availableFees={availableFees}
                        onCreateNew={() => {
                            setIsLinkFeeDialogOpen(false);
                            setIsCreateFeeDialogOpen(true);
                        }}
                    />
                )}

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

                {/* Dialog de vinculação rápida */}
                <QuickLinkDialog
                    open={isQuickLinkDialogOpen}
                    onOpenChange={setIsQuickLinkDialogOpen}
                    item={selectedItemToLink}
                    internalProducts={internalProducts}
                />
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
