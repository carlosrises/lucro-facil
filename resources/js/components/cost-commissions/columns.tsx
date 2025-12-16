import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';

declare global {
    function route(name: string, params?: Record<string, any>): string;
}

export type CostCommission = {
    id: number;
    name: string;
    category: 'cost' | 'commission';
    provider: string | null;
    type: 'percentage' | 'fixed';
    value: string;
    applies_to:
        | 'all_orders'
        | 'delivery_only'
        | 'pickup_only'
        | 'payment_method'
        | 'custom';
    payment_type?: 'all' | 'online' | 'offline';
    condition_value: string | null;
    condition_values?: string[] | null;
    affects_revenue_base: boolean;
    enters_tax_base: boolean;
    reduces_revenue_base: boolean;
    active: boolean;
    created_at: string;
};

export const columns = (
    onEdit: (item: CostCommission) => void,
    onDelete: (item: CostCommission) => void,
    onToggle: (item: CostCommission) => void,
): ColumnDef<CostCommission>[] => [
    {
        id: 'select',
        header: ({ table }) => (
            <Checkbox
                checked={
                    table.getIsAllPageRowsSelected() ||
                    (table.getIsSomePageRowsSelected() && 'indeterminate')
                }
                onCheckedChange={(value) =>
                    table.toggleAllPageRowsSelected(!!value)
                }
                aria-label="Selecionar todos"
            />
        ),
        cell: ({ row }) => (
            <Checkbox
                checked={row.getIsSelected()}
                onCheckedChange={(value) => row.toggleSelected(!!value)}
                aria-label="Selecionar linha"
            />
        ),
        enableSorting: false,
        enableHiding: false,
    },
    {
        accessorKey: 'name',
        header: 'Nome',
        cell: ({ row }) => (
            <div className="font-medium">{row.getValue('name')}</div>
        ),
    },
    {
        accessorKey: 'provider',
        header: 'Marketplace',
        cell: ({ row }) => {
            const provider = row.getValue('provider') as string | null;
            if (!provider) {
                return <Badge variant="outline">Todos</Badge>;
            }
            const labels: Record<string, string> = {
                ifood: 'iFood',
                rappi: 'Rappi',
                uber_eats: 'Uber Eats',
            };
            return <Badge>{labels[provider] || provider}</Badge>;
        },
    },
    {
        accessorKey: 'applies_to',
        header: 'Aplica-se a',
        cell: ({ row }) => {
            const appliesTo = row.getValue('applies_to') as string;
            const labels: Record<string, string> = {
                all_orders: 'Todos os pedidos',
                delivery_only: 'Apenas Delivery',
                pickup_only: 'Apenas Retirada',
                payment_method: 'Método de pagamento',
                custom: 'Personalizado',
            };
            return (
                <span className="text-sm">
                    {labels[appliesTo] || appliesTo}
                </span>
            );
        },
    },
    {
        accessorKey: 'type',
        header: 'Tipo',
        cell: ({ row }) => {
            const type = row.getValue('type') as string;
            return (
                <Badge
                    variant={type === 'percentage' ? 'default' : 'secondary'}
                >
                    {type === 'percentage' ? 'Percentual %' : 'Fixo R$'}
                </Badge>
            );
        },
    },
    {
        accessorKey: 'value',
        header: 'Valor',
        cell: ({ row }) => {
            const type = row.original.type;
            const value = parseFloat(row.getValue('value'));

            if (type === 'percentage') {
                return <span className="font-medium">{value.toFixed(2)}%</span>;
            }

            return (
                <span className="font-medium">
                    {new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                    }).format(value)}
                </span>
            );
        },
    },
    {
        accessorKey: 'reduces_revenue_base',
        header: 'Reduz Base',
        cell: ({ row }) => (
            <Badge
                variant={
                    row.getValue('reduces_revenue_base')
                        ? 'destructive'
                        : 'outline'
                }
            >
                {row.getValue('reduces_revenue_base') ? 'Sim' : 'Não'}
            </Badge>
        ),
    },
    {
        accessorKey: 'active',
        header: 'Status',
        cell: ({ row }) => {
            const item = row.original;
            return (
                <Button
                    variant={item.active ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => onToggle(item)}
                    className="h-7"
                >
                    {item.active ? 'Ativo' : 'Inativo'}
                </Button>
            );
        },
    },
    {
        id: 'actions',
        enableHiding: false,
        cell: ({ row }) => {
            const item = row.original;

            return (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Abrir menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Ações</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => onEdit(item)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => onDelete(item)}
                            className="text-destructive focus:text-destructive"
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Excluir
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            );
        },
    },
];
