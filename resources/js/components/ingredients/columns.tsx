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

export type Ingredient = {
    id: number;
    name: string;
    category_id: number | null;
    category?: {
        id: number;
        name: string;
        color?: string;
    } | null;
    unit: string;
    unit_price: string;
    current_stock: string;
    ideal_stock: string;
    active: boolean;
};

const unitLabels: Record<string, string> = {
    unit: 'Unidade',
    kg: 'Quilograma',
    g: 'Grama',
    l: 'Litro',
    ml: 'Mililitro',
    // Manter compatibilidade com maiúsculas caso existam dados antigos
    UN: 'Unidade',
    KG: 'Quilograma',
    G: 'Grama',
    L: 'Litro',
    ML: 'Mililitro',
};

interface ColumnsProps {
    onEdit: (ingredient: Ingredient) => void;
    onDelete: (ingredient: Ingredient) => void;
}

export const createColumns = ({
    onEdit,
    onDelete,
}: ColumnsProps): ColumnDef<Ingredient>[] => [
    {
        id: 'status_indicator',
        header: '',
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => {
            const { active } = row.original;
            return (
                <div
                    className={`h-2 w-2 rounded-full ${active ? 'bg-green-500' : 'bg-gray-400'}`}
                />
            );
        },
    },
    {
        accessorKey: 'name',
        header: 'Nome',
        cell: ({ row }) => {
            return <div className="font-medium">{row.getValue('name')}</div>;
        },
    },
    {
        accessorKey: 'category',
        header: 'Categoria',
        cell: ({ row }) => {
            const category = row.original.category;
            return category ? (
                <Badge
                    variant="outline"
                    className="gap-1.5 border-transparent"
                    style={{
                        backgroundColor: `${category.color || '#6b7280'}15`,
                        color: category.color || '#6b7280',
                    }}
                >
                    <div
                        className="h-2 w-2 rounded-full"
                        style={{
                            backgroundColor: category.color || '#6b7280',
                        }}
                    />
                    {category.name}
                </Badge>
            ) : (
                <span className="text-sm text-muted-foreground">
                    Sem categoria
                </span>
            );
        },
    },
    {
        accessorKey: 'unit',
        header: 'Unidade',
        cell: ({ row }) => {
            const unit = row.getValue('unit') as string;
            return <span className="text-sm">{unitLabels[unit] || unit}</span>;
        },
    },
    {
        accessorKey: 'unit_price',
        header: 'Preço Unitário',
        cell: ({ row }) => {
            const price = parseFloat(row.getValue('unit_price'));
            return (
                <div className="font-medium">
                    {new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                    }).format(price)}
                </div>
            );
        },
    },
    {
        accessorKey: 'current_stock',
        header: 'Estoque Atual',
        cell: ({ row }) => {
            const stock = parseFloat(row.getValue('current_stock'));
            const idealStock = parseFloat(row.original.ideal_stock);
            const isLow = stock < idealStock;

            return (
                <div
                    className={`font-medium ${isLow ? 'text-orange-600' : ''}`}
                >
                    {stock.toFixed(2)} {row.original.unit}
                </div>
            );
        },
    },
    {
        accessorKey: 'ideal_stock',
        header: 'Estoque Ideal',
        cell: ({ row }) => {
            const stock = parseFloat(row.getValue('ideal_stock'));
            return (
                <div className="text-sm text-muted-foreground">
                    {stock.toFixed(2)} {row.original.unit}
                </div>
            );
        },
    },
    {
        id: 'actions',
        enableHiding: false,
        cell: ({ row }) => {
            const ingredient = row.original;

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
                        <DropdownMenuItem onClick={() => onEdit(ingredient)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => onDelete(ingredient)}
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
