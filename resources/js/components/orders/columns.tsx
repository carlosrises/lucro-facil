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
import { IconChevronDown } from '@tabler/icons-react';
import { ColumnDef } from '@tanstack/react-table';
import { endOfDay, startOfDay } from 'date-fns';
import { Badge } from '../ui/badge';

// Tipagem vinda do backend
export type OrderItem = {
    id: number;
    sku?: string;
    name: string;
    quantity: number;
    qty?: number;
    price: number;
    unit_price?: number;
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

export type Order = {
    id: number;
    code: string;
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
    total_costs?: number | string | null;
    total_commissions?: number | string | null;
    net_revenue?: number | string | null;
    costs_calculated_at?: string | null;
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

            let color = 'bg-yellow-500';
            let label = 'Não faturado';

            if (status === 'CANCELLED') {
                color = 'bg-red-500';
                label = 'Cancelado';
            } else if (orderTotal > 0) {
                // Calcular custo total
                const totalCost = items.reduce((sum, item) => {
                    if (item.internal_product?.unit_cost) {
                        const quantity = item.qty || item.quantity || 0;
                        const unitCost = parseFloat(
                            item.internal_product.unit_cost,
                        );
                        return sum + quantity * unitCost;
                    }
                    return sum;
                }, 0);

                // Calcular impostos totais
                const totalTax = items.reduce((sum, item) => {
                    if (
                        item.internal_product?.tax_category?.total_tax_rate !==
                            undefined &&
                        item.internal_product?.tax_category?.total_tax_rate !==
                            null
                    ) {
                        const quantity = item.qty || item.quantity || 0;
                        const unitPrice = item.unit_price || item.price || 0;
                        const itemTotal = quantity * unitPrice;
                        const taxRate =
                            item.internal_product.tax_category.total_tax_rate /
                            100;
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
                    <div className="flex items-center gap-1.5">
                        <ProviderBadge provider={origin} />
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Badge
                                        variant="outline"
                                        className="h-5 px-1.5 text-[10px] font-normal"
                                    >
                                        via Takeat
                                    </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Pedido integrado via Takeat</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
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
                <span className="font-medium">{row.original.code}</span>
                <span className="text-[10px] text-muted-foreground lg:text-xs">
                    #{row.original.id}
                </span>
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
            // iFood: raw.total.orderAmount
            // Takeat: gross_total do banco
            const amount =
                raw?.total?.orderAmount ??
                parseFloat(row.original.gross_total || '0');
            const isCancelled = row.original.status === 'CANCELLED';

            return amount > 0 ? (
                <span
                    className={`${isCancelled ? 'text-muted-foreground line-through' : ''}`}
                >
                    {new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                    }).format(amount)}
                </span>
            ) : (
                <span className="text-muted-foreground">--</span>
            );
        },
    },

    {
        accessorKey: 'cost',
        header: 'Custo do Pedido',
        cell: ({ row }) => {
            const items = row.original.items || [];

            // Calcular soma dos custos dos produtos associados
            const totalCost = items.reduce((sum, item) => {
                if (item.internal_product?.unit_cost) {
                    const quantity = item.qty || item.quantity || 0;
                    const unitCost = parseFloat(
                        item.internal_product.unit_cost,
                    );
                    return sum + quantity * unitCost;
                }
                return sum;
            }, 0);

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
                <span className="text-muted-foreground">--</span>
            );
        },
    },
    {
        accessorKey: 'tax',
        header: 'Imposto',
        cell: ({ row }) => {
            const items = row.original.items || [];

            // Calcular impostos baseado nas categorias fiscais dos produtos
            const totalTax = items.reduce((sum, item) => {
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
                <span className="text-muted-foreground">--</span>
            );
        },
    },
    {
        accessorKey: 'extra_cost',
        header: 'Custo extra',
        cell: ({ row }) =>
            row.original.extra_cost !== null &&
            row.original.extra_cost !== undefined ? (
                <span
                    className={`text-sm ${
                        row.original.status === 'CANCELLED'
                            ? 'text-muted-foreground line-through'
                            : ''
                    }`}
                >
                    {new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                    }).format(row.original.extra_cost)}
                </span>
            ) : (
                <span className="text-muted-foreground">--</span>
            ),
    },
    {
        accessorKey: 'total_costs',
        header: 'Custos',
        cell: ({ row }) => {
            const totalCosts = row.original.total_costs;
            const isCancelled = row.original.status === 'CANCELLED';

            if (totalCosts === null || totalCosts === undefined) {
                return <span className="text-muted-foreground">--</span>;
            }

            const value =
                typeof totalCosts === 'string'
                    ? parseFloat(totalCosts)
                    : totalCosts;

            return (
                <span
                    className={`text-sm ${
                        isCancelled ? 'text-muted-foreground line-through' : ''
                    }`}
                >
                    {new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                    }).format(value)}
                </span>
            );
        },
    },
    {
        accessorKey: 'total_commissions',
        header: 'Comissões',
        cell: ({ row }) => {
            const totalCommissions = row.original.total_commissions;
            const isCancelled = row.original.status === 'CANCELLED';

            if (totalCommissions === null || totalCommissions === undefined) {
                return <span className="text-muted-foreground">--</span>;
            }

            const value =
                typeof totalCommissions === 'string'
                    ? parseFloat(totalCommissions)
                    : totalCommissions;

            return (
                <span
                    className={`text-sm ${
                        isCancelled ? 'text-muted-foreground line-through' : ''
                    }`}
                >
                    {new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                    }).format(value)}
                </span>
            );
        },
    },
    {
        accessorKey: 'net_total',
        header: 'Total líquido',
        cell: ({ row }) => {
            const items = row.original.items || [];
            const raw = row.original.raw;
            const orderTotal = raw?.total?.orderAmount ?? 0;

            // Calcular custo total dos produtos
            const totalCost = items.reduce((sum, item) => {
                if (item.internal_product?.unit_cost) {
                    const quantity = item.qty || item.quantity || 0;
                    const unitCost = parseFloat(
                        item.internal_product.unit_cost,
                    );
                    return sum + quantity * unitCost;
                }
                return sum;
            }, 0);

            // Calcular impostos totais
            const totalTax = items.reduce((sum, item) => {
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

            // Adicionar custos e comissões da página "Custos e Comissões"
            const extraCosts =
                typeof row.original.total_costs === 'string'
                    ? parseFloat(row.original.total_costs)
                    : (row.original.total_costs ?? 0);
            const commissions =
                typeof row.original.total_commissions === 'string'
                    ? parseFloat(row.original.total_commissions)
                    : (row.original.total_commissions ?? 0);

            const netTotal =
                orderTotal - totalCost - totalTax - extraCosts - commissions;
            const isCancelled = row.original.status === 'CANCELLED';

            return orderTotal > 0 ? (
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
                    }).format(netTotal)}
                </span>
            ) : (
                <span className="text-muted-foreground">--</span>
            );
        },
    },
    {
        id: 'margin',
        header: 'Margem',
        cell: ({ row, table }) => {
            const items = row.original.items || [];
            const raw = row.original.raw;
            const orderTotal = raw?.total?.orderAmount ?? 0;
            const status = row.original.status;

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

            if (!orderTotal || orderTotal <= 0)
                return <span className="text-muted-foreground">--</span>;

            // Calcular custo total dos produtos
            const totalCost = items.reduce((sum, item) => {
                if (item.internal_product?.unit_cost) {
                    const quantity = item.qty || item.quantity || 0;
                    const unitCost = parseFloat(
                        item.internal_product.unit_cost,
                    );
                    return sum + quantity * unitCost;
                }
                return sum;
            }, 0);

            // Calcular impostos totais
            const totalTax = items.reduce((sum, item) => {
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

            // Adicionar custos e comissões da página "Custos e Comissões"
            const extraCosts =
                typeof row.original.total_costs === 'string'
                    ? parseFloat(row.original.total_costs)
                    : (row.original.total_costs ?? 0);
            const commissions =
                typeof row.original.total_commissions === 'string'
                    ? parseFloat(row.original.total_commissions)
                    : (row.original.total_commissions ?? 0);

            const netTotal =
                orderTotal - totalCost - totalTax - extraCosts - commissions;
            const margin = (netTotal / orderTotal) * 100;

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
