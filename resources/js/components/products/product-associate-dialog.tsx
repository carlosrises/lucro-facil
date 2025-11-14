import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { router } from '@inertiajs/react';
import { Check, Link2, Search, Trash2, X } from 'lucide-react';
import React from 'react';
import { toast } from 'sonner';

interface ExternalItem {
    sku: string;
    name: string;
    unit_price: number;
    mapped: boolean;
}

interface ProductAssociateDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    product: {
        id: number;
        name: string;
    } | null;
    externalItems: ExternalItem[];
}

export function ProductAssociateDialog({
    open,
    onOpenChange,
    product,
    externalItems,
}: ProductAssociateDialogProps) {
    const [search, setSearch] = React.useState('');

    const filteredItems = externalItems.filter(
        (item) =>
            item.name.toLowerCase().includes(search.toLowerCase()) ||
            item.sku.toLowerCase().includes(search.toLowerCase()),
    );

    const handleAssociate = (externalItem: ExternalItem) => {
        if (!product) return;

        router.post(
            '/product-mappings',
            {
                external_item_id: externalItem.sku,
                external_item_name: externalItem.name,
                internal_product_id: product.id,
                provider: 'ifood',
            },
            {
                preserveScroll: true,
                preserveState: true,
                only: ['externalItems'],
                onSuccess: () => {
                    toast.success('Produto associado com sucesso!');
                },
                onError: () => {
                    toast.error('Erro ao associar produto');
                },
            },
        );
    };

    const handleRemoveMapping = (sku: string) => {
        if (!product) return;

        router.delete(`/product-mappings/sku/${sku}`, {
            preserveScroll: true,
            preserveState: true,
            only: ['externalItems'],
            onSuccess: () => {
                toast.success('Associação removida!');
            },
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[90vh] min-w-[90vw] flex-col overflow-hidden lg:min-w-[1200px]">
                <DialogHeader>
                    <DialogTitle>Associar Produtos Externos</DialogTitle>
                    <DialogDescription>
                        Produto interno: <strong>{product?.name}</strong>
                        <br />
                        Selecione os produtos do marketplace para associar
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-1 flex-col gap-4 overflow-hidden">
                    {/* Busca */}
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute top-2.5 left-2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar por nome ou SKU..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-8"
                            />
                        </div>
                    </div>

                    {/* Lista de produtos externos */}
                    <div className="flex-1 overflow-auto rounded-md border">
                        <Table>
                            <TableHeader className="sticky top-0 bg-background">
                                <TableRow>
                                    <TableHead className="w-[40%]">
                                        Produto (Marketplace)
                                    </TableHead>
                                    <TableHead className="w-[15%]">
                                        SKU
                                    </TableHead>
                                    <TableHead className="w-[15%]">
                                        Preço
                                    </TableHead>
                                    <TableHead className="w-[15%]">
                                        Status
                                    </TableHead>
                                    <TableHead className="w-[15%] text-right">
                                        Ações
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredItems.length > 0 ? (
                                    filteredItems.map((item) => (
                                        <TableRow key={item.sku}>
                                            <TableCell className="font-medium">
                                                {item.name}
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                                {item.sku}
                                            </TableCell>
                                            <TableCell className="font-mono">
                                                R$ {item.unit_price.toFixed(2)}
                                            </TableCell>
                                            <TableCell>
                                                {item.mapped ? (
                                                    <Badge
                                                        variant="default"
                                                        className="gap-1"
                                                    >
                                                        <Check className="h-3 w-3" />
                                                        Associado
                                                    </Badge>
                                                ) : (
                                                    <Badge
                                                        variant="secondary"
                                                        className="gap-1"
                                                    >
                                                        <X className="h-3 w-3" />
                                                        Não Associado
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {item.mapped ? (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() =>
                                                            handleRemoveMapping(
                                                                item.sku,
                                                            )
                                                        }
                                                    >
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                ) : (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() =>
                                                            handleAssociate(
                                                                item,
                                                            )
                                                        }
                                                    >
                                                        <Link2 className="mr-2 h-4 w-4" />
                                                        Associar
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell
                                            colSpan={5}
                                            className="h-24 text-center"
                                        >
                                            Nenhum produto encontrado
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    <div className="flex items-center justify-between border-t pt-4 text-sm text-muted-foreground">
                        <p>
                            {filteredItems.filter((i) => i.mapped).length} de{' '}
                            {filteredItems.length} produtos associados
                        </p>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
