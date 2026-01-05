import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import {
    Box,
    Coffee,
    Layers,
    Package,
    Pizza,
    Plus,
    Search,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

interface InternalProduct {
    id: number;
    name: string;
    unit_cost: number;
}

interface ItemMapping {
    id: number;
    item_type: string | null;
    internal_product_id: number | null;
    internal_product_name: string | null;
    internal_product_cost: number | null;
}

interface Item {
    sku: string;
    name: string;
    orders_count: number;
    unit_price: number;
    last_seen_at: string;
    is_addon: boolean;
    mapping: ItemMapping | null;
}

interface RecentOrder {
    id: number;
    code: string;
    short_reference: string;
    placed_at: string;
    gross_total: number;
    qty: number;
    unit_price: number;
    total: number;
}

interface ItemTriageProps {
    items: Item[];
    internalProducts: InternalProduct[];
    stats: {
        total_items: number;
        pending_items: number;
        classified_items: number;
    };
    filters: {
        search: string;
        status: string;
        item_type: string;
        link_status: string;
    };
}

const itemTypes = [
    {
        value: 'flavor',
        label: 'Sabor',
        icon: Pizza,
        color: 'bg-purple-100 text-purple-900',
    },
    {
        value: 'beverage',
        label: 'Bebida',
        icon: Coffee,
        color: 'bg-blue-100 text-blue-900',
    },
    {
        value: 'complement',
        label: 'Complemento',
        icon: Plus,
        color: 'bg-green-100 text-green-900',
    },
    {
        value: 'parent_product',
        label: 'Produto Pai',
        icon: Package,
        color: 'bg-orange-100 text-orange-900',
    },
    {
        value: 'additional',
        label: 'Adicional',
        icon: Layers,
        color: 'bg-yellow-100 text-yellow-900',
    },
    {
        value: 'combo',
        label: 'Combo',
        icon: Box,
        color: 'bg-pink-100 text-pink-900',
    },
];

export default function ItemTriage({
    items,
    internalProducts,
    stats,
    filters,
}: ItemTriageProps) {
    const [selectedItem, setSelectedItem] = useState<Item | null>(null);
    const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
    const [selectedType, setSelectedType] = useState<string>('');
    const [selectedProduct, setSelectedProduct] = useState<string>('');
    const [search, setSearch] = useState(filters.search);
    const [status, setStatus] = useState(filters.status);
    const [itemType, setItemType] = useState(filters.item_type);
    const [linkStatus, setLinkStatus] = useState(filters.link_status);
    const [lastClassifiedType, setLastClassifiedType] = useState<string>('');
    const classifyButtonRef = useRef<HTMLButtonElement>(null);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Produtos', href: '/products' },
        { title: 'Triagem de Itens', href: '/item-triage' },
    ];

    // Selecionar primeiro item automaticamente
    useEffect(() => {
        if (items.length > 0 && !selectedItem) {
            handleSelectItem(items[0]);
        }
    }, [items]);

    // Pré-selecionar primeiro tipo de classificação ao selecionar item
    useEffect(() => {
        if (selectedItem && !selectedType) {
            // Se houver uma última classificação, usar ela; senão, usar o primeiro tipo
            if (lastClassifiedType) {
                setSelectedType(lastClassifiedType);
            } else if (itemTypes.length > 0) {
                setSelectedType(itemTypes[0].value);
            }
        }
    }, [selectedItem, lastClassifiedType]);

    // Listener para tecla Enter
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Enter' && selectedItem && selectedType) {
                // Evitar trigger se estiver digitando em input
                const target = e.target as HTMLElement;
                if (
                    target.tagName === 'INPUT' ||
                    target.tagName === 'TEXTAREA'
                ) {
                    return;
                }
                handleClassify();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [selectedItem, selectedType, selectedProduct]);

    // Buscar detalhes do item ao selecionar
    const handleSelectItem = async (item: Item) => {
        setSelectedItem(item);

        // Lógica de pré-seleção do tipo:
        // 1. Se o item já tem classificação, usar ela
        // 2. Senão, se temos última classificação usada, usar ela
        // 3. Senão, usar primeiro tipo da lista
        if (item.mapping?.item_type) {
            setSelectedType(item.mapping.item_type);
        } else if (lastClassifiedType) {
            setSelectedType(lastClassifiedType);
        } else if (itemTypes.length > 0) {
            setSelectedType(itemTypes[0].value);
        }

        setSelectedProduct(item.mapping?.internal_product_id?.toString() || '');

        try {
            const response = await fetch(`/api/item-triage/${item.sku}`);
            const data = await response.json();
            setRecentOrders(data.recent_orders);
        } catch (error) {
            console.error('Erro ao buscar pedidos:', error);
        }
    };

    // Classificar item
    const handleClassify = () => {
        if (!selectedItem) return;

        const currentType = selectedType; // Salvar o tipo atual antes do POST
        const currentSku = selectedItem.sku; // Salvar o SKU do item atual

        router.post(
            '/item-triage/classify',
            {
                sku: selectedItem.sku,
                name: selectedItem.name,
                item_type: selectedType,
                internal_product_id: selectedProduct || null,
            },
            {
                preserveScroll: true,
                onSuccess: (page) => {
                    toast.success('Item classificado com sucesso!');

                    // Salvar última classificação ANTES de selecionar próximo item
                    setLastClassifiedType(currentType);

                    // Atualizar items com os novos dados da página
                    const updatedItems = page.props.items as Item[];

                    // Buscar o índice do item atual no array ATUALIZADO
                    const currentIndex = updatedItems.findIndex(
                        (item) => item.sku === currentSku,
                    );

                    // Tentar selecionar próximo item não classificado após o atual
                    const nextUnclassified = updatedItems.find(
                        (item, idx) => idx > currentIndex && !item.mapping,
                    );

                    if (nextUnclassified) {
                        // Forçar o tipo para o último classificado
                        setTimeout(() => {
                            handleSelectItem(nextUnclassified);
                            setSelectedType(currentType);
                        }, 0);
                    } else {
                        // Se não houver próximo não classificado, pegar primeiro não classificado
                        const firstUnclassified = updatedItems.find(
                            (item) => !item.mapping,
                        );
                        if (firstUnclassified) {
                            setTimeout(() => {
                                handleSelectItem(firstUnclassified);
                                setSelectedType(currentType);
                            }, 0);
                        } else if (updatedItems.length > 0) {
                            // Se todos classificados, pegar primeiro da lista
                            handleSelectItem(updatedItems[0]);
                        } else {
                            setSelectedItem(null);
                            setSelectedType('');
                            setSelectedProduct('');
                        }
                    }
                },
                onError: () => {
                    toast.error('Erro ao classificar item');
                },
            },
        );
    };

    // Aplicar filtros
    const handleFilter = () => {
        router.get(
            '/item-triage',
            { search, status, item_type: itemType, link_status: linkStatus },
            { preserveState: true, preserveScroll: true },
        );
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
        }).format(value);
    };

    const formatDate = (date: string) => {
        return new Intl.DateTimeFormat('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        }).format(new Date(date));
    };

    return (
        <>
            <Head title="Triagem de Itens" />
            <AppLayout breadcrumbs={breadcrumbs}>
                <div className="flex flex-1 flex-col">
                    <div className="@container/main flex flex-1 flex-col gap-2">
                        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                            {/* Header */}
                            <div className="flex flex-col gap-4 px-4 lg:px-6">
                                <div className="flex flex-col gap-1">
                                    <h1 className="text-2xl font-bold">
                                        Triagem de Itens
                                    </h1>
                                    <p className="text-muted-foreground">
                                        Classifique e vincule produtos dos
                                        pedidos ao CMV
                                    </p>
                                </div>

                                {/* Estatísticas */}
                                <div className="grid gap-4 md:grid-cols-3">
                                    <Card>
                                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                            <CardTitle className="text-sm font-medium">
                                                Total de Itens
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-2xl font-bold">
                                                {stats.total_items}
                                            </div>
                                        </CardContent>
                                    </Card>
                                    <Card>
                                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                            <CardTitle className="text-sm font-medium">
                                                Pendentes
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-2xl font-bold text-orange-600">
                                                {stats.pending_items}
                                            </div>
                                        </CardContent>
                                    </Card>
                                    <Card>
                                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                            <CardTitle className="text-sm font-medium">
                                                Classificados
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-2xl font-bold text-green-600">
                                                {stats.classified_items}
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* Filtros */}
                                <div className="flex flex-col gap-2">
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <Search className="absolute top-2.5 left-2 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                placeholder="Buscar item..."
                                                value={search}
                                                onChange={(e) =>
                                                    setSearch(e.target.value)
                                                }
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        handleFilter();
                                                    }
                                                }}
                                                className="pl-8"
                                            />
                                        </div>
                                        <Button
                                            onClick={handleFilter}
                                            variant="secondary"
                                        >
                                            Filtrar
                                        </Button>
                                    </div>
                                    <div className="flex gap-2">
                                        <Select
                                            value={status}
                                            onValueChange={(value) => {
                                                setStatus(value);
                                                router.get(
                                                    '/item-triage',
                                                    {
                                                        search,
                                                        status: value,
                                                        item_type: itemType,
                                                        link_status: linkStatus,
                                                    },
                                                    {
                                                        preserveState: true,
                                                        preserveScroll: true,
                                                    },
                                                );
                                            }}
                                        >
                                            <SelectTrigger className="w-[180px]">
                                                <SelectValue placeholder="Status" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">
                                                    Todos
                                                </SelectItem>
                                                <SelectItem value="pending">
                                                    Não Classificados
                                                </SelectItem>
                                                <SelectItem value="classified">
                                                    Classificados
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>

                                        <Select
                                            value={itemType || 'all'}
                                            onValueChange={(value) => {
                                                const newValue =
                                                    value === 'all'
                                                        ? ''
                                                        : value;
                                                setItemType(newValue);
                                                router.get(
                                                    '/item-triage',
                                                    {
                                                        search,
                                                        status,
                                                        item_type: newValue,
                                                        link_status: linkStatus,
                                                    },
                                                    {
                                                        preserveState: true,
                                                        preserveScroll: true,
                                                    },
                                                );
                                            }}
                                        >
                                            <SelectTrigger className="w-[180px]">
                                                <SelectValue placeholder="Tipo" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">
                                                    Todos os tipos
                                                </SelectItem>
                                                {itemTypes.map((type) => (
                                                    <SelectItem
                                                        key={type.value}
                                                        value={type.value}
                                                    >
                                                        {type.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>

                                        <Select
                                            value={linkStatus || 'all'}
                                            onValueChange={(value) => {
                                                const newValue =
                                                    value === 'all'
                                                        ? ''
                                                        : value;
                                                setLinkStatus(newValue);
                                                router.get(
                                                    '/item-triage',
                                                    {
                                                        search,
                                                        status,
                                                        item_type: itemType,
                                                        link_status: newValue,
                                                    },
                                                    {
                                                        preserveState: true,
                                                        preserveScroll: true,
                                                    },
                                                );
                                            }}
                                        >
                                            <SelectTrigger className="w-[180px]">
                                                <SelectValue placeholder="Vínculo CMV" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">
                                                    Todos
                                                </SelectItem>
                                                <SelectItem value="linked">
                                                    Com produto vinculado
                                                </SelectItem>
                                                <SelectItem value="unlinked">
                                                    Sem produto vinculado
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>

                                        {(search ||
                                            status !== 'pending' ||
                                            itemType ||
                                            linkStatus) && (
                                            <Button
                                                variant="ghost"
                                                onClick={() => {
                                                    setSearch('');
                                                    setStatus('pending');
                                                    setItemType('');
                                                    setLinkStatus('');
                                                    router.get(
                                                        '/item-triage',
                                                        {},
                                                        {
                                                            preserveState: true,
                                                            preserveScroll: true,
                                                        },
                                                    );
                                                }}
                                            >
                                                Limpar filtros
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Layout de 2 colunas */}
                            <div className="grid gap-4 px-4 lg:grid-cols-2 lg:px-6">
                                {/* Lista de itens - Esquerda */}
                                <Card className="h-[calc(100vh-400px)] overflow-hidden">
                                    <CardHeader className="border-b">
                                        <CardTitle className="text-base">
                                            Itens ({items.length})
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="h-full overflow-y-auto p-0">
                                        <ul className="divide-y">
                                            {items.map((item, index) => (
                                                <li
                                                    key={`${item.sku}-${index}`}
                                                    className={`cursor-pointer p-4 transition-colors hover:bg-muted/50 ${
                                                        selectedItem?.sku ===
                                                        item.sku
                                                            ? 'bg-muted'
                                                            : ''
                                                    }`}
                                                    onClick={() =>
                                                        handleSelectItem(item)
                                                    }
                                                >
                                                    <div className="flex flex-col gap-2">
                                                        <div className="flex items-start justify-between">
                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-2">
                                                                    {item.is_addon && (
                                                                        <Badge
                                                                            variant="secondary"
                                                                            className="text-xs"
                                                                        >
                                                                            Add-on
                                                                        </Badge>
                                                                    )}
                                                                    <span className="font-medium">
                                                                        {
                                                                            item.name
                                                                        }
                                                                    </span>
                                                                </div>
                                                                <div className="text-xs text-muted-foreground">
                                                                    SKU:{' '}
                                                                    {item.sku}
                                                                </div>
                                                            </div>
                                                            <Badge variant="secondary">
                                                                {
                                                                    item.orders_count
                                                                }{' '}
                                                                ped
                                                            </Badge>
                                                        </div>
                                                        <div className="flex flex-wrap gap-1">
                                                            {item.mapping ? (
                                                                <>
                                                                    <Badge
                                                                        className={
                                                                            itemTypes.find(
                                                                                (
                                                                                    t,
                                                                                ) =>
                                                                                    t.value ===
                                                                                    item
                                                                                        .mapping
                                                                                        ?.item_type,
                                                                            )
                                                                                ?.color ||
                                                                            'bg-gray-100 text-gray-900'
                                                                        }
                                                                    >
                                                                        {itemTypes.find(
                                                                            (
                                                                                t,
                                                                            ) =>
                                                                                t.value ===
                                                                                item
                                                                                    .mapping
                                                                                    ?.item_type,
                                                                        )
                                                                            ?.label ||
                                                                            'Classificado'}
                                                                    </Badge>
                                                                    {item
                                                                        .mapping
                                                                        ?.internal_product_name && (
                                                                        <Badge
                                                                            variant="outline"
                                                                            className="border-green-200 bg-green-50 text-green-700"
                                                                        >
                                                                            CMV:{' '}
                                                                            {
                                                                                item
                                                                                    .mapping
                                                                                    ?.internal_product_name
                                                                            }
                                                                        </Badge>
                                                                    )}
                                                                </>
                                                            ) : (
                                                                <Badge
                                                                    variant="outline"
                                                                    className="border-orange-200 bg-orange-50 text-orange-700"
                                                                >
                                                                    Não
                                                                    classificado
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    </CardContent>
                                </Card>

                                {/* Detalhes do item - Direita */}
                                <Card className="h-[calc(100vh-400px)] overflow-hidden">
                                    <CardHeader className="border-b">
                                        <CardTitle className="text-base">
                                            {selectedItem
                                                ? selectedItem.name
                                                : 'Selecione um item'}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="h-full overflow-y-auto p-4">
                                        {selectedItem ? (
                                            <div className="flex flex-col gap-6">
                                                {/* Pedidos recentes */}
                                                <div>
                                                    <h3 className="mb-2 text-sm font-medium">
                                                        Pedidos recentes (
                                                        {recentOrders.length})
                                                    </h3>
                                                    <div className="space-y-2">
                                                        {recentOrders.map(
                                                            (order) => (
                                                                <div
                                                                    key={
                                                                        order.id
                                                                    }
                                                                    className="flex items-center justify-between rounded-md border p-2 text-sm"
                                                                >
                                                                    <div>
                                                                        <div className="font-medium">
                                                                            #
                                                                            {
                                                                                order.short_reference
                                                                            }
                                                                        </div>
                                                                        <div className="text-xs text-muted-foreground">
                                                                            {formatDate(
                                                                                order.placed_at,
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    <Badge variant="outline">
                                                                        {
                                                                            order.qty
                                                                        }
                                                                        x
                                                                    </Badge>
                                                                </div>
                                                            ),
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Classificar como */}
                                                <div>
                                                    <h3 className="mb-3 text-sm font-medium">
                                                        Classificar como (Editar
                                                        para confirmar):
                                                    </h3>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        {itemTypes.map(
                                                            (type) => {
                                                                const Icon =
                                                                    type.icon;
                                                                return (
                                                                    <Button
                                                                        key={
                                                                            type.value
                                                                        }
                                                                        variant={
                                                                            selectedType ===
                                                                            type.value
                                                                                ? 'default'
                                                                                : 'outline'
                                                                        }
                                                                        className="justify-start"
                                                                        onClick={() =>
                                                                            setSelectedType(
                                                                                type.value,
                                                                            )
                                                                        }
                                                                    >
                                                                        <Icon className="mr-2 h-4 w-4" />
                                                                        {
                                                                            type.label
                                                                        }
                                                                    </Button>
                                                                );
                                                            },
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Vincular produto CMV */}
                                                <div>
                                                    <h3 className="mb-2 text-sm font-medium">
                                                        Vincular produto CMV
                                                        (opcional):
                                                    </h3>
                                                    <div className="flex gap-2">
                                                        <Select
                                                            value={
                                                                selectedProduct ||
                                                                undefined
                                                            }
                                                            onValueChange={(
                                                                value,
                                                            ) => {
                                                                setSelectedProduct(
                                                                    value,
                                                                );
                                                            }}
                                                        >
                                                            <SelectTrigger className="flex-1">
                                                                <SelectValue placeholder="Nenhum (opcional)" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {internalProducts.map(
                                                                    (
                                                                        product,
                                                                    ) => (
                                                                        <SelectItem
                                                                            key={
                                                                                product.id
                                                                            }
                                                                            value={product.id.toString()}
                                                                        >
                                                                            {
                                                                                product.name
                                                                            }{' '}
                                                                            -{' '}
                                                                            {formatCurrency(
                                                                                product.unit_cost,
                                                                            )}
                                                                        </SelectItem>
                                                                    ),
                                                                )}
                                                            </SelectContent>
                                                        </Select>
                                                        {selectedProduct && (
                                                            <Button
                                                                variant="outline"
                                                                size="icon"
                                                                onClick={() =>
                                                                    setSelectedProduct(
                                                                        '',
                                                                    )
                                                                }
                                                            >
                                                                ×
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Botão confirmar */}
                                                <div className="space-y-2">
                                                    <Button
                                                        ref={classifyButtonRef}
                                                        onClick={handleClassify}
                                                        disabled={!selectedType}
                                                        className="w-full"
                                                    >
                                                        Confirmar Classificação
                                                    </Button>
                                                    <p className="text-center text-xs text-muted-foreground">
                                                        Pressione{' '}
                                                        <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs">
                                                            Enter
                                                        </kbd>{' '}
                                                        para confirmar
                                                    </p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex h-full items-center justify-center text-muted-foreground">
                                                Selecione um item na lista à
                                                esquerda
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </div>
                </div>
            </AppLayout>
        </>
    );
}
