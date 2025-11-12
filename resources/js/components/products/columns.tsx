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
import { router } from '@inertiajs/react';
import { ColumnDef } from '@tanstack/react-table';
import { FileText, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';

export type Product = {
    id: number;
    name: string;
    sku: string | null;
    type: string;
    unit: string;
    unit_cost: string;
    sale_price: string;
    category: string | null;
    active: boolean;
    costs_count: number;
};

const typeLabels: Record<string, string> = {
    product: 'Produto',
    service: 'Serviço',
};

const unitLabels: Record<string, string> = {
    unit: 'Unidade',
    kg: 'Quilograma',
    g: 'Grama',
    l: 'Litro',
    ml: 'Mililitro',
    hour: 'Hora',
};

interface ColumnsProps {
    onEdit: (product: Product) => void;
    onDelete: (product: Product) => void;
}

export const createColumns = ({
    onEdit,
    onDelete,
}: ColumnsProps): ColumnDef<Product>[] => [
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
            return (
                <div>
                    <div className="font-medium">{row.getValue('name')}</div>
                    {row.original.sku && (
                        <div className="text-xs text-muted-foreground">
                            SKU: {row.original.sku}
                        </div>
                    )}
                </div>
            );
        },
    },
    {
        accessorKey: 'type',
        header: 'Tipo',
        cell: ({ row }) => {
            const type = row.getValue('type') as string;
            return (
                <Badge variant={type === 'product' ? 'default' : 'secondary'}>
                    {typeLabels[type] || type}
                </Badge>
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
        accessorKey: 'unit_cost',
        header: 'Custo (CMV)',
        cell: ({ row }) => {
            const cost = parseFloat(row.getValue('unit_cost'));
            return (
                <div className="font-medium text-orange-600">
                    {new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                    }).format(cost)}
                </div>
            );
        },
    },
    {
        accessorKey: 'sale_price',
        header: 'Preço de Venda',
        cell: ({ row }) => {
            const price = parseFloat(row.getValue('sale_price'));
            const cost = parseFloat(row.original.unit_cost);
            const margin = cost > 0 ? ((price - cost) / cost) * 100 : 0;

            return (
                <div>
                    <div className="font-medium text-green-600">
                        {new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                        }).format(price)}
                    </div>
                    {margin > 0 && (
                        <div className="text-xs text-muted-foreground">
                            Margem: {margin.toFixed(1)}%
                        </div>
                    )}
                </div>
            );
        },
    },
    {
        accessorKey: 'costs_count',
        header: 'Insumos',
        cell: ({ row }) => {
            const count = row.getValue('costs_count') as number;
            return (
                <div className="text-center">
                    <Badge variant="outline">{count}</Badge>
                </div>
            );
        },
    },
    {
        id: 'actions',
        enableHiding: false,
        cell: ({ row }) => {
            const product = row.original;

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
                        <DropdownMenuItem
                            onClick={() => {
                                router.get(`/products/${product.id}`);
                            }}
                        >
                            <FileText className="mr-2 h-4 w-4" />
                            Ficha Técnica
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onEdit(product)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => onDelete(product)}
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
