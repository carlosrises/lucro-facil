import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { router } from '@inertiajs/react';
import { ColumnDef } from '@tanstack/react-table';
import { Link2, Link2Off, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export interface ExternalItem {
    sku: string;
    name: string;
    unit_price: number;
    mapped: boolean;
    mapping: {
        id: number;
        internal_product_id: number;
        internal_product_name: string;
        internal_product_cost: number;
    } | null;
}

interface InternalProduct {
    id: number;
    name: string;
    unit_cost: number;
}

interface ColumnsProps {
    internalProducts: InternalProduct[];
}

export const createColumns = ({
    internalProducts,
}: ColumnsProps): ColumnDef<ExternalItem>[] => [
    {
        accessorKey: 'name',
        header: 'Produto (Marketplace)',
        cell: ({ row }) => {
            const item = row.original;
            return (
                <div className="flex flex-col">
                    <span className="font-medium">{item.name}</span>
                    <span className="text-xs text-muted-foreground">
                        SKU: {item.sku}
                    </span>
                </div>
            );
        },
    },
    {
        accessorKey: 'unit_price',
        header: 'Preço',
        cell: ({ row }) => {
            return (
                <span className="font-mono">
                    R$ {row.original.unit_price.toFixed(2)}
                </span>
            );
        },
    },
    {
        accessorKey: 'mapped',
        header: 'Status',
        cell: ({ row }) => {
            const mapped = row.original.mapped;
            return mapped ? (
                <Badge variant="default" className="gap-1">
                    <Link2 className="h-3 w-3" />
                    Mapeado
                </Badge>
            ) : (
                <Badge variant="secondary" className="gap-1">
                    <Link2Off className="h-3 w-3" />
                    Não Mapeado
                </Badge>
            );
        },
    },
    {
        id: 'internal_product',
        header: 'Produto Interno',
        cell: ({ row }) => {
            const item = row.original;

            const handleMapping = (productId: string) => {
                if (!productId) return;

                router.post(
                    '/product-mappings',
                    {
                        external_item_id: item.sku,
                        external_item_name: item.name,
                        internal_product_id: productId,
                        provider: 'ifood',
                    },
                    {
                        preserveScroll: true,
                        onSuccess: () => {
                            toast.success('Mapeamento atualizado!');
                        },
                        onError: () => {
                            toast.error('Erro ao atualizar mapeamento');
                        },
                    },
                );
            };

            return (
                <div className="flex items-center gap-2">
                    <Select
                        value={
                            item.mapping?.internal_product_id.toString() || ''
                        }
                        onValueChange={handleMapping}
                    >
                        <SelectTrigger className="w-[300px]">
                            <SelectValue placeholder="Selecione o produto interno" />
                        </SelectTrigger>
                        <SelectContent>
                            {internalProducts.map((product) => (
                                <SelectItem
                                    key={product.id}
                                    value={product.id.toString()}
                                >
                                    <div className="flex items-center justify-between gap-4">
                                        <span>{product.name}</span>
                                        <span className="text-xs text-muted-foreground">
                                            Custo: R${' '}
                                            {product.unit_cost.toFixed(2)}
                                        </span>
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {item.mapped && item.mapping && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                                if (
                                    confirm('Deseja remover este mapeamento?')
                                ) {
                                    router.delete(
                                        `/product-mappings/${item.mapping!.id}`,
                                        {
                                            preserveScroll: true,
                                            onSuccess: () => {
                                                toast.success(
                                                    'Mapeamento removido!',
                                                );
                                            },
                                        },
                                    );
                                }
                            }}
                        >
                            <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                    )}
                </div>
            );
        },
    },
];
