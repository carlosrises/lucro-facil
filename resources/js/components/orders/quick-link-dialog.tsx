import { ProductFormDialog } from '@/components/products/product-form-dialog';
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
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    AlertCircle,
    Box,
    CupSoda,
    IceCream2,
    Layers,
    Package,
    Pizza,
    Plus,
    RefreshCw,
    Search,
    UtensilsCrossed,
} from 'lucide-react';
import md5 from 'md5';
import React from 'react';
import { toast } from 'sonner';

interface InternalProduct {
    id: number;
    name: string;
    unit_cost: string;
}

interface QuickLinkDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    item: {
        sku?: string;
        name: string;
        occurrences?: number;
        orders_count?: number;
    } | null;
    internalProducts: InternalProduct[];
    orderId?: number;
    onSuccess?: () => void;
}

const ITEM_TYPES = [
    {
        value: 'flavor',
        label: 'Sabor',
        icon: Pizza,
        color: 'text-purple-500',
        description: 'Sabor de pizza que será fracionado',
    },
    {
        value: 'beverage',
        label: 'Bebida',
        icon: CupSoda,
        color: 'text-blue-500',
        description: 'Refrigerante, suco, água, etc',
    },
    {
        value: 'complement',
        label: 'Complemento',
        icon: Plus,
        color: 'text-green-500',
        description: 'Borda, molho, catupiry extra, etc',
    },
    {
        value: 'parent_product',
        label: 'Produto Pai',
        icon: Package,
        color: 'text-orange-500',
        description: 'Pizza completa, combo, etc',
    },
    {
        value: 'optional',
        label: 'Opcional',
        icon: Layers,
        color: 'text-amber-500',
        description: 'Ingredientes que podem ser adicionados/removidos',
    },
    {
        value: 'combo',
        label: 'Combo',
        icon: Box,
        color: 'text-pink-500',
        description: 'Promoção com múltiplos produtos',
    },
    {
        value: 'side',
        label: 'Acompanhamento',
        icon: UtensilsCrossed,
        color: 'text-teal-500',
        description: 'Batata frita, pão de alho, etc',
    },
    {
        value: 'dessert',
        label: 'Sobremesa',
        icon: IceCream2,
        color: 'text-rose-500',
        description: 'Doces, sorvetes, etc',
    },
];

export function QuickLinkDialog({
    open,
    onOpenChange,
    item,
    internalProducts: initialProducts,
    orderId,
    onSuccess,
}: QuickLinkDialogProps) {
    const [selectedType, setSelectedType] = React.useState<string>('flavor');
    const [selectedProduct, setSelectedProduct] = React.useState<string>('');
    const [searchTerm, setSearchTerm] = React.useState('');
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [isRefreshingProducts, setIsRefreshingProducts] =
        React.useState(false);
    const [actualOccurrences, setActualOccurrences] = React.useState<
        number | null
    >(null);
    const [actualOrders, setActualOrders] = React.useState<number | null>(null);
    const [isLoadingOccurrences, setIsLoadingOccurrences] =
        React.useState(false);
    const [isProductDialogOpen, setIsProductDialogOpen] = React.useState(false);

    // Estado local para produtos (permite atualizar sem Inertia)
    const [internalProducts, setInternalProducts] =
        React.useState<InternalProduct[]>(initialProducts);

    // Prevenir fechamento durante operações
    const isOperatingRef = React.useRef(false);

    // Sincronizar produtos quando props mudarem
    React.useEffect(() => {
        setInternalProducts(initialProducts);
    }, [initialProducts]);

    // Reset ao abrir e buscar ocorrências reais
    React.useEffect(() => {
        if (open && item) {
            setSelectedType('flavor');
            setSelectedProduct('');
            setSearchTerm('');
            setActualOccurrences(null);
            setActualOrders(null);
            setIsSubmitting(false);
            isOperatingRef.current = false;
            setIsLoadingOccurrences(true);

            // Gerar SKU se necessário
            let itemSku = item.sku;
            if (!itemSku && item.name) {
                const hash = md5(item.name);
                itemSku = `addon_${hash}`;
            }

            // Buscar mapping existente para pré-selecionar
            if (itemSku) {
                fetch(`/api/product-mappings/${encodeURIComponent(itemSku)}`)
                    .then((res) => {
                        if (res.ok) return res.json();
                        return null;
                    })
                    .then((mapping) => {
                        if (mapping) {
                            console.log(
                                '[QuickLinkDialog] Mapping encontrado:',
                                mapping,
                            );
                            if (mapping.item_type) {
                                setSelectedType(mapping.item_type);
                            }
                            if (mapping.internal_product_id) {
                                setSelectedProduct(
                                    mapping.internal_product_id.toString(),
                                );
                            }
                        }
                    })
                    .catch((err) =>
                        console.error('Erro ao buscar mapping:', err),
                    );
            }

            // Buscar número real de ocorrências via API
            // Se não tem SKU, gerar um artificial baseado no nome (como a Triagem faz)
            const fetchOccurrences = () => {
                let itemSku = item.sku;
                console.log('[QuickLinkDialog] Item original:', item);
                console.log(
                    '[QuickLinkDialog] item.occurrences:',
                    item.occurrences,
                );
                console.log(
                    '[QuickLinkDialog] item.orders_count:',
                    item.orders_count,
                );

                if (!itemSku && item.name) {
                    const hash = md5(item.name);
                    itemSku = `addon_${hash}`;
                    console.log(
                        '[QuickLinkDialog] MD5 gerado para "' +
                            item.name +
                            '": ' +
                            hash,
                    );
                }

                if (itemSku) {
                    console.log(
                        '[QuickLinkDialog] Buscando ocorrências para SKU:',
                        itemSku,
                    );
                    fetch(`/api/item-triage/${encodeURIComponent(itemSku)}`)
                        .then((res) => {
                            console.log(
                                '[QuickLinkDialog] Response status:',
                                res.status,
                            );
                            if (!res.ok) {
                                throw new Error(`HTTP ${res.status}`);
                            }
                            return res.json();
                        })
                        .then((data) => {
                            console.log(
                                '[QuickLinkDialog] Data recebido:',
                                data,
                            );
                            const apiOccurrences =
                                data.total_occurrences ||
                                data.recent_orders?.length ||
                                0;
                            const apiOrders = data.total_orders || 0;
                            console.log(
                                '[QuickLinkDialog] Ocorrências da API:',
                                apiOccurrences,
                            );
                            console.log(
                                '[QuickLinkDialog] Pedidos da API:',
                                apiOrders,
                            );

                            // Se API retornar 0 mas item já tem occurrences, manter o valor do item
                            const finalOccurrences =
                                apiOccurrences > 0
                                    ? apiOccurrences
                                    : item.occurrences ||
                                      item.orders_count ||
                                      apiOccurrences;
                            const finalOrders =
                                apiOrders > 0
                                    ? apiOrders
                                    : item.orders_count || apiOrders;
                            console.log('[QuickLinkDialog] Valores finais:', {
                                finalOccurrences,
                                finalOrders,
                            });
                            setActualOccurrences(finalOccurrences);
                            setActualOrders(finalOrders);
                            setIsLoadingOccurrences(false);
                        })
                        .catch((err) => {
                            console.error(
                                '[QuickLinkDialog] Erro ao buscar ocorrências:',
                                err,
                            );
                            setActualOccurrences(
                                item.occurrences || item.orders_count || 0,
                            );
                            setIsLoadingOccurrences(false);
                        });
                } else {
                    console.log('[QuickLinkDialog] Sem SKU, usando fallback');
                    setActualOccurrences(
                        item.occurrences || item.orders_count || 0,
                    );
                    setIsLoadingOccurrences(false);
                }
            };

            fetchOccurrences();
        }
    }, [open, item]);

    const filteredProducts = React.useMemo(() => {
        if (!searchTerm) return internalProducts;
        const search = searchTerm.toLowerCase();
        return internalProducts.filter((product) =>
            product.name.toLowerCase().includes(search),
        );
    }, [internalProducts, searchTerm]);

    const handleRefreshProducts = async () => {
        setIsRefreshingProducts(true);
        isOperatingRef.current = true;

        try {
            // Fazer requisição para API de produtos
            const response = await fetch('/api/products', {
                headers: {
                    Accept: 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
            });

            if (!response.ok) {
                throw new Error('Erro ao buscar produtos');
            }

            const products = await response.json();

            if (Array.isArray(products)) {
                setInternalProducts(products);
                toast.success('Lista de produtos atualizada!');
            } else {
                throw new Error('Formato de resposta inesperado');
            }
        } catch (error) {
            console.error('Erro ao atualizar produtos:', error);
            toast.error('Erro ao atualizar lista de produtos');
        } finally {
            setIsRefreshingProducts(false);
            isOperatingRef.current = false;
        }
    };

    const handleConfirm = async () => {
        // Permitir vinculação mesmo sem SKU, usando o nome como identificador
        if ((!item?.sku && !item?.name) || !selectedProduct) {
            toast.error('Item sem identificador (SKU ou nome)');
            return;
        }

        setIsSubmitting(true);
        isOperatingRef.current = true;

        try {
            // Se não tem SKU, gerar um artificial baseado no nome (como a Triagem faz)
            // Backend usa: 'addon_' . md5($nome)
            let itemSku = item.sku;
            if (!itemSku && item.name) {
                const hash = md5(item.name);
                itemSku = `addon_${hash}`;
            }

            const payload = {
                sku: itemSku,
                name: item.name,
                item_type: selectedType,
                internal_product_id: selectedProduct,
            };

            const response = await fetch('/item-triage/classify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-CSRF-TOKEN':
                        document
                            .querySelector('meta[name="csrf-token"]')
                            ?.getAttribute('content') || '',
                },
                body: JSON.stringify(payload),
            });

            console.log('[QuickLinkDialog] Response status:', response.status);
            console.log(
                '[QuickLinkDialog] Response headers:',
                response.headers,
            );

            // Verificar se response é JSON
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                console.error(
                    '[QuickLinkDialog] Response não é JSON:',
                    text.substring(0, 500),
                );
                toast.error('Erro no servidor ao vincular item');
                setIsSubmitting(false);
                isOperatingRef.current = false;
                return;
            }

            const result = await response.json();
            console.log('[QuickLinkDialog] Response JSON:', result);

            if (!response.ok) {
                toast.error(result.message || 'Erro ao vincular item');
                setIsSubmitting(false);
                isOperatingRef.current = false;
                return;
            }

            // Usar actualOccurrences para mostrar o número correto
            const count =
                actualOccurrences !== null
                    ? actualOccurrences
                    : item.occurrences || item.orders_count || 0;
            toast.success(
                `Item vinculado com sucesso em ${count} ${count === 1 ? 'ocorrência' : 'ocorrências'}!`,
            );

            // Chamar callback de sucesso para recarregar dados do pedido
            if (onSuccess) {
                onSuccess();
            }

            onOpenChange(false);
            setIsSubmitting(false);
            isOperatingRef.current = false;
        } catch (error) {
            console.error('Erro ao vincular:', error);
            toast.error('Erro ao vincular item');
            setIsSubmitting(false);
            isOperatingRef.current = false;
        }
    };

    const selectedTypeData = ITEM_TYPES.find((t) => t.value === selectedType);
    const selectedProductData = internalProducts.find(
        (p) => p.id.toString() === selectedProduct,
    );

    // Usar actualOccurrences e actualOrders se disponíveis, senão fallback
    const occurrences =
        actualOccurrences !== null
            ? actualOccurrences
            : item?.occurrences || item?.orders_count || 0;

    const orders =
        actualOrders !== null
            ? actualOrders
            : item?.orders_count || occurrences;

    return (
        <>
            <Dialog
                open={open}
                onOpenChange={(newOpen) => {
                    // Prevenir fechar durante operações
                    if (
                        isOperatingRef.current ||
                        isSubmitting ||
                        isRefreshingProducts
                    ) {
                        return;
                    }
                    onOpenChange(newOpen);
                }}
            >
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Vincular Item a Produto</DialogTitle>
                        <DialogDescription>
                            Item:{' '}
                            <span className="font-semibold">{item?.name}</span>
                        </DialogDescription>
                    </DialogHeader>

                    {/* Alerta de Impacto */}
                    {isLoadingOccurrences ? (
                        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                            <div className="flex items-start gap-3">
                                <div className="mt-0.5 h-5 w-5 animate-pulse rounded bg-gray-300" />
                                <div className="flex-1 space-y-3">
                                    <div className="h-5 w-48 animate-pulse rounded bg-gray-300" />
                                    <div className="flex items-baseline gap-2">
                                        <div className="h-8 w-16 animate-pulse rounded bg-gray-300" />
                                        <div className="h-4 w-24 animate-pulse rounded bg-gray-300" />
                                        <div className="h-8 w-16 animate-pulse rounded bg-gray-300" />
                                        <div className="h-4 w-20 animate-pulse rounded bg-gray-300" />
                                    </div>
                                    <div className="h-3 w-full animate-pulse rounded bg-gray-300" />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                            <div className="flex items-start gap-3">
                                <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
                                <div className="flex-1">
                                    <h4 className="font-semibold text-red-900">
                                        Impacto da Vinculação
                                    </h4>
                                    <div className="mt-1 flex items-baseline gap-2">
                                        <span className="text-2xl font-bold text-red-600">
                                            {occurrences}
                                        </span>
                                        <span className="text-sm text-red-700">
                                            {occurrences === 1
                                                ? 'ocorrência em'
                                                : 'ocorrências em'}
                                        </span>
                                        <span className="text-2xl font-bold text-red-600">
                                            {orders}
                                        </span>
                                        <span className="text-sm text-red-700">
                                            {orders === 1
                                                ? 'pedido'
                                                : 'pedidos'}
                                        </span>
                                    </div>
                                    <p className="mt-2 text-xs text-red-700">
                                        Esta vinculação será aplicada a todos os
                                        pedidos históricos que contêm este item.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Seleção de Tipo */}
                    <div className="space-y-2">
                        <Label htmlFor="type-select">Tipo de Item</Label>
                        <div className="w-1/2">
                            <Select
                                value={selectedType}
                                onValueChange={setSelectedType}
                            >
                                <SelectTrigger id="type-select">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {ITEM_TYPES.map((type) => {
                                        const Icon = type.icon;
                                        return (
                                            <SelectItem
                                                key={type.value}
                                                value={type.value}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <Icon
                                                        className={`h-4 w-4 ${type.color}`}
                                                    />
                                                    <span>{type.label}</span>
                                                </div>
                                            </SelectItem>
                                        );
                                    })}
                                </SelectContent>
                            </Select>
                        </div>
                        {selectedTypeData && (
                            <p className="text-sm text-muted-foreground">
                                {selectedTypeData.description}
                            </p>
                        )}
                    </div>

                    {/* Busca de Produto */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="product-search">Produto CMV</Label>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={handleRefreshProducts}
                                disabled={isRefreshingProducts}
                                className="h-7 px-2 text-xs"
                            >
                                <RefreshCw
                                    className={`mr-1 h-3 w-3 ${isRefreshingProducts ? 'animate-spin' : ''}`}
                                />
                                Atualizar
                            </Button>
                        </div>
                        <div className="relative">
                            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                id="product-search"
                                placeholder="Buscar produto..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                    </div>

                    {/* Lista de Produtos */}
                    <div className="max-h-[300px] space-y-1 overflow-y-auto rounded-md border p-2">
                        {filteredProducts.length === 0 ? (
                            <div className="py-8 text-center text-sm text-muted-foreground">
                                Nenhum produto encontrado
                            </div>
                        ) : (
                            filteredProducts.map((product) => (
                                <button
                                    key={product.id}
                                    type="button"
                                    onClick={() =>
                                        setSelectedProduct(
                                            product.id.toString(),
                                        )
                                    }
                                    className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left transition-colors ${
                                        selectedProduct ===
                                        product.id.toString()
                                            ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                                            : 'hover:bg-accent'
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <Box className="h-4 w-4" />
                                        <span className="font-medium">
                                            {product.name}
                                        </span>
                                    </div>
                                    <Badge variant="secondary">
                                        R${' '}
                                        {parseFloat(product.unit_cost).toFixed(
                                            2,
                                        )}
                                    </Badge>
                                </button>
                            ))
                        )}
                    </div>

                    {/* Produto Selecionado */}
                    {selectedProductData && (
                        <div className="rounded-md border border-green-200 bg-green-50 p-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-green-900">
                                        Produto selecionado
                                    </p>
                                    <p className="text-sm text-green-700">
                                        {selectedProductData.name}
                                    </p>
                                </div>
                                <Badge className="bg-green-600">
                                    R${' '}
                                    {parseFloat(
                                        selectedProductData.unit_cost,
                                    ).toFixed(2)}
                                </Badge>
                            </div>
                        </div>
                    )}

                    {/* Ações */}
                    <div className="flex justify-between">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsProductDialogOpen(true)}
                            disabled={isSubmitting}
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            Criar Produto
                        </Button>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                                disabled={isSubmitting}
                            >
                                Cancelar
                            </Button>
                            <Button
                                onClick={handleConfirm}
                                disabled={!selectedProduct || isSubmitting}
                                className="bg-red-600 hover:bg-red-700"
                            >
                                {isSubmitting ? 'Vinculando...' : 'Confirmar'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Dialog de Criação de Produto */}
            <ProductFormDialog
                open={isProductDialogOpen}
                onOpenChange={setIsProductDialogOpen}
                product={null}
                onSuccess={(createdProduct) => {
                    // Adicionar produto criado na lista local
                    const newProduct = {
                        id: createdProduct.id,
                        name: createdProduct.name,
                        unit_cost: createdProduct.unit_cost,
                    };
                    setInternalProducts((prev) => [...prev, newProduct]);
                    // Selecionar automaticamente o produto recém-criado
                    setSelectedProduct(createdProduct.id.toString());
                    setSearchTerm(''); // Limpar busca para mostrar o produto
                }}
            />
        </>
    );
}
