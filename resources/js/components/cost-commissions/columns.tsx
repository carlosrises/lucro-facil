import { ProviderBadge } from '@/components/provider-badge';
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
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
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
    delivery_by?: 'all' | 'store' | 'marketplace';
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
        accessorKey: 'category',
        header: 'Categoria',
        cell: ({ row }) => {
            const category = row.getValue('category') as string;
            const categoryConfig: Record<
                string,
                { label: string; className: string }
            > = {
                cost: {
                    label: 'Custo',
                    className: 'bg-red-100 text-red-800 hover:bg-red-100',
                },
                commission: {
                    label: 'Comissão',
                    className:
                        'bg-orange-100 text-orange-800 hover:bg-orange-100',
                },
                tax: {
                    label: 'Imposto',
                    className:
                        'bg-yellow-100 text-yellow-800 hover:bg-yellow-100',
                },
                payment_method: {
                    label: 'Taxa de Pagamento',
                    className: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
                },
            };
            const config = categoryConfig[category] || {
                label: category,
                className: '',
            };
            return <Badge className={config.className}>{config.label}</Badge>;
        },
    },
    {
        accessorKey: 'provider',
        header: 'Marketplace',
        cell: ({ row }) => {
            const provider = row.getValue('provider') as string | null;
            if (!provider) {
                return <Badge variant="outline">Todos</Badge>;
            }

            // Marketplaces que vêm via Takeat
            const marketplaces = ['ifood', '99food', 'neemo', 'keeta'];

            // Se tiver formato takeat-origin, extrair origin e mostrar badge "via TK"
            if (provider.startsWith('takeat-')) {
                const origin = provider.replace('takeat-', '');
                if (marketplaces.includes(origin)) {
                    return (
                        <div className="flex items-center gap-1">
                            <ProviderBadge provider={origin} />
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Badge
                                            variant="outline"
                                            className="h-4 px-1 text-[9px] font-normal whitespace-nowrap"
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
                    );
                }
                return <ProviderBadge provider={origin} />;
            }

            return <ProviderBadge provider={provider} />;
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
