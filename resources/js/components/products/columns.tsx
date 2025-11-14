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
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { router } from '@inertiajs/react';
import { ColumnDef } from '@tanstack/react-table';
import {
    FileText,
    Link2,
    MoreHorizontal,
    Pencil,
    Store,
    Trash2,
} from 'lucide-react';

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
    mappings?: Array<{
        id: number;
        provider: string;
        external_item_id: string;
        external_item_name: string;
    }>;
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
    onAssociate: (product: Product) => void;
    marginSettings: {
        margin_excellent: number;
        margin_good_min: number;
        margin_good_max: number;
        margin_poor: number;
    };
}

export const createColumns = ({
    onEdit,
    onDelete,
    onAssociate,
    marginSettings,
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

            return (
                <div className="font-medium text-green-600">
                    {new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                    }).format(price)}
                </div>
            );
        },
    },
    {
        accessorKey: 'margin',
        header: 'Margem',
        cell: ({ row }) => {
            const price = parseFloat(row.original.sale_price);
            const cost = parseFloat(row.original.unit_cost);
            const margin = cost > 0 ? ((price - cost) / cost) * 100 : 0;

            // Determina a cor do badge baseado nas configurações
            let variant: 'default' | 'warning' | 'destructive' = 'default';
            if (margin <= marginSettings.margin_poor) {
                variant = 'destructive'; // Vermelho - margem ruim
            } else if (margin >= marginSettings.margin_excellent) {
                variant = 'default'; // Verde - margem excelente
            } else {
                variant = 'warning'; // Laranja - margem boa (entre ruim e excelente)
            }

            return <Badge variant={variant}>{margin.toFixed(1)}%</Badge>;
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
        id: 'marketplaces',
        header: 'Marketplaces',
        cell: ({ row }) => {
            const mappings = row.original.mappings || [];

            const getProviderLogo = (provider: string) => {
                const logos: Record<string, string> = {
                    ifood: '/images/ifood.svg',
                    takeat: '/images/takeat.svg',
                    '99food': '/images/99food.png',
                };
                return logos[provider.toLowerCase()] || null;
            };

            const getProviderName = (provider: string) => {
                const names: Record<string, string> = {
                    ifood: 'iFood',
                    takeat: 'Takeat',
                    '99food': '99Food',
                };
                return names[provider.toLowerCase()] || provider;
            };

            if (mappings.length === 0) {
                return (
                    <div className="flex items-center justify-center text-muted-foreground">
                        <Store className="h-4 w-4" />
                    </div>
                );
            }

            // Obter providers únicos
            const uniqueProviders = Array.from(
                new Set(mappings.map((m) => m.provider)),
            );

            // Contar quantos produtos por provider
            const providerCounts = mappings.reduce(
                (acc, mapping) => {
                    acc[mapping.provider] = (acc[mapping.provider] || 0) + 1;
                    return acc;
                },
                {} as Record<string, number>,
            );

            return (
                <TooltipProvider>
                    <div className="flex items-center gap-1">
                        {uniqueProviders.map((provider) => (
                            <Tooltip key={provider}>
                                <TooltipTrigger asChild>
                                    <div className="flex h-6 w-6 items-center justify-center rounded border bg-background">
                                        {getProviderLogo(provider) ? (
                                            <img
                                                src={getProviderLogo(provider)!}
                                                alt={getProviderName(provider)}
                                                className="h-4 w-4 object-contain"
                                            />
                                        ) : (
                                            <Store className="h-3 w-3 text-muted-foreground" />
                                        )}
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p className="text-xs">
                                        <strong>
                                            {getProviderName(provider)}
                                        </strong>
                                        <br />
                                        {providerCounts[provider]}{' '}
                                        {providerCounts[provider] === 1
                                            ? 'produto'
                                            : 'produtos'}
                                    </p>
                                </TooltipContent>
                            </Tooltip>
                        ))}
                    </div>
                </TooltipProvider>
            );
        },
    },
    {
        id: 'actions',
        enableHiding: false,
        cell: ({ row }) => {
            const product = row.original;

            return (
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onAssociate(product)}
                    >
                        <Link2 className="mr-2 h-4 w-4" />
                        Associar
                    </Button>
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
                </div>
            );
        },
    },
];
