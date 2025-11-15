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
import { router } from '@inertiajs/react';
import { Check, Link2, Search, Store, Trash2, X } from 'lucide-react';
import React from 'react';
import { toast } from 'sonner';

interface ExternalItem {
    sku: string;
    name: string;
    unit_price: number;
    mapped: boolean;
    provider?: string;
}

interface ProductMapping {
    id: number;
    external_item_id: string;
    external_item_name: string;
    provider: string;
}

interface ProductAssociateDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    product: {
        id: number;
        name: string;
        mappings?: ProductMapping[];
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

    // Filtrar apenas produtos não associados ao produto atual
    const availableItems = externalItems.filter((item) => {
        const isMappedToThis = product?.mappings?.some(
            (m) => m.external_item_id === item.sku,
        );
        return !isMappedToThis;
    });

    const filteredAvailableItems = availableItems.filter(
        (item) =>
            item.name.toLowerCase().includes(search.toLowerCase()) ||
            item.sku.toLowerCase().includes(search.toLowerCase()),
    );

    const mappedItems = product?.mappings || [];

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

    const handleAssociate = (externalItem: ExternalItem) => {
        if (!product) return;

        router.post(
            '/product-mappings',
            {
                external_item_id: externalItem.sku,
                external_item_name: externalItem.name,
                internal_product_id: product.id,
                provider: externalItem.provider || 'ifood',
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success('Produto associado com sucesso!');
                    router.reload({ only: ['products', 'externalItems'] });
                },
                onError: () => {
                    toast.error('Erro ao associar produto');
                },
            },
        );
    };

    const handleRemoveMapping = (mappingId: number) => {
        if (!product) return;

        router.delete(`/product-mappings/${mappingId}`, {
            preserveScroll: true,
            onSuccess: () => {
                toast.success('Associação removida!');
                router.reload({ only: ['products', 'externalItems'] });
            },
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex h-[85vh] max-w-6xl flex-col gap-4 sm:max-w-[90vw] lg:max-w-[1200px]">
                <DialogHeader>
                    <DialogTitle>Associar Produtos de Marketplaces</DialogTitle>
                    <DialogDescription>
                        Produto interno: <strong>{product?.name}</strong>
                    </DialogDescription>
                </DialogHeader>

                {/* Input de busca - fora do overflow */}
                <div className="relative w-full lg:w-[calc(50%-0.5rem)]">
                    <Search className="absolute top-2.5 left-2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por nome, SKU ou código..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-8"
                    />
                </div>

                <div className="grid flex-1 grid-cols-1 gap-4 overflow-hidden md:grid-cols-2">
                    {/* COLUNA ESQUERDA - Produtos Disponíveis */}
                    <div className="flex flex-col gap-4 overflow-hidden">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold">
                                Produtos Disponíveis
                            </h3>
                            <Badge variant="secondary">
                                {filteredAvailableItems.length}
                            </Badge>
                        </div>

                        {/* Lista de produtos disponíveis */}
                        <div className="flex-1 overflow-y-auto">
                            <div className="space-y-2 pr-2">
                                {filteredAvailableItems.length > 0 ? (
                                    filteredAvailableItems.map((item) => {
                                        const isAlreadyMapped =
                                            item.mapped &&
                                            !product?.mappings?.some(
                                                (m) =>
                                                    m.external_item_id ===
                                                    item.sku,
                                            );

                                        return (
                                            <div
                                                key={item.sku}
                                                className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                                                    isAlreadyMapped
                                                        ? 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30'
                                                        : 'hover:bg-accent'
                                                }`}
                                            >
                                                {/* Logo do marketplace */}
                                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded border bg-background">
                                                    {getProviderLogo(
                                                        item.provider ||
                                                            'ifood',
                                                    ) ? (
                                                        <img
                                                            src={
                                                                getProviderLogo(
                                                                    item.provider ||
                                                                        'ifood',
                                                                )!
                                                            }
                                                            alt={getProviderName(
                                                                item.provider ||
                                                                    'ifood',
                                                            )}
                                                            className="h-6 w-6 object-contain"
                                                        />
                                                    ) : (
                                                        <Store className="h-5 w-5 text-muted-foreground" />
                                                    )}
                                                </div>

                                                {/* Info do produto */}
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <p className="text-sm font-medium">
                                                            {item.name}
                                                        </p>
                                                        {isAlreadyMapped && (
                                                            <Badge
                                                                variant="destructive"
                                                                className="shrink-0 text-xs"
                                                            >
                                                                Já associado
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">
                                                        SKU: {item.sku}
                                                    </p>
                                                    <p className="mt-1 font-mono text-sm">
                                                        R${' '}
                                                        {item.unit_price.toFixed(
                                                            2,
                                                        )}
                                                    </p>
                                                </div>

                                                {/* Botão associar */}
                                                <Button
                                                    variant={
                                                        isAlreadyMapped
                                                            ? 'destructive'
                                                            : 'outline'
                                                    }
                                                    size="sm"
                                                    onClick={() =>
                                                        handleAssociate(item)
                                                    }
                                                    disabled={isAlreadyMapped}
                                                    className="shrink-0"
                                                >
                                                    <Link2 className="mr-2 h-4 w-4" />
                                                    {isAlreadyMapped
                                                        ? 'Bloqueado'
                                                        : 'Associar'}
                                                </Button>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                                        {search
                                            ? 'Nenhum produto encontrado'
                                            : 'Todos os produtos já estão associados'}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* COLUNA DIREITA - Produtos Associados */}
                    <div className="flex flex-col gap-4 overflow-hidden">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold">
                                Produtos Associados
                            </h3>
                            <Badge variant="default">
                                {mappedItems.length}
                            </Badge>
                        </div>

                        <div className="flex-1 overflow-y-auto">
                            <div className="space-y-2 pr-2">
                                {mappedItems.length > 0 ? (
                                    mappedItems.map((mapping) => (
                                        <div
                                            key={mapping.id}
                                            className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950/30"
                                        >
                                            {/* Logo do marketplace */}
                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded border bg-background">
                                                {getProviderLogo(
                                                    mapping.provider,
                                                ) ? (
                                                    <img
                                                        src={
                                                            getProviderLogo(
                                                                mapping.provider,
                                                            )!
                                                        }
                                                        alt={getProviderName(
                                                            mapping.provider,
                                                        )}
                                                        className="h-6 w-6 object-contain"
                                                    />
                                                ) : (
                                                    <Store className="h-5 w-5 text-muted-foreground" />
                                                )}
                                            </div>

                                            {/* Info do produto */}
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <Check className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
                                                    <p className="text-sm font-medium">
                                                        {
                                                            mapping.external_item_name
                                                        }
                                                    </p>
                                                </div>
                                                <p className="text-xs text-muted-foreground">
                                                    SKU:{' '}
                                                    {mapping.external_item_id}
                                                </p>
                                                <Badge
                                                    variant="outline"
                                                    className="mt-1"
                                                >
                                                    {getProviderName(
                                                        mapping.provider,
                                                    )}
                                                </Badge>
                                            </div>

                                            {/* Botão remover */}
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() =>
                                                    handleRemoveMapping(
                                                        mapping.id,
                                                    )
                                                }
                                                className="shrink-0"
                                            >
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </div>
                                    ))
                                ) : (
                                    <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                                        <div className="text-center">
                                            <X className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
                                            <p>Nenhum produto associado</p>
                                            <p className="mt-1 text-xs">
                                                Associe produtos da lista ao
                                                lado
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer com estatísticas */}
                <div className="flex items-center justify-between border-t pt-4 text-sm text-muted-foreground">
                    <p>
                        {mappedItems.length} produto(s) associado(s) •{' '}
                        {availableItems.length} disponível(is)
                    </p>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        Fechar
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
