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
    calculateNetRevenue,
    calculateOrderCMV,
} from '@/lib/order-calculations';
import { IconChevronDown } from '@tabler/icons-react';
import { ColumnDef } from '@tanstack/react-table';
import { endOfDay, startOfDay } from 'date-fns';
import { Badge } from '../ui/badge';

// Tipagem vinda do backend
export type OrderItemMapping = {
    id: number;
    order_item_id: number;
    internal_product_id: number;
    quantity: number;
    mapping_type: 'main' | 'option' | 'addon';
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
                        {date ? date.toLocaleTimeString('pt-BR') : '--:--'}
                    </span>
                    <span className="text-[10px] text-muted-foreground lg:text-xs">
                        {date ? date.toLocaleDateString('pt-BR') : '--/--/----'}
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
        header: 'Total do pedido',
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
        accessorKey: 'cost',
        header: 'CMV',
        cell: ({ row }) => {
            const items = row.original.items || [];

            // Calcular CMV usando a função compartilhada
            const totalCost = calculateOrderCMV(items);

            const isCancelled = row.original.status === 'CANCELLED';

            return totalCost > 0 ? (
                <span
                    className={`text-sm ${
                        isCancelled ? 'text-muted-foreground line-through' : ''
                    }`}
                >
                    {new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                    }).format(totalCost)}
                </span>
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
            const items = row.original.items || [];

            // Calcular impostos dos produtos
            const productTax = items.reduce((sum, item) => {
                if (
                    item.internal_product?.tax_category?.total_tax_rate !==
                        undefined &&
                    item.internal_product?.tax_category?.total_tax_rate !== null
                ) {
                    const quantity = item.qty || item.quantity || 0;
                    const unitPrice = item.unit_price || item.price || 0;
                    const itemTotal = quantity * unitPrice;
                    const taxRate =
                        item.internal_product.tax_category.total_tax_rate / 100;
                    return sum + itemTotal * taxRate;
                }
                return sum;
            }, 0);

            // Impostos adicionais (da categoria 'tax' em calculated_costs)
            const calculatedCosts = row.original.calculated_costs;
            const additionalTaxes = calculatedCosts?.taxes || [];
            const totalAdditionalTax = additionalTaxes.reduce(
                (sum: number, tax: any) => sum + (tax.calculated_value || 0),
                0,
            );

            // Total de impostos = impostos dos produtos + impostos adicionais
            const totalTax = productTax + totalAdditionalTax;

            const isCancelled = row.original.status === 'CANCELLED';

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
            const totalCosts = row.original.total_costs;
            const isCancelled = row.original.status === 'CANCELLED';

            if (totalCosts === null || totalCosts === undefined) {
                return (
                    <div className="text-right">
                        <span className="text-muted-foreground">--</span>
                    </div>
                );
            }

            const value =
                typeof totalCosts === 'string'
                    ? parseFloat(totalCosts)
                    : totalCosts;

            return value > 0 ? (
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
                        }).format(value)}
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
        header: 'Comissões',
        meta: {
            label: 'Comissões',
        },
        cell: ({ row }) => {
            const totalCommissions = row.original.total_commissions;
            const isCancelled = row.original.status === 'CANCELLED';

            if (totalCommissions === null || totalCommissions === undefined) {
                return (
                    <div className="text-right">
                        <span className="text-muted-foreground">--</span>
                    </div>
                );
            }

            const value =
                typeof totalCommissions === 'string'
                    ? parseFloat(totalCommissions)
                    : totalCommissions;

            return value > 0 ? (
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
                        }).format(value)}
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
        header: 'Taxa Pgto',
        meta: {
            label: 'Taxa Pgto',
        },
        cell: ({ row }) => {
            const calculatedCosts = row.original.calculated_costs;
            const paymentMethodFees = calculatedCosts?.payment_methods || [];
            const totalPaymentFee = paymentMethodFees.reduce(
                (sum: number, fee: any) => sum + (fee.calculated_value || 0),
                0,
            );

            const isCancelled = row.original.status === 'CANCELLED';

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
        header: 'Total líquido',
        cell: ({ row }) => {
            // Usar o mesmo cálculo do card de detalhamento financeiro
            const netRevenue = calculateNetRevenue(row.original);
            const isCancelled = row.original.status === 'CANCELLED';

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
            const items = row.original.items || [];
            const raw = row.original.raw;
            const status = row.original.status;
            const provider = row.original.provider;

            // Usar a mesma lógica do order-financial-card
            let orderTotal =
                parseFloat(String(row.original.gross_total || '0')) || 0;

            if (provider === 'takeat') {
                // Para Takeat: usar old_total_price ou total_price (valor dos itens)
                if (raw?.session?.old_total_price) {
                    orderTotal =
                        parseFloat(String(raw.session.old_total_price)) || 0;
                } else if (raw?.session?.total_price) {
                    orderTotal =
                        parseFloat(String(raw.session.total_price)) || 0;
                }
            } else if (raw?.total?.orderAmount) {
                // Para iFood: usar orderAmount se disponível
                orderTotal = parseFloat(String(raw.total.orderAmount)) || 0;
            }

            // grossTotal para cálculo do subtotal (usado na margem)
            let grossTotal =
                parseFloat(String(row.original.gross_total || '0')) || 0;

            if (provider === 'takeat') {
                // Prioridade: total_delivery_price > total_price
                if (raw?.session?.total_delivery_price) {
                    grossTotal =
                        parseFloat(String(raw.session.total_delivery_price)) ||
                        0;
                } else if (raw?.session?.total_price) {
                    grossTotal =
                        parseFloat(String(raw.session.total_price)) || 0;
                }
            }

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

            // Verificar se tem valor válido (orderTotal ou grossTotal)
            if (
                (!orderTotal || orderTotal <= 0) &&
                (!grossTotal || grossTotal <= 0)
            )
                return (
                    <div className="text-right">
                        <span className="text-muted-foreground">--</span>
                    </div>
                );

            // Calcular custo total dos produtos (CMV)
            const totalCost = calculateOrderCMV(items);

            // Calcular impostos dos produtos
            const productTax = items.reduce((sum, item) => {
                if (
                    item.internal_product?.tax_category?.total_tax_rate !==
                        undefined &&
                    item.internal_product?.tax_category?.total_tax_rate !== null
                ) {
                    const quantity = item.qty || item.quantity || 0;
                    const unitPrice = item.unit_price || item.price || 0;
                    const itemTotal = quantity * unitPrice;
                    const taxRate =
                        item.internal_product.tax_category.total_tax_rate / 100;
                    return sum + itemTotal * taxRate;
                }
                return sum;
            }, 0);

            // Impostos adicionais (da categoria 'tax' em calculated_costs)
            const calculatedCosts = row.original.calculated_costs;
            const additionalTaxes = calculatedCosts?.taxes || [];
            const totalAdditionalTax = additionalTaxes.reduce(
                (sum: number, tax: any) => sum + (tax.calculated_value || 0),
                0,
            );

            // Total de impostos = impostos dos produtos + impostos adicionais
            const totalTax = productTax + totalAdditionalTax;

            // Adicionar custos e comissões da página "Custos e Comissões"
            const extraCosts =
                typeof row.original.total_costs === 'string'
                    ? parseFloat(row.original.total_costs)
                    : (row.original.total_costs ?? 0);
            const commissions =
                typeof row.original.total_commissions === 'string'
                    ? parseFloat(row.original.total_commissions)
                    : (row.original.total_commissions ?? 0);

            // Adicionar taxas de pagamento (payment_methods)
            const paymentMethodFees = calculatedCosts?.payment_methods || [];
            const totalPaymentMethodFee = paymentMethodFees.reduce(
                (sum: number, fee: any) => sum + (fee.calculated_value || 0),
                0,
            );

            // Adicionar delivery_fee à base de cálculo (para Takeat)
            const deliveryFee =
                typeof row.original.delivery_fee === 'string'
                    ? parseFloat(row.original.delivery_fee)
                    : (row.original.delivery_fee ?? 0);

            // Calcular subsídio dos pagamentos (apenas para Takeat)
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

            // Base de cálculo para margem (mesmo cálculo do card)
            // Usar grossTotal (que tem total_delivery_price) ou orderTotal como fallback
            let subtotal = grossTotal > 0 ? grossTotal : orderTotal;

            // Para Takeat: verificar se usou total_delivery_price
            // Se for, NÃO precisa somar nada (já inclui delivery e subsídio)
            // Se não for, precisa somar subsídio e delivery
            const usedTotalDeliveryPrice =
                provider === 'takeat' && raw?.session?.total_delivery_price;

            if (!usedTotalDeliveryPrice) {
                subtotal += totalSubsidy + deliveryFee;
            }

            const netTotal =
                subtotal -
                totalCost -
                totalTax -
                extraCosts -
                commissions -
                totalPaymentMethodFee;
            const margin = (netTotal / subtotal) * 100;

            if (margin === 0) {
                return (
                    <Badge variant="secondary" className="text-gray-500">
                        0%
                    </Badge>
                );
            }

            // Usa configurações de margem se disponíveis, senão usa valores padrão
            let variant: 'default' | 'warning' | 'destructive' = 'default';

            if (marginSettings) {
                if (margin <= marginSettings.margin_poor) {
                    variant = 'destructive'; // Vermelho - margem ruim
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
