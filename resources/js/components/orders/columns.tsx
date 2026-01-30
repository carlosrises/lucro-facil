import { OrderActionsCell } from '@/components/orders/order-actions-cell';
import {
    OrderStatus,
    OrderStatusBadge,
} from '@/components/orders/order-status-badge';
import { ProviderBadge } from '@/components/provider-badge';
import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import {
    calculateItemCost,
    calculateOrderCMV,
    isTakeatIfoodOrder,
} from '@/lib/order-calculations';
import { IconChevronDown } from '@tabler/icons-react';
import { ColumnDef } from '@tanstack/react-table';
import { endOfDay, startOfDay } from 'date-fns';
import { Badge } from '../ui/badge';

/**
 * Calcula o subtotal do pedido seguindo a mesma lógica do card financeiro
 * Este é o valor base usado para calcular a margem de lucro
 *
 * IMPORTANTE: Esta função deve manter a MESMA lógica da função calculateFinancials
 * em order-financial-card.tsx para garantir consistência entre tabela e detalhes
 *
 * @export Exportada para uso em data-table e outros componentes
 */
export function calculateOrderSubtotal(order: Order): number {
    // LÓGICA SIMPLIFICADA (alinhada com backend OrderCostService):
    // Subtotal = soma de TODOS os payment_value - taxa iFood (se Takeat+iFood)

    const grossTotal = parseFloat(String(order?.gross_total || '0')) || 0;

    // Para Takeat: somar TODOS os pagamentos (incluindo subsídios)
    const sessionPayments = order?.raw?.session?.payments || [];

    if (order?.provider === 'takeat' && sessionPayments.length > 0) {
        // Somar TODOS os payment_value
        let subtotal = sessionPayments.reduce((sum: number, payment: any) => {
            const value = parseFloat(String(payment.payment_value || '0')) || 0;
            return sum + value;
        }, 0);

        // Se for Takeat + iFood, subtrair taxa de R$0,99
        const origin = order?.origin?.toLowerCase() || '';
        const sessionChannel =
            order?.raw?.session?.sales_channel?.toLowerCase() || '';
        const isIfoodOrder = origin === 'ifood' || sessionChannel === 'ifood';

        if (isIfoodOrder && subtotal > 0) {
            const rawSessionServiceFee =
                parseFloat(
                    String(
                        order?.raw?.session?.service_fee ??
                            order?.raw?.session?.serviceFee ??
                            0,
                    ),
                ) || 0;
            const ifoodFee =
                rawSessionServiceFee > 0 ? rawSessionServiceFee : 0.99;
            subtotal = Math.max(subtotal - ifoodFee, 0);
        }

        return subtotal;
    }

    // Fallback para outros providers ou se não houver pagamentos
    return grossTotal;
}

// Tipagem vinda do backend
export type OrderItemMapping = {
    id: number;
    order_item_id: number;
    internal_product_id: number;
    quantity: number;
    mapping_type: 'main' | 'option' | 'addon';
    option_type?:
        | 'pizza_flavor'
        | 'regular'
        | 'addon'
        | 'observation'
        | 'drink'
        | string
        | null;
    unit_cost_override?: number | string | null;
    external_reference?: string | null;
    external_name?: string | null;
    internal_product?: {
        id: number;
        name: string;
        unit_cost: string;
        tax_category_id?: number | null;
        tax_category?: {
            id: number;
            name: string;
            total_tax_rate: number;
        };
    };
};

export type OrderItem = {
    id: number;
    sku?: string;
    name: string;
    quantity: number;
    qty?: number;
    price: number;
    unit_price?: number;
    total_cost?: number; // Custo total calculado pelo backend
    add_ons?: any[]; // Add-ons originais
    add_ons_product_mappings?: {
        [index: number]: {
            id: number;
            item_type: string | null;
            internal_product_id: number | null;
            internal_product?: {
                id: number;
                name: string;
                unit_cost: string;
            } | null;
        };
    }; // ProductMappings dos add-ons (da Triagem)
    add_ons_enriched?: Array<{
        name: string;
        sku: string;
        product_mapping?: {
            id: number;
            item_type: string | null;
            internal_product_id: number | null;
        } | null;
    }>; // Add-ons com ProductMapping
    internal_product?: {
        id: number;
        name: string;
        unit_cost: string;
        tax_category_id?: number | null;
        tax_category?: {
            id: number;
            name: string;
            total_tax_rate: number;
        };
    };
    product_mapping?: {
        id: number;
        item_type: string | null;
        internal_product_id: number | null;
    };
    mappings?: OrderItemMapping[]; // Novo: múltiplas associações
};

export type CostCommissionItem = {
    id: number;
    name: string;
    category: 'cost' | 'commission' | 'tax' | 'payment_method';
    type: 'fixed' | 'percentage';
    value: number;
    calculated_value: number;
    percentage_rate?: number;
    payment_type?: 'online' | 'offline' | 'all' | null;
};

export type CalculatedCosts = {
    costs: CostCommissionItem[];
    commissions: CostCommissionItem[];
    taxes: CostCommissionItem[];
    payment_methods: CostCommissionItem[];
    total_costs: number;
    total_commissions: number;
    total_taxes: number;
    total_payment_methods: number;
    net_revenue: number;
};

export type Order = {
    id: number;
    code: string;
    short_reference?: string | null; // Número sequencial diário (#1, #2, #3...)
    status: string;
    provider: string;
    origin: string; // Canal/origem do pedido (ifood, 99food, takeat, etc)
    store_id?: number | null;
    placed_at: string | null;
    subtotal?: number | 0;
    fee?: number | 0;
    total?: number | 0;
    cost?: number | 0;
    tax?: number | 0;
    extra_cost?: number | 0;
    net_total?: number | 0;
    gross_total?: string | null;
    discount_total?: string | null;
    delivery_fee?: string | null;
    total_costs?: number | string | null;
    total_commissions?: number | string | null;
    net_revenue?: number | string | null;
    costs_calculated_at?: string | null;
    calculated_costs?: CalculatedCosts | null;
    items?: OrderItem[];
    raw: {
        id?: string;
        items?: any[];
        total?: {
            benefits?: number;
            subTotal?: number;
            deliveryFee?: number;
            orderAmount?: number;
            additionalFees?: number;
        };
        isTest?: boolean;
        picking?: any;
        category?: string;
        customer?: {
            id?: string;
            name?: string;
            phone?: {
                number?: string;
                localizer?: string;
                localizerExpiration?: string;
            };
            segmentation?: string;
            ordersCountOnMerchant?: number;
            documentNumber?: string;
        };
        delivery?: {
            mode?: string;
            pickupCode?: string;
            deliveredBy?: string;
            description?: string;
            observations?: string;
            deliveryAddress?: {
                city?: string;
                state?: string;
                country?: string;
                reference?: string;
                complement?: string;
                postalCode?: string;
                streetName?: string;
                coordinates?: {
                    latitude?: number;
                    longitude?: number;
                };
                neighborhood?: string;
                streetNumber?: string;
                formattedAddress?: string;
            };
            deliveryDateTime?: string;
        };
        merchant?: any;
        payments?: any;
        createdAt?: string;
        displayId?: string;
        orderType?: string;
        orderTiming?: string;
        salesChannel?: string;
        additionalFees?: any[];
        preparationStartDateTime?: string;
        [key: string]: any;
    };
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
};

export const columns: ColumnDef<Order>[] = [
    {
        id: 'invoiced',
        header: '',
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => {
            const items = row.original.items || [];
            const raw = row.original.raw;
            const orderTotal = raw?.total?.orderAmount ?? 0;
            const status = row.original.status;
            const provider = row.original.provider;

            let color = 'bg-yellow-500';
            let label = 'Não faturado';

            // Para pedidos Takeat, verificar se tem pagamento
            if (provider === 'takeat') {
                const payments = (raw as any)?.session?.payments ?? [];
                const hasPayment = payments.length > 0;

                if (status === 'CANCELLED') {
                    color = 'bg-red-500';
                    label = 'Cancelado';
                } else if (hasPayment) {
                    // Com pagamento = Faturado (verde)
                    color = 'bg-green-500';
                    label = 'Faturado';
                } else {
                    // Sem pagamento
                    color = 'bg-gray-400';
                    label = 'Sem pagamento';
                }
            } else {
                // Para outros providers (iFood, etc), manter lógica original
                if (status === 'CANCELLED') {
                    color = 'bg-red-500';
                    label = 'Cancelado';
                } else if (orderTotal > 0) {
                    // Calcular custo total
                    const totalCost = items.reduce((sum, item) => {
                        return sum + calculateItemCost(item);
                    }, 0);

                    // Calcular impostos totais
                    const totalTax = items.reduce((sum, item) => {
                        if (
                            item.internal_product?.tax_category
                                ?.total_tax_rate !== undefined &&
                            item.internal_product?.tax_category
                                ?.total_tax_rate !== null
                        ) {
                            const quantity = item.qty || item.quantity || 0;
                            const unitPrice =
                                item.unit_price || item.price || 0;
                            const itemTotal = quantity * unitPrice;
                            const taxRate =
                                item.internal_product.tax_category
                                    .total_tax_rate / 100;
                            return sum + itemTotal * taxRate;
                        }
                        return sum;
                    }, 0);

                    const profit = orderTotal - totalCost - totalTax;
                    if (profit > 0) {
                        color = 'bg-green-500';
                        label = 'Faturado';
                    } else {
                        color = 'bg-yellow-500';
                        label = 'Sem lucro';
                    }
                }
            }

            return (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div
                                className={`mx-auto h-4 w-4 rounded-full ${color}`}
                            />
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>{label}</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            );
        },
    },
    {
        accessorKey: 'placed_at',
        header: 'Horário',
        cell: ({ row }) => {
            const date = row.original.placed_at
                ? new Date(row.original.placed_at)
                : null;

            return (
                <div className="flex flex-col">
                    <span className="font-medium">
                        {date
                            ? date.toLocaleTimeString('pt-BR', {
                                  timeZone: 'America/Sao_Paulo',
                              })
                            : '--:--'}
                    </span>
                    <span className="text-[10px] text-muted-foreground lg:text-xs">
                        {date
                            ? date.toLocaleDateString('pt-BR', {
                                  timeZone: 'America/Sao_Paulo',
                              })
                            : '--/--/----'}
                    </span>
                </div>
            );
        },
        filterFn: (row, columnId, filterValue) => {
            if (!filterValue) return true;

            const raw = row.getValue<string>(columnId);
            if (!raw) return false;

            const date = new Date(raw);
            if (isNaN(date.getTime())) return false;

            const from = filterValue.from
                ? startOfDay(new Date(filterValue.from))
                : null;
            const to = filterValue.to
                ? endOfDay(new Date(filterValue.to))
                : null;

            if (from && date < from) return false;
            if (to && date > to) return false;

            return true;
        },
    },
    {
        accessorKey: 'provider',
        header: 'Canal',
        cell: ({ row }) => {
            const { provider, origin } = row.original;
            // Marketplaces que vêm via Takeat
            const marketplaces = ['ifood', '99food', 'neemo', 'keeta'];

            // Se for Takeat com origin de marketplace, mostra o marketplace com indicador
            if (
                provider === 'takeat' &&
                origin &&
                marketplaces.includes(origin)
            ) {
                return (
                    <div className="flex min-w-0 items-center gap-1">
                        <div className="shrink-0">
                            <ProviderBadge provider={origin} />
                        </div>
                        <div>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Badge
                                            variant="outline"
                                            className="h-4 shrink-0 px-1 text-[9px] font-normal whitespace-nowrap"
                                        >
                                            via TK
                                        </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Pedido integrado via Takeat</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                    </div>
                );
            }

            // Caso contrário, mostra o provider
            return <ProviderBadge provider={provider} />;
        },
    },
    {
        accessorKey: 'code',
        header: 'Pedido',
        cell: ({ row }) => (
            <div className="flex flex-col">
                {row.original.short_reference ? (
                    <>
                        <span className="font-medium">
                            #{row.original.short_reference}
                        </span>
                        <span className="text-[10px] text-muted-foreground lg:text-xs">
                            {row.original.id}
                        </span>
                    </>
                ) : (
                    <>
                        <span className="font-medium">{row.original.code}</span>
                        <span className="text-[10px] text-muted-foreground lg:text-xs">
                            {row.original.id}
                        </span>
                    </>
                )}
            </div>
        ),
    },
    {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
            <OrderStatusBadge status={row.original.status as OrderStatus} />
        ),
    },
    {
        accessorKey: 'total',
        meta: {
            label: 'Total do pedido',
        },
        header: () => (
            <span>
                <span className="hidden lg:inline">Total do pedido</span>
                <span className="lg:hidden">Total</span>
            </span>
        ),
        cell: ({ row }) => {
            const raw = row.original.raw;
            let amount = 0;

            // iFood: usar raw.total.orderAmount
            if (raw?.total?.orderAmount) {
                amount = parseFloat(String(raw.total.orderAmount)) || 0;
            }
            // Takeat: priorizar old_total_price (valor antes do desconto)
            else if (row.original.provider === 'takeat') {
                if (raw?.session?.old_total_price) {
                    amount =
                        parseFloat(String(raw.session.old_total_price)) || 0;
                } else if (raw?.session?.total_price) {
                    amount = parseFloat(String(raw.session.total_price)) || 0;
                } else {
                    amount = parseFloat(row.original.gross_total || '0') || 0;
                }
            }
            // Fallback: usar gross_total do banco
            else {
                amount = parseFloat(row.original.gross_total || '0') || 0;
            }

            const isCancelled = row.original.status === 'CANCELLED';

            return !isNaN(amount) && amount > 0 ? (
                <span
                    className={`${isCancelled ? 'text-muted-foreground line-through' : ''}`}
                >
                    {new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                    }).format(amount)}
                </span>
            ) : (
                <div className="text-right">
                    <span className="text-muted-foreground">--</span>
                </div>
            );
        },
    },
    {
        accessorKey: 'subtotal',
        meta: {
            label: 'Subtotal',
        },
        header: () => <div className="text-right">Subtotal</div>,
        cell: ({ row }) => {
            const isCancelled = row.original.status === 'CANCELLED';

            // IMPORTANTE: Usar a função calculateOrderSubtotal para garantir consistência
            const subtotal = calculateOrderSubtotal(row.original);

            return (
                <div className="text-right">
                    <span
                        className={`${isCancelled ? 'text-muted-foreground line-through' : ''}`}
                    >
                        {new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                        }).format(subtotal)}
                    </span>
                </div>
            );
        },
    },

    {
        accessorKey: 'cost',
        header: 'CMV',
        cell: ({ row }) => {
            const items = row.original.items || [];
            const raw = row.original.raw;
            const provider = row.original.provider;
            const isCancelled = row.original.status === 'CANCELLED';

            // Calcular CMV usando a função compartilhada
            const totalCost = calculateOrderCMV(items);

            // Calcular subtotal (mesma lógica da coluna Subtotal)
            let grossTotal =
                parseFloat(String(row.original.gross_total || '0')) || 0;

            if (provider === 'takeat') {
                if (raw?.session?.total_delivery_price) {
                    grossTotal =
                        parseFloat(String(raw.session.total_delivery_price)) ||
                        0;
                } else if (raw?.session?.total_price) {
                    grossTotal =
                        parseFloat(String(raw.session.total_price)) || 0;
                }
            }

            const deliveryFee =
                parseFloat(String(row.original.delivery_fee || '0')) || 0;

            let totalSubsidy = 0;
            if (provider === 'takeat') {
                const payments = raw?.session?.payments || [];
                totalSubsidy = payments.reduce((sum: number, payment: any) => {
                    const paymentName = (
                        payment.payment_method?.name || ''
                    ).toLowerCase();
                    const paymentKeyword = (
                        payment.payment_method?.keyword || ''
                    ).toLowerCase();
                    const isSubsidy =
                        paymentName.includes('subsid') ||
                        paymentName.includes('cupom') ||
                        paymentKeyword.includes('subsid') ||
                        paymentKeyword.includes('cupom');
                    return isSubsidy
                        ? sum + parseFloat(payment.payment_value || '0')
                        : sum;
                }, 0);
            }

            const totalCashback =
                parseFloat(String(row.original.cashback_total || '0')) || 0;

            let subtotal = grossTotal;
            const usedTotalDeliveryPrice =
                provider === 'takeat' &&
                Boolean(raw?.session?.total_delivery_price);

            const deliveryBy = raw?.session?.delivery_by?.toUpperCase() || '';
            const isMarketplaceDelivery = ['IFOOD', 'MARKETPLACE'].includes(
                deliveryBy,
            );
            const skipDeliveryFeeInSubtotal =
                isTakeatIfoodOrder(row.original) && isMarketplaceDelivery;

            if (!usedTotalDeliveryPrice) {
                subtotal += totalSubsidy;
                if (!skipDeliveryFeeInSubtotal) {
                    subtotal += deliveryFee;
                }
            } else if (skipDeliveryFeeInSubtotal && deliveryFee > 0) {
                subtotal -= deliveryFee;
            }

            subtotal -= totalCashback;

            const ifoodServiceFee = isTakeatIfoodOrder(row.original) ? 0.99 : 0;
            if (ifoodServiceFee > 0) {
                subtotal -= ifoodServiceFee;
            }

            // Calcular porcentagem do CMV sobre o subtotal
            const cmvPercentage =
                subtotal > 0 ? (totalCost / subtotal) * 100 : 0;

            return totalCost > 0 ? (
                <div className="flex items-center justify-end gap-2">
                    <span
                        className={`text-sm ${
                            isCancelled
                                ? 'text-muted-foreground line-through'
                                : ''
                        }`}
                    >
                        {new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                        }).format(totalCost)}
                    </span>
                    {subtotal > 0 && (
                        <Badge
                            variant="outline"
                            className="text-xs font-normal"
                        >
                            {cmvPercentage.toFixed(1)}%
                        </Badge>
                    )}
                </div>
            ) : (
                <div className="text-right">
                    <span className="text-muted-foreground">--</span>
                </div>
            );
        },
    },
    {
        accessorKey: 'tax',
        header: 'Impostos',
        cell: ({ row }) => {
            const order = row.original;
            const items = order.items || [];

            // IMPORTANTE: Calcular impostos seguindo a MESMA lógica do card financeiro
            // Impostos devem ser calculados sobre o SUBTOTAL, não sobre itens individuais

            // Calcular subtotal do pedido
            const subtotal = calculateOrderSubtotal(order);

            // Calcular impostos dos produtos baseado no subtotal
            // Agrupar itens por tax_category e calcular proporcionalmente ao subtotal
            const taxCategories = new Map<
                number,
                { rate: number; itemsTotal: number }
            >();
            let totalItemsPrice = 0;

            items.forEach((item) => {
                if (item.internal_product?.tax_category?.total_tax_rate) {
                    const quantity = item.qty || item.quantity || 0;
                    const unitPrice = item.unit_price || item.price || 0;
                    const itemTotal = quantity * unitPrice;
                    totalItemsPrice += itemTotal;

                    const taxCategoryId = item.internal_product.tax_category.id;
                    const existingCategory = taxCategories.get(taxCategoryId);

                    if (existingCategory) {
                        existingCategory.itemsTotal += itemTotal;
                    } else {
                        taxCategories.set(taxCategoryId, {
                            rate: item.internal_product.tax_category
                                .total_tax_rate,
                            itemsTotal: itemTotal,
                        });
                    }
                }
            });

            // Calcular impostos proporcionais ao subtotal
            let productTax = 0;
            taxCategories.forEach((category) => {
                // Proporção deste grupo de itens no total
                const proportion =
                    totalItemsPrice > 0
                        ? category.itemsTotal / totalItemsPrice
                        : 0;
                // Aplicar a taxa sobre a parte proporcional do subtotal
                const taxValue = (subtotal * proportion * category.rate) / 100;
                productTax += taxValue;
            });

            // Impostos adicionais (da categoria 'tax' em calculated_costs)
            // RECALCULAR valores percentuais baseado no Subtotal
            const calculatedCosts = order.calculated_costs;
            const additionalTaxes = calculatedCosts?.taxes || [];
            const totalAdditionalTax = additionalTaxes.reduce(
                (sum: number, tax: any) => {
                    if (tax.type === 'percentage') {
                        // Recalcular: subtotal * (value / 100)
                        const value = parseFloat(String(tax.value || '0')) || 0;
                        const calculated = (subtotal * value) / 100;
                        return sum + calculated;
                    }
                    // Se for valor fixo, usar calculated_value original
                    return sum + (tax.calculated_value || 0);
                },
                0,
            );

            // Total de impostos = impostos dos produtos + impostos adicionais
            const totalTax = productTax + totalAdditionalTax;

            const isCancelled = order.status === 'CANCELLED';

            return totalTax > 0 ? (
                <span
                    className={`text-sm ${
                        isCancelled ? 'text-muted-foreground line-through' : ''
                    }`}
                >
                    {new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                    }).format(totalTax)}
                </span>
            ) : (
                <div className="text-right">
                    <span className="text-muted-foreground">--</span>
                </div>
            );
        },
    },
    {
        accessorKey: 'total_costs',
        header: 'Custos',
        meta: {
            label: 'Custos',
        },
        cell: ({ row }) => {
            const order = row.original;
            const isCancelled = order.status === 'CANCELLED';

            // IMPORTANTE: Recalcular custos baseado no SUBTOTAL (mesma lógica do card financeiro)
            const subtotal = calculateOrderSubtotal(order);
            const calculatedCosts = order.calculated_costs;
            const costs = calculatedCosts?.costs || [];

            // Recalcular valores percentuais sobre o subtotal
            const totalCosts = costs.reduce((sum: number, cost: any) => {
                if (cost.type === 'percentage') {
                    const value = parseFloat(String(cost.value || '0')) || 0;
                    const calculated = (subtotal * value) / 100;
                    return sum + calculated;
                }
                return sum + (cost.calculated_value || 0);
            }, 0);

            return totalCosts > 0 ? (
                <div className="text-right">
                    <span
                        className={`text-sm ${
                            isCancelled
                                ? 'text-muted-foreground line-through'
                                : ''
                        }`}
                    >
                        {new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                        }).format(totalCosts)}
                    </span>
                </div>
            ) : (
                <div className="text-right">
                    <span className="text-muted-foreground">--</span>
                </div>
            );
        },
    },
    {
        accessorKey: 'total_commissions',
        header: () => (
            <span>
                <span className="hidden xl:inline">Comissões</span>
                <span className="xl:hidden">Comiss.</span>
            </span>
        ),
        meta: {
            label: 'Comissões',
        },
        cell: ({ row }) => {
            const order = row.original;
            const isCancelled = order.status === 'CANCELLED';

            // IMPORTANTE: Recalcular comissões baseado no SUBTOTAL (mesma lógica do card financeiro)
            const subtotal = calculateOrderSubtotal(order);
            const calculatedCosts = order.calculated_costs;
            const commissions = calculatedCosts?.commissions || [];

            // Recalcular valores percentuais sobre o subtotal
            const totalCommissions = commissions.reduce(
                (sum: number, comm: any) => {
                    if (comm.type === 'percentage') {
                        const value =
                            parseFloat(String(comm.value || '0')) || 0;
                        const calculated = (subtotal * value) / 100;
                        return sum + calculated;
                    }
                    return sum + (comm.calculated_value || 0);
                },
                0,
            );

            return totalCommissions > 0 ? (
                <div className="text-right">
                    <span
                        className={`text-sm ${
                            isCancelled
                                ? 'text-muted-foreground line-through'
                                : ''
                        }`}
                    >
                        {new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                        }).format(totalCommissions)}
                    </span>
                </div>
            ) : (
                <div className="text-right">
                    <span className="text-muted-foreground">--</span>
                </div>
            );
        },
    },
    {
        accessorKey: 'payment_fees',
        header: () => (
            <span>
                <span className="hidden xl:inline">Taxa Pgto</span>
                <span className="xl:hidden">Taxa Pg.</span>
            </span>
        ),
        meta: {
            label: 'Taxa Pgto',
        },
        cell: ({ row }) => {
            const order = row.original;
            const isCancelled = order.status === 'CANCELLED';

            // IMPORTANTE: Recalcular taxas de pagamento baseado no SUBTOTAL (mesma lógica do card financeiro)
            const subtotal = calculateOrderSubtotal(order);
            const calculatedCosts = order.calculated_costs;
            const paymentMethodFees = calculatedCosts?.payment_methods || [];

            // Recalcular valores percentuais sobre o subtotal
            const totalPaymentFee = paymentMethodFees.reduce(
                (sum: number, fee: any) => {
                    if (fee.type === 'percentage') {
                        const value = parseFloat(String(fee.value || '0')) || 0;
                        const calculated = (subtotal * value) / 100;
                        return sum + calculated;
                    }
                    return sum + (fee.calculated_value || 0);
                },
                0,
            );

            return totalPaymentFee > 0 ? (
                <div className="text-right">
                    <span
                        className={`text-sm ${
                            isCancelled
                                ? 'text-muted-foreground line-through'
                                : ''
                        }`}
                    >
                        {new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                        }).format(totalPaymentFee)}
                    </span>
                </div>
            ) : (
                <div className="text-right">
                    <span className="text-muted-foreground">--</span>
                </div>
            );
        },
    },
    {
        accessorKey: 'net_total',
        meta: {
            label: 'Total líquido',
        },
        header: () => (
            <span>
                <span className="hidden lg:inline">Total líquido</span>
                <span className="lg:hidden">Líquido</span>
            </span>
        ),
        cell: ({ row }) => {
            const order = row.original;
            const calculatedCosts = order.calculated_costs;
            const isCancelled = order.status === 'CANCELLED';

            // IMPORTANTE: Calcular net_revenue seguindo a MESMA lógica do card financeiro
            // Recalcular TODOS os valores percentuais sobre o subtotal
            const subtotal = calculateOrderSubtotal(order);
            const cmv = calculateOrderCMV(order.items || []);

            // Recalcular impostos dos produtos sobre o subtotal
            const items = order.items || [];
            const taxCategories = new Map<
                number,
                { rate: number; itemsTotal: number }
            >();
            let totalItemsPrice = 0;

            items.forEach((item) => {
                if (item.internal_product?.tax_category?.total_tax_rate) {
                    const quantity = item.qty || item.quantity || 0;
                    const unitPrice = item.unit_price || item.price || 0;
                    const itemTotal = quantity * unitPrice;
                    totalItemsPrice += itemTotal;

                    const taxCategoryId = item.internal_product.tax_category.id;
                    const existingCategory = taxCategories.get(taxCategoryId);

                    if (existingCategory) {
                        existingCategory.itemsTotal += itemTotal;
                    } else {
                        taxCategories.set(taxCategoryId, {
                            rate: item.internal_product.tax_category
                                .total_tax_rate,
                            itemsTotal: itemTotal,
                        });
                    }
                }
            });

            let productTax = 0;
            taxCategories.forEach((category) => {
                const proportion =
                    totalItemsPrice > 0
                        ? category.itemsTotal / totalItemsPrice
                        : 0;
                const taxValue = (subtotal * proportion * category.rate) / 100;
                productTax += taxValue;
            });

            // Impostos adicionais recalculados
            const additionalTaxes = calculatedCosts?.taxes || [];
            const totalAdditionalTax = additionalTaxes.reduce(
                (sum: number, tax: any) => {
                    if (tax.type === 'percentage') {
                        const value = parseFloat(String(tax.value || '0')) || 0;
                        return sum + (subtotal * value) / 100;
                    }
                    return sum + (tax.calculated_value || 0);
                },
                0,
            );

            const totalTax = productTax + totalAdditionalTax;

            // Custos recalculados
            const costs = calculatedCosts?.costs || [];
            const totalCosts = costs.reduce((sum: number, cost: any) => {
                if (cost.type === 'percentage') {
                    const value = parseFloat(String(cost.value || '0')) || 0;
                    return sum + (subtotal * value) / 100;
                }
                return sum + (cost.calculated_value || 0);
            }, 0);

            // Comissões recalculadas
            const commissions = calculatedCosts?.commissions || [];
            const totalCommissions = commissions.reduce(
                (sum: number, comm: any) => {
                    if (comm.type === 'percentage') {
                        const value =
                            parseFloat(String(comm.value || '0')) || 0;
                        return sum + (subtotal * value) / 100;
                    }
                    return sum + (comm.calculated_value || 0);
                },
                0,
            );

            // Taxas de pagamento recalculadas
            const paymentMethodFees = calculatedCosts?.payment_methods || [];
            const totalPaymentMethodFee = paymentMethodFees.reduce(
                (sum: number, fee: any) => {
                    if (fee.type === 'percentage') {
                        const value = parseFloat(String(fee.value || '0')) || 0;
                        return sum + (subtotal * value) / 100;
                    }
                    return sum + (fee.calculated_value || 0);
                },
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

            return (
                <span
                    className={`${
                        isCancelled
                            ? 'font-semibold text-muted-foreground line-through'
                            : 'font-semibold'
                    } text-end`}
                >
                    {new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                    }).format(netRevenue)}
                </span>
            );
        },
    },
    {
        id: 'margin',
        header: 'Margem',
        cell: ({ row, table }) => {
            const order = row.original;
            const status = order.status;
            const calculatedCosts = order.calculated_costs;

            // Calcular subtotal seguindo a MESMA lógica do card financeiro
            const subtotal = calculateOrderSubtotal(order);

            // Calcular net_revenue manualmente recalculando os valores percentuais baseados no subtotal
            const cmv = calculateOrderCMV(order.items || []);

            // IMPORTANTE: Recalcular impostos baseado no subtotal (mesma lógica da coluna tax e card financeiro)
            const items = order.items || [];

            // Impostos dos produtos
            const taxCategories = new Map<
                number,
                { rate: number; itemsTotal: number }
            >();
            let totalItemsPrice = 0;
            items.forEach((item) => {
                if (item.internal_product?.tax_category?.total_tax_rate) {
                    const quantity = item.qty || item.quantity || 0;
                    const unitPrice = item.unit_price || item.price || 0;
                    const itemTotal = quantity * unitPrice;
                    totalItemsPrice += itemTotal;

                    const taxCategoryId = item.internal_product.tax_category.id;
                    const existingCategory = taxCategories.get(taxCategoryId);

                    if (existingCategory) {
                        existingCategory.itemsTotal += itemTotal;
                    } else {
                        taxCategories.set(taxCategoryId, {
                            rate: item.internal_product.tax_category
                                .total_tax_rate,
                            itemsTotal: itemTotal,
                        });
                    }
                }
            });

            let productTax = 0;
            taxCategories.forEach((category) => {
                const proportion =
                    totalItemsPrice > 0
                        ? category.itemsTotal / totalItemsPrice
                        : 0;
                const taxValue = (subtotal * proportion * category.rate) / 100;
                productTax += taxValue;
            });

            // Impostos adicionais (recalcular percentuais)
            const additionalTaxes = calculatedCosts?.taxes || [];
            const totalAdditionalTax = additionalTaxes.reduce(
                (sum: number, tax: any) => {
                    if (tax.type === 'percentage') {
                        const value = parseFloat(String(tax.value || '0')) || 0;
                        return sum + (subtotal * value) / 100;
                    }
                    return sum + (tax.calculated_value || 0);
                },
                0,
            );

            const totalTax = productTax + totalAdditionalTax;

            // IMPORTANTE: Recalcular custos baseado no subtotal
            const costs = calculatedCosts?.costs || [];
            const totalCosts = costs.reduce((sum: number, cost: any) => {
                if (cost.type === 'percentage') {
                    const value = parseFloat(String(cost.value || '0')) || 0;
                    return sum + (subtotal * value) / 100;
                }
                return sum + (cost.calculated_value || 0);
            }, 0);

            // IMPORTANTE: Recalcular comissões baseado no subtotal
            const commissions = calculatedCosts?.commissions || [];
            const totalCommissions = commissions.reduce(
                (sum: number, comm: any) => {
                    if (comm.type === 'percentage') {
                        const value =
                            parseFloat(String(comm.value || '0')) || 0;
                        return sum + (subtotal * value) / 100;
                    }
                    return sum + (comm.calculated_value || 0);
                },
                0,
            );

            // IMPORTANTE: Recalcular taxas de pagamento baseado no subtotal
            const paymentMethodFees = calculatedCosts?.payment_methods || [];
            const totalPaymentMethodFee = paymentMethodFees.reduce(
                (sum: number, fee: any) => {
                    if (fee.type === 'percentage') {
                        const value = parseFloat(String(fee.value || '0')) || 0;
                        return sum + (subtotal * value) / 100;
                    }
                    return sum + (fee.calculated_value || 0);
                },
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

            // Pega marginSettings do table.options.meta
            const marginSettings = (
                table.options.meta as {
                    marginSettings?: {
                        margin_excellent: number;
                        margin_good_min: number;
                        margin_good_max: number;
                        margin_poor: number;
                    };
                }
            )?.marginSettings;

            // Cancelado -> badge secundário
            if (status === 'CANCELLED') {
                return (
                    <Badge
                        variant="secondary"
                        className="text-muted-foreground"
                    >
                        -%
                    </Badge>
                );
            }

            // Verificar se tem valor válido
            if (!subtotal || subtotal <= 0) {
                return (
                    <div className="text-right">
                        <span className="text-muted-foreground">--</span>
                    </div>
                );
            }

            // Margem: tratar caso especial de subtotal = 0
            if (subtotal <= 0) {
                // Se há prejuízo (custos sem receita), mostrar indicador vermelho
                if (netRevenue < 0) {
                    return (
                        <Badge variant="destructive" className="font-semibold">
                            PREJUÍZO
                        </Badge>
                    );
                }
                // Se não há receita nem custos, mostrar neutro
                return (
                    <Badge variant="secondary" className="text-gray-500">
                        --%
                    </Badge>
                );
            }

            // Margem = (Receita Líquida / Subtotal) * 100
            // Mesma fórmula do card financeiro
            const margin = (netRevenue / subtotal) * 100;

            // Determinar variante baseada na margem (permitir valores negativos)
            let variant: 'default' | 'warning' | 'destructive' = 'default';

            if (marginSettings) {
                if (margin < 0 || margin <= marginSettings.margin_poor) {
                    variant = 'destructive'; // Vermelho - margem negativa ou ruim
                } else if (margin >= marginSettings.margin_excellent) {
                    variant = 'default'; // Verde - margem excelente
                } else {
                    variant = 'warning'; // Laranja - margem boa
                }
            } else {
                // Fallback para cores antigas se não houver configurações
                variant = margin > 0 ? 'default' : 'destructive';
            }

            return <Badge variant={variant}>{margin.toFixed(1)}%</Badge>;
        },
    },
    {
        id: 'actions',
        header: 'Ações',
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => {
            const order = row.original;
            // Extrai orderType do raw JSON
            const orderType = order.raw?.orderType || 'DELIVERY';
            // Passe o objeto handshakeDispute completo, sem filtrar campos
            const handshakeDispute = order.raw?.handshakeDispute ?? null;

            return (
                <OrderActionsCell
                    orderId={order.id}
                    orderStatus={order.status}
                    orderType={orderType}
                    provider={order.provider}
                    handshakeDispute={handshakeDispute}
                />
            );
        },
    },
    {
        id: 'expand',
        header: '', // sem header
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => (
            <Button
                variant="ghost"
                size="icon"
                className={`h-6 w-6 p-0 transition-transform ${
                    row.getIsExpanded() ? 'rotate-180' : ''
                }`}
                onClick={() => row.toggleExpanded()}
            >
                <IconChevronDown className="h-4 w-4" />
            </Button>
        ),
    },
];
