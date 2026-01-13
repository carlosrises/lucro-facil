import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

export type Category = {
    id: number;
    name: string;
    type: string;
    color: string;
    active: boolean;
    ingredients_count?: number;
};

interface ColumnsProps {
    onEdit: (category: Category) => void;
    onDelete: (category: Category) => void;
}

export const createColumns = ({
    onEdit,
    onDelete,
}: ColumnsProps): ColumnDef<Category>[] => [
    {
        accessorKey: 'name',
        header: 'Nome',
        cell: ({ row }) => {
            const category = row.original;
            return (
                <div className="flex items-center gap-2">
                    <div
                        className="h-3 w-3 rounded-full border"
                        style={{ backgroundColor: category.color }}
                    />
                    <span className="font-medium">{category.name}</span>
                </div>
            );
        },
    },
    {
        accessorKey: 'items_count',
        header: 'Itens',
        cell: ({ row }) => {
            const category = row.original;
            const count = category.ingredients_count || 0;
            return (
                <span className="text-sm text-muted-foreground">{count}</span>
            );
        },
    },
    {
        accessorKey: 'color',
        header: 'Cor',
        cell: ({ row }) => {
            const color = row.getValue('color') as string;
            return (
                <div className="flex items-center gap-2">
                    <div
                        className="h-6 w-6 rounded border"
                        style={{ backgroundColor: color }}
                    />
                    <span className="font-mono text-xs text-muted-foreground">
                        {color}
                    </span>
                </div>
            );
        },
    },
    {
        accessorKey: 'active',
        header: 'Status',
        cell: ({ row }) => {
            const active = row.getValue('active') as boolean;
            return (
                <Badge variant={active ? 'default' : 'secondary'}>
                    {active ? 'Ativo' : 'Inativo'}
                </Badge>
            );
        },
    },
    {
        id: 'actions',
        enableHiding: false,
        cell: ({ row }) => {
            const category = row.original;

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
                        <DropdownMenuItem onClick={() => onEdit(category)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => onDelete(category)}
                            className="text-red-600"
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
