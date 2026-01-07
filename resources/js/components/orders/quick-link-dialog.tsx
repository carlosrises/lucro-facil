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
import { router } from '@inertiajs/react';
import {
    AlertCircle,
    Box,
    CupSoda,
    IceCream2,
    Layers,
    Package,
    Pizza,
    Plus,
    Search,
    UtensilsCrossed,
} from 'lucide-react';
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
    internalProducts,
}: QuickLinkDialogProps) {
    const [selectedType, setSelectedType] = React.useState<string>('flavor');
    const [selectedProduct, setSelectedProduct] = React.useState<string>('');
    const [searchTerm, setSearchTerm] = React.useState('');
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [actualOccurrences, setActualOccurrences] = React.useState<
        number | null
    >(null);
    const [isLoadingOccurrences, setIsLoadingOccurrences] =
        React.useState(false);
    const [showCreateForm, setShowCreateForm] = React.useState(false);
    const [isCreatingProduct, setIsCreatingProduct] = React.useState(false);

    // Form data for new product
    const [newProduct, setNewProduct] = React.useState({
        name: '',
        type: 'product' as 'product' | 'service',
        unit: 'unit' as 'unit' | 'kg' | 'g' | 'l' | 'ml' | 'hour',
        unit_cost: '',
        sale_price: '',
    });

    // Reset ao abrir e buscar ocorrências reais
    React.useEffect(() => {
        if (open && item) {
            setSelectedType('flavor');
            setSelectedProduct('');
            setSearchTerm('');
            setActualOccurrences(null);
            setShowCreateForm(false);
            setNewProduct({
                name: '',
                type: 'product',
                unit: 'unit',
                unit_cost: '',
                sale_price: '',
            });

            // Buscar número real de ocorrências via API
            if (item.sku) {
                setIsLoadingOccurrences(true);
                fetch(`/api/item-triage/${encodeURIComponent(item.sku)}`)
                    .then((res) => res.json())
                    .then((data) => {
                        const count =
                            data.total_orders ||
                            data.recent_orders?.length ||
                            0;
                        setActualOccurrences(count);
                        setIsLoadingOccurrences(false);
                    })
                    .catch((err) => {
                        console.error('Erro ao buscar ocorrências:', err);
                        setActualOccurrences(
                            item.occurrences || item.orders_count || 1,
                        );
                        setIsLoadingOccurrences(false);
                    });
            } else {
                setActualOccurrences(
                    item.occurrences || item.orders_count || 1,
                );
            }
        }
    }, [open, item]);

    const filteredProducts = React.useMemo(() => {
        if (!searchTerm) return internalProducts;
        const search = searchTerm.toLowerCase();
        return internalProducts.filter((product) =>
            product.name.toLowerCase().includes(search),
        );
    }, [internalProducts, searchTerm]);

    const handleConfirm = () => {
        if (!item?.sku || !selectedProduct) return;

        setIsSubmitting(true);

        router.post(
            '/item-triage/classify',
            {
                sku: item.sku,
                name: item.name,
                item_type: selectedType,
                internal_product_id: selectedProduct,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    const occurrences =
                        item.occurrences || item.orders_count || 0;
                    toast.success(
                        `Item vinculado com sucesso em ${occurrences} ${occurrences === 1 ? 'pedido' : 'pedidos'}!`,
                    );
                    onOpenChange(false);
                    setIsSubmitting(false);
                },
                onError: (errors) => {
                    console.error('Erro ao vincular:', errors);
                    toast.error('Erro ao vincular item');
                    setIsSubmitting(false);
                },
            },
        );
    };

    const handleCreateProduct = () => {
        if (!newProduct.name.trim()) {
            toast.error('Digite um nome para o produto');
            return;
        }

        if (!newProduct.unit_cost || parseFloat(newProduct.unit_cost) < 0) {
            toast.error('Digite um custo válido');
            return;
        }

        if (!newProduct.sale_price || parseFloat(newProduct.sale_price) < 0) {
            toast.error('Digite um preço de venda válido');
            return;
        }

        setIsCreatingProduct(true);

        router.post(
            '/products',
            {
                name: newProduct.name.trim(),
                type: newProduct.type,
                unit: newProduct.unit,
                unit_cost: newProduct.unit_cost,
                sale_price: newProduct.sale_price,
                active: true,
            },
            {
                preserveScroll: true,
                onSuccess: (page: any) => {
                    toast.success('Produto criado com sucesso!');
                    setShowCreateForm(false);
                    setNewProduct({
                        name: '',
                        type: 'product',
                        unit: 'unit',
                        unit_cost: '',
                        sale_price: '',
                    });
                    setIsCreatingProduct(false);

                    // Selecionar o produto recém-criado
                    const createdProduct = page.props.internalProducts?.find(
                        (p: InternalProduct) =>
                            p.name === newProduct.name.trim(),
                    );
                    if (createdProduct) {
                        setSelectedProduct(createdProduct.id.toString());
                    }
                },
                onError: (errors) => {
                    console.error('Erro ao criar produto:', errors);
                    toast.error('Erro ao criar produto');
                    setIsCreatingProduct(false);
                },
            },
        );
    };

    const selectedTypeData = ITEM_TYPES.find((t) => t.value === selectedType);
    const selectedProductData = internalProducts.find(
        (p) => p.id.toString() === selectedProduct,
    );

    // Usar actualOccurrences se disponível, senão fallback para valor inicial
    const occurrences =
        actualOccurrences !== null
            ? actualOccurrences
            : item?.occurrences || item?.orders_count || 0;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>
                        {showCreateForm
                            ? 'Criar Novo Produto'
                            : 'Vincular Item a Produto'}
                    </DialogTitle>
                    <DialogDescription>
                        {showCreateForm ? (
                            <span>
                                Preencha os dados do novo produto interno
                            </span>
                        ) : (
                            <>
                                Item:{' '}
                                <span className="font-semibold">
                                    {item?.name}
                                </span>
                            </>
                        )}
                    </DialogDescription>
                </DialogHeader>

                {showCreateForm ? (
                    // Formulário de Criação de Produto
                    <div className="space-y-4">
                        {/* Nome */}
                        <div className="space-y-2">
                            <Label htmlFor="new-product-name">
                                Nome do Produto{' '}
                                <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="new-product-name"
                                placeholder="Ex: Calabresa"
                                value={newProduct.name}
                                onChange={(e) =>
                                    setNewProduct({
                                        ...newProduct,
                                        name: e.target.value,
                                    })
                                }
                                disabled={isCreatingProduct}
                            />
                        </div>

                        {/* Tipo e Unidade */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="product-type">
                                    Tipo <span className="text-red-500">*</span>
                                </Label>
                                <Select
                                    value={newProduct.type}
                                    onValueChange={(
                                        value: 'product' | 'service',
                                    ) =>
                                        setNewProduct({
                                            ...newProduct,
                                            type: value,
                                        })
                                    }
                                    disabled={isCreatingProduct}
                                >
                                    <SelectTrigger id="product-type">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="product">
                                            Produto
                                        </SelectItem>
                                        <SelectItem value="service">
                                            Serviço
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="product-unit">
                                    Unidade{' '}
                                    <span className="text-red-500">*</span>
                                </Label>
                                <Select
                                    value={newProduct.unit}
                                    onValueChange={(value: any) =>
                                        setNewProduct({
                                            ...newProduct,
                                            unit: value,
                                        })
                                    }
                                    disabled={isCreatingProduct}
                                >
                                    <SelectTrigger id="product-unit">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="unit">
                                            Unidade
                                        </SelectItem>
                                        <SelectItem value="kg">
                                            Quilograma (kg)
                                        </SelectItem>
                                        <SelectItem value="g">
                                            Grama (g)
                                        </SelectItem>
                                        <SelectItem value="l">
                                            Litro (l)
                                        </SelectItem>
                                        <SelectItem value="ml">
                                            Mililitro (ml)
                                        </SelectItem>
                                        <SelectItem value="hour">
                                            Hora
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Custo e Preço */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="unit-cost">
                                    Custo Unitário{' '}
                                    <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="unit-cost"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="0.00"
                                    value={newProduct.unit_cost}
                                    onChange={(e) =>
                                        setNewProduct({
                                            ...newProduct,
                                            unit_cost: e.target.value,
                                        })
                                    }
                                    disabled={isCreatingProduct}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="sale-price">
                                    Preço de Venda{' '}
                                    <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="sale-price"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="0.00"
                                    value={newProduct.sale_price}
                                    onChange={(e) =>
                                        setNewProduct({
                                            ...newProduct,
                                            sale_price: e.target.value,
                                        })
                                    }
                                    disabled={isCreatingProduct}
                                />
                            </div>
                        </div>

                        {/* Ações - Formulário de Criação */}
                        <div className="flex justify-between pt-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setShowCreateForm(false)}
                                disabled={isCreatingProduct}
                            >
                                Voltar
                            </Button>
                            <Button
                                onClick={handleCreateProduct}
                                disabled={isCreatingProduct}
                            >
                                {isCreatingProduct
                                    ? 'Criando...'
                                    : 'Criar Produto'}
                            </Button>
                        </div>
                    </div>
                ) : (
                    // Formulário de Vinculação (original)
                    <>
                        {/* Alerta de Impacto */}
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
                                            {occurrences}
                                        </span>
                                        <span className="text-sm text-red-700">
                                            {occurrences === 1
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

                        {/* Seleção de Tipo */}
                        <div className="space-y-2">
                            <Label htmlFor="type-select">Tipo de Item</Label>
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
                            {selectedTypeData && (
                                <p className="text-sm text-muted-foreground">
                                    {selectedTypeData.description}
                                </p>
                            )}
                        </div>

                        {/* Busca de Produto */}
                        <div className="space-y-2">
                            <Label htmlFor="product-search">Produto CMV</Label>
                            <div className="relative">
                                <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    id="product-search"
                                    placeholder="Buscar produto..."
                                    value={searchTerm}
                                    onChange={(e) =>
                                        setSearchTerm(e.target.value)
                                    }
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
                                            {parseFloat(
                                                product.unit_cost,
                                            ).toFixed(2)}
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
                                onClick={() => setShowCreateForm(true)}
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
                                    {isSubmitting
                                        ? 'Vinculando...'
                                        : 'Confirmar'}
                                </Button>
                            </div>
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
