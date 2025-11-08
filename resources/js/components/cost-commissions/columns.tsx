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
    type: 'percentage' | 'fixed';
    value: string;
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
        accessorKey: 'affects_revenue_base',
        header: 'Afeta Base',
        cell: ({ row }) => (
            <Badge
                variant={
                    row.getValue('affects_revenue_base') ? 'default' : 'outline'
                }
            >
                {row.getValue('affects_revenue_base') ? 'Sim' : 'Não'}
            </Badge>
        ),
    },
    {
        accessorKey: 'enters_tax_base',
        header: 'Base Imposto',
        cell: ({ row }) => (
            <Badge
                variant={
                    row.getValue('enters_tax_base') ? 'default' : 'outline'
                }
            >
                {row.getValue('enters_tax_base') ? 'Sim' : 'Não'}
            </Badge>
        ),
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
