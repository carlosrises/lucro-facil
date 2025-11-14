import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { router } from '@inertiajs/react';
import { Check, Link2, PackageX, Store } from 'lucide-react';
import React from 'react';
import { toast } from 'sonner';

interface OrderItem {
    id: number;
    sku?: string;
    name: string;
    qty?: number;
    quantity?: number;
    unit_price?: number;
    unitPrice?: number;
    internal_product?: {
        id: number;
        name: string;
        unit_cost: string;
    };
}

interface InternalProduct {
    id: number;
    name: string;
    sku: string | null;
    unit_cost: string;
}

interface QuickAssociateDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    orderCode: string;
    items: OrderItem[];
    internalProducts: InternalProduct[];
    provider: string;
}

export function QuickAssociateDialog({
    open,
    onOpenChange,
    orderCode,
    items,
    internalProducts,
    provider,
}: QuickAssociateDialogProps) {
    const [selectedProducts, setSelectedProducts] = React.useState<
        Record<number, number>
    >({});

    const unmappedItems = items.filter((item) => !item.internal_product);

    const handleAssociate = (
        itemId: number,
        itemSku: string,
        internalProductId: number,
    ) => {
        const item = items.find((i) => i.id === itemId);
        if (!item) {
            toast.error('Item não encontrado');
            return;
        }

        if (!itemSku) {
            toast.error('SKU do produto não está disponível');
            return;
        }

        console.log('Associando:', {
            external_item_id: itemSku,
            external_item_name: item.name,
            internal_product_id: internalProductId,
            provider: provider || 'ifood',
        });

        router.post(
            '/product-mappings',
            {
                external_item_id: itemSku,
                external_item_name: item.name,
                internal_product_id: internalProductId,
                provider: provider || 'ifood',
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success(`${item.name} associado com sucesso!`);
                    // Recarregar tudo para atualizar o dialog
                    router.reload();
                },
                onError: (errors) => {
                    console.error('Erro ao associar:', errors);
                    const errorMessage =
                        errors?.external_item_id?.[0] ||
                        errors?.internal_product_id?.[0] ||
                        'Erro ao associar produto';
                    toast.error(errorMessage);
                },
            },
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] max-w-2xl overflow-hidden">
                <DialogHeader>
                    <DialogTitle>Associar Produtos do Pedido</DialogTitle>
                    <DialogDescription>
                        Pedido: <strong>{orderCode}</strong> •{' '}
                        {unmappedItems.length} produto(s) não associado(s)
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="max-h-[calc(90vh-120px)] pr-4">
                    <div className="space-y-4">
                        {items.map((item) => (
                            <div
                                key={item.id}
                                className="flex flex-col gap-3 rounded-lg border p-4"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium">
                                                {item.name}
                                            </span>
                                            {item.internal_product ? (
                                                <Badge
                                                    variant="outline"
                                                    className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                                                >
                                                    <Check className="mr-1 h-3 w-3" />
                                                    Associado
                                                </Badge>
                                            ) : (
                                                <Badge
                                                    variant="outline"
                                                    className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"
                                                >
                                                    <PackageX className="mr-1 h-3 w-3" />
                                                    Não associado
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="mt-1 text-sm text-muted-foreground">
                                            SKU: {item.sku || 'N/A'} • Qtd:{' '}
                                            {item.qty || item.quantity || 0} •
                                            Preço:{' '}
                                            {new Intl.NumberFormat('pt-BR', {
                                                style: 'currency',
                                                currency: 'BRL',
                                            }).format(
                                                item.unit_price ||
                                                    item.unitPrice ||
                                                    0,
                                            )}
                                        </div>
                                        {item.internal_product && (
                                            <div className="mt-2 text-sm text-emerald-600 dark:text-emerald-400">
                                                <Store className="mr-1 inline h-3 w-3" />
                                                {item.internal_product.name} •
                                                Custo:{' '}
                                                {new Intl.NumberFormat(
                                                    'pt-BR',
                                                    {
                                                        style: 'currency',
                                                        currency: 'BRL',
                                                    },
                                                ).format(
                                                    parseFloat(
                                                        item.internal_product
                                                            .unit_cost,
                                                    ),
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {!item.internal_product && (
                                    <div className="flex items-center gap-2">
                                        <Combobox
                                            options={internalProducts.map(
                                                (product) => ({
                                                    value: product.id.toString(),
                                                    label: `${product.name}${product.sku ? ` • SKU: ${product.sku}` : ''}`,
                                                }),
                                            )}
                                            value={selectedProducts[
                                                item.id
                                            ]?.toString()}
                                            onChange={(value) =>
                                                setSelectedProducts((prev) => ({
                                                    ...prev,
                                                    [item.id]: parseInt(value),
                                                }))
                                            }
                                            placeholder="Selecione o produto interno"
                                            emptyMessage="Nenhum produto encontrado"
                                            searchPlaceholder="Buscar produto..."
                                            className="flex-1"
                                        />
                                        <Button
                                            size="sm"
                                            disabled={
                                                !selectedProducts[item.id]
                                            }
                                            onClick={() => {
                                                const sku = item.sku || '';
                                                if (!sku) {
                                                    toast.error(
                                                        'SKU do produto não está disponível',
                                                    );
                                                    return;
                                                }
                                                handleAssociate(
                                                    item.id,
                                                    sku,
                                                    selectedProducts[item.id],
                                                );
                                            }}
                                        >
                                            <Link2 className="mr-2 h-4 w-4" />
                                            Associar
                                        </Button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
