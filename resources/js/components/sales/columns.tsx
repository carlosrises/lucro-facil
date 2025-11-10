import {
    SaleStatus,
    SaleStatusBadge,
} from '@/components/sales/sale-status-badge';
import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { IconChevronDown } from '@tabler/icons-react';
import { ColumnDef } from '@tanstack/react-table';
import { Badge } from '../ui/badge';

// Tipos para dados financeiros do Financial API v3.0
export type BillingEntry = {
    value: number;
    type?: 'COMMISSION' | 'FEE' | 'TRANSFER' | string;
    name?: string;
    description?: string;
};

export type Sale = {
    id: number;
    sale_id: string;
    type: string | null;
    category: string | null;
    status: string;
    channel: string | null;
    sale_date: string | null;
    concluded_date: string | null;
    expected_payment_date: string | null;

    // Valores financeiros
    bag_value: number;
    delivery_fee: number;
    service_fee: number;
    gross_value: number;
    discount_value: number;
    net_value: number;

    // Informações de pagamento
    payment_method: string | null;
    payment_brand: string | null;
    payment_value: number;
    payment_liability: string | null;

    // Valores extraídos
    commissions: number;
    fees: number;
    transfers: number;
    sale_balance: number;

    // Detalhes de faturamento
    billing_entries: BillingEntry[];
};

export const columns: ColumnDef<Sale>[] = [
    {
        id: 'status_indicator',
        header: '',
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => {
            const { status, sale_balance } = row.original;

            let color = 'bg-blue-500';
            let label = 'Processando';

            if (status === 'CANCELLED') {
                color = 'bg-red-500';
                label = 'Cancelado';
            } else if (status === 'CONCLUDED') {
                color = sale_balance > 0 ? 'bg-green-500' : 'bg-yellow-500';
                label =
                    sale_balance > 0
                        ? 'Concluído com saldo'
                        : 'Concluído sem saldo';
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
        accessorKey: 'sale_date',
        header: 'Data da Venda',
        cell: ({ row }) => {
            const date = row.original.sale_date
                ? new Date(row.original.sale_date)
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
    },
    {
        accessorKey: 'channel',
        header: 'Canal',
        cell: ({ row }) => (
            <Badge variant="outline">{row.original.channel || 'N/A'}</Badge>
        ),
    },
    {
        accessorKey: 'sale_id',
        header: 'ID da Venda',
        cell: ({ row }) => (
            <div className="flex flex-col">
                <span className="font-medium">{row.original.sale_id}</span>
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
            <SaleStatusBadge status={row.original.status as SaleStatus} />
        ),
    },
    {
        accessorKey: 'gross_value',
        header: 'Total do Pedido',
        cell: ({ row }) => {
            const isCancelled = row.original.status === 'CANCELLED';
            // Use the backend-provided payment_value as the authoritative Total do Pedido
            const paymentValue = Number(row.original.payment_value ?? 0);
            return (
                <span
                    className={`${isCancelled ? 'text-muted-foreground line-through' : ''}`}
                >
                    {new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                    }).format(paymentValue)}
                </span>
            );
        },
    },
    {
        accessorKey: 'commissions',
        header: 'Comissões',
        cell: ({ row }) => {
            const isCancelled = row.original.status === 'CANCELLED';
            return (
                <span
                    className={`text-red-600 ${isCancelled ? 'text-muted-foreground line-through' : ''}`}
                >
                    -{' '}
                    {new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                    }).format(row.original.commissions)}
                </span>
            );
        },
    },
    {
        accessorKey: 'fees',
        header: 'Taxas',
        cell: ({ row }) => {
            const isCancelled = row.original.status === 'CANCELLED';
            return (
                <span
                    className={`text-red-600 ${isCancelled ? 'text-muted-foreground line-through' : ''}`}
                >
                    -{' '}
                    {new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                    }).format(row.original.fees)}
                </span>
            );
        },
    },
    {
        accessorKey: 'sale_balance',
        header: 'Saldo da Venda',
        cell: ({ row }) => {
            const isCancelled = row.original.status === 'CANCELLED';
            const balance = row.original.sale_balance;
            return (
                <span
                    className={`font-semibold ${
                        isCancelled
                            ? 'text-muted-foreground line-through'
                            : balance > 0
                              ? 'text-green-600'
                              : 'text-gray-600'
                    }`}
                >
                    {new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                    }).format(balance)}
                </span>
            );
        },
    },
    {
        accessorKey: 'expected_payment_date',
        header: 'Previsão de Pagamento',
        cell: ({ row }) => {
            const date = row.original.expected_payment_date
                ? new Date(row.original.expected_payment_date)
                : null;

            return (
                <span className="text-sm">
                    {date ? date.toLocaleDateString('pt-BR') : '--/--/----'}
                </span>
            );
        },
    },
    {
        id: 'expand',
        header: '',
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
