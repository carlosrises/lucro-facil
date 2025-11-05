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
    name: string;
    quantity: number;
    price: number;
};

export type Order = {
    id: number;
    code: string;
    status: string;
    provider: string;
    placed_at: string | null;
    subtotal?: number | 0;
    fee?: number | 0;
    total?: number | 0;
    cost?: number | 0;
    tax?: number | 0;
    extra_cost?: number | 0;
    net_total?: number | 0;
    items?: OrderItem[];
    raw: any;
};

export const columns: ColumnDef<Order>[] = [
    {
        id: 'invoiced',
        header: '',
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => {
            const {
                status,
                total = 0,
                cost = 0,
                tax = 0,
                extra_cost = 0,
            } = row.original;

            let color = 'bg-yellow-500';
            let label = 'Não faturado';

            if (status === 'CANCELLED') {
                color = 'bg-red-500';
                label = 'Cancelado';
            } else if (total > 0) {
                const profit = total - (cost + tax + extra_cost);
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
        cell: ({ row }) => <ProviderBadge provider={row.original.provider} />,
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
            const amount = raw?.total?.orderAmount ?? null;
            const isCancelled = row.original.status === 'CANCELLED';

            return amount !== null ? (
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
        cell: ({ row }) =>
            row.original.cost !== null && row.original.cost !== undefined ? (
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
                    }).format(row.original.cost)}
                </span>
            ) : (
                <span className="text-muted-foreground">--</span>
            ),
    },
    {
        accessorKey: 'tax',
        header: 'Imposto',
        cell: ({ row }) =>
            row.original.tax !== null && row.original.tax !== undefined ? (
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
                    }).format(row.original.tax)}
                </span>
            ) : (
                <span className="text-muted-foreground">--</span>
            ),
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
        accessorKey: 'net_total',
        header: 'Total líquido',
        cell: ({ row }) =>
            row.original.net_total !== null &&
            row.original.net_total !== undefined ? (
                <span
                    className={`${
                        row.original.status === 'CANCELLED'
                            ? 'font-semibold text-muted-foreground line-through'
                            : 'font-semibold'
                    } text-end`}
                >
                    {new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                    }).format(row.original.net_total)}
                </span>
            ) : (
                <span className="text-muted-foreground">--</span>
            ),
    },
    {
        id: 'margin',
        header: 'Margem',
        cell: ({ row }) => {
            const {
                total,
                cost = 0,
                tax = 0,
                extra_cost = 0,
                status,
            } = row.original;

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

            if (!total || total <= 0)
                return <span className="text-muted-foreground">--</span>;

            const profit = total - (cost + tax + extra_cost);
            const margin = (profit / total) * 100;

            if (margin === 0) {
                return (
                    <Badge variant="secondary" className="text-gray-500">
                        0%
                    </Badge>
                );
            }

            return (
                <Badge
                    className={
                        margin > 0
                            ? 'bg-green-500 text-white'
                            : 'bg-red-500 text-white'
                    }
                >
                    {margin.toFixed(1)}%
                </Badge>
            );
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

            return (
                <OrderActionsCell
                    orderId={order.id}
                    orderStatus={order.status}
                    orderType={orderType}
                    provider={order.provider}
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
