import {
    ColumnFiltersState,
    flexRender,
    getCoreRowModel,
    getExpandedRowModel,
    getFilteredRowModel,
    getSortedRowModel,
    SortingState,
    useReactTable,
    VisibilityState,
} from '@tanstack/react-table';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Table,
    TableBody,
    TableCell,
    TableFooter,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    IconArrowDown,
    IconArrowsSort,
    IconArrowUp,
    IconChevronDown,
    IconChevronLeft,
    IconChevronRight,
    IconChevronsLeft,
    IconChevronsRight,
    IconLayoutColumns,
} from '@tabler/icons-react';
import { OrderActionsCell } from './order-actions-cell';

/**
 * Calcula o custo de um item considerando múltiplas associações
 */
function calculateItemCost(item: any): number {
    // Prioridade 1: Usar total_cost calculado pelo backend (mais confiável)
    if (item.total_cost !== undefined && item.total_cost !== null) {
        return parseFloat(String(item.total_cost));
    }

    // Prioridade 2: Calcular no frontend (fallback)
    const itemQuantity = item.qty || item.quantity || 0;

    // Novo sistema: usar mappings se existir
    if (item.mappings && item.mappings.length > 0) {
        const mappingsCost = item.mappings.reduce(
            (sum: number, mapping: any) => {
                if (mapping.internal_product?.unit_cost) {
                    const unitCost = parseFloat(
                        mapping.internal_product.unit_cost,
                    );
                    const mappingQuantity = mapping.quantity || 1;
                    return sum + unitCost * mappingQuantity;
                }
                return sum;
            },
            0,
        );
        return mappingsCost * itemQuantity;
    }

    // Fallback: sistema legado (internal_product direto)
    if (item.internal_product?.unit_cost) {
        const unitCost = parseFloat(item.internal_product.unit_cost);
        return unitCost * itemQuantity;
    }

    return 0;
}

import { DateRangePicker } from '@/components/date-range-picker';
import { columns, Order } from '@/components/orders/columns';
import { OrderIndicators } from '@/components/orders/indicators';
import { ItemMappingsDialog } from '@/components/orders/item-mappings-dialog';
import { OrderExpandedDetails } from '@/components/orders/order-expanded-details';
import { OrderFinancialCard } from '@/components/orders/order-financial-card';
import { QuickAssociateDialog } from '@/components/orders/quick-associate-dialog';
import { SyncTakeatDialog } from '@/components/orders/sync-takeat-dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MultiSelect } from '@/components/ui/multi-select';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Link, router } from '@inertiajs/react';
import {
    AlertCircle,
    Ban,
    Calendar,
    CreditCard,
    RefreshCw,
} from 'lucide-react';
import { DateRange } from 'react-day-picker';
import { toast } from 'sonner';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '../ui/dropdown-menu';

type Pagination = {
    current_page: number;
    last_page: number;
    per_page: number;
    from: number;
    to: number;
    total: number;
    next_page_url?: string | null;
    prev_page_url?: string | null;
};

type Filters = {
    search?: string;
    status?: string;
    provider?: string;
    order_type?: string;
    store_id?: number | string;
    start_date?: string;
    end_date?: string;
    unmapped_only?: string;
    per_page?: number;
    page?: number;
};

export function DataTable({
    data,
    pagination,
    filters,
    stores,
    providerOptions = [],
    unmappedProductsCount = 0,
    noPaymentMethodCount = 0,
    noPaymentInfoCount = 0,
    internalProducts = [],
    marginSettings,
    indicators,
}: {
    data: Order[];
    pagination: Pagination;
    filters: Filters;
    stores: { id: number; name: string }[];
    providerOptions?: Array<{ value: string; label: string }>;
    unmappedProductsCount?: number;
    noPaymentMethodCount?: number;
    noPaymentInfoCount?: number;
    internalProducts?: Array<{
        id: number;
        name: string;
        sku: string | null;
        unit_cost: string;
    }>;
    marginSettings?: {
        margin_excellent: number;
        margin_good_min: number;
        margin_good_max: number;
        margin_poor: number;
    };
    indicators: {
        subtotal: number;
        averageTicket: number;
        cmv: number;
        netRevenue: number;
        orderCount: number;
    };
}) {
    const [sorting, setSorting] = React.useState<SortingState>([
        { id: 'placed_at', desc: true }, // 🔧 padrão: ordenado por data
    ]);

    const [associateDialogOpen, setAssociateDialogOpen] = React.useState(false);
    const [itemMappingsDialogOpen, setItemMappingsDialogOpen] =
        React.useState(false);
    const [selectedItem, setSelectedItem] = React.useState<any | null>(null);
    const [selectedOrder, setSelectedOrder] = React.useState<Order | null>(
        null,
    );
    const selectedOrderIdRef = React.useRef<number | null>(null);

    // Estados para sincronização Takeat
    const [syncDialogOpen, setSyncDialogOpen] = React.useState(false);
    const [isSyncingToday, setIsSyncingToday] = React.useState(false);

    // Atualizar selectedOrder quando os dados mudarem
    React.useEffect(() => {
        if (selectedOrderIdRef.current && data) {
            const updatedOrder = data.find(
                (o) => o.id === selectedOrderIdRef.current,
            );
            if (updatedOrder) {
                setSelectedOrder(updatedOrder);
            }
        }
    }, [data]);

    // Atualizar ref quando selectedOrder muda
    React.useEffect(() => {
        selectedOrderIdRef.current = selectedOrder?.id || null;
    }, [selectedOrder]);

    // Adicionar botão de associar na coluna de ações
    const columnsWithAssociate = React.useMemo(() => {
        return columns.map((col) => {
            // Modificar a coluna de ações para incluir o botão de associar
            if (col.id === 'actions') {
                return {
                    ...col,
                    cell: ({ row }: { row: any }) => {
                        const order = row.original as Order;
                        const orderType = order.raw?.orderType || 'DELIVERY';
                        const handshakeDispute =
                            order.raw?.handshakeDispute ?? null;

                        // Contar items sem associação
                        const unmappedCount =
                            order.items?.filter((item) => {
                                return (
                                    !item.internal_product &&
                                    (!item.mappings ||
                                        item.mappings.length === 0)
                                );
                            }).length || 0;

                        return (
                            <div className="flex items-center gap-1">
                                {/* Botão de associar produtos */}
                                {/* Temporariamente escondido - usar Triagem de Itens */}
                                {/* {unmappedCount > 0 && (
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="relative h-7 w-7 shrink-0"
                                        onClick={() => {
                                            setSelectedOrder(order);
                                            setAssociateDialogOpen(true);
                                        }}
                                        title={`${unmappedCount} produto(s) sem associação`}
                                    >
                                        <Link2 className="h-3.5 w-3.5" />
                                        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                                            {unmappedCount}
                                        </span>
                                    </Button>
                                )} */}

                                {/* Ações do pedido (confirmar, despachar, etc) */}
                                <OrderActionsCell
                                    orderId={order.id}
                                    orderStatus={order.status}
                                    orderType={orderType}
                                    provider={order.provider}
                                    handshakeDispute={handshakeDispute}
                                />
                            </div>
                        );
                    },
                };
            }
            return col;
        });
    }, []);

    const [dateRange, setDateRange] = React.useState<DateRange | undefined>(
        () => {
            const from = filters?.start_date
                ? new Date(filters.start_date + 'T12:00:00')
                : undefined;
            const to = filters?.end_date
                ? new Date(filters.end_date + 'T12:00:00')
                : undefined;
            return { from, to };
        },
    );

    const [columnFilters, setColumnFilters] =
        React.useState<ColumnFiltersState>([]);

    // Carregar columnVisibility do localStorage ou usar padrão
    const [columnVisibility, setColumnVisibility] =
        React.useState<VisibilityState>(() => {
            const stored = localStorage.getItem('orders-column-visibility');
            if (stored) {
                try {
                    return JSON.parse(stored);
                } catch {
                    // Se houver erro ao parsear, usar padrão
                }
            }
            return {
                margin: true,
                net_total: true,
                total: true,
                cost: true,
                tax: true,
                extra_cost: true,
                code: true,
            };
        });

    // Salvar columnVisibility no localStorage quando mudar
    React.useEffect(() => {
        localStorage.setItem(
            'orders-column-visibility',
            JSON.stringify(columnVisibility),
        );
    }, [columnVisibility]);

    // Estado local para payment_method (multiselect)
    const [localPaymentMethods, setLocalPaymentMethods] = React.useState<
        string[]
    >(() => (filters?.payment_method ? filters.payment_method.split(',') : []));

    // Sincronizar estado local com filtros do servidor
    React.useEffect(() => {
        const serverMethods = filters?.payment_method
            ? filters.payment_method.split(',')
            : [];
        setLocalPaymentMethods(serverMethods);
    }, [filters?.payment_method]);

    // Estado local para search com debounce
    const [searchValue, setSearchValue] = React.useState(filters?.search ?? '');

    // Sincronizar searchValue quando filters.search mudar externamente
    React.useEffect(() => {
        setSearchValue(filters?.search ?? '');
    }, [filters?.search]);

    // Debounce para search (500ms)
    React.useEffect(() => {
        const timer = setTimeout(() => {
            const normalizedSearch = searchValue || undefined;
            const currentSearch = filters?.search || undefined;

            if (normalizedSearch !== currentSearch) {
                updateFilters({ search: normalizedSearch });
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [searchValue]);

    // Função para sincronizar pedidos de hoje
    const handleSyncToday = async () => {
        setIsSyncingToday(true);

        try {
            const response = await fetch('/takeat/sync/today', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN':
                        document
                            .querySelector('meta[name="csrf-token"]')
                            ?.getAttribute('content') || '',
                },
            });

            const data = await response.json();

            if (!response.ok) {
                // Erro 419: Token CSRF expirado - recarregar página
                if (response.status === 419) {
                    toast.error('Sessão expirada. Recarregando a página...', {
                        duration: 3000,
                    });
                    setTimeout(() => {
                        window.location.reload();
                    }, 1000);
                    return;
                }

                throw new Error(data.message || 'Erro ao sincronizar');
            }

            toast.success('Pedidos de hoje sincronizados com sucesso!');
            router.reload({ only: ['orders'] });
        } catch (error: any) {
            // Se não foi tratado acima, mostrar mensagem genérica
            if (error.message !== 'Sessão expirada. Recarregando a página...') {
                toast.error(
                    error.message ||
                        'Erro ao sincronizar pedidos. Tente novamente.',
                );
            }
        } finally {
            setIsSyncingToday(false);
        }
    };

    // Atualiza filtros mantendo per_page
    const updateFilters = (newFilters: Partial<Filters>, resetPage = true) => {
        const merged = {
            ...filters,
            per_page: filters?.per_page ?? pagination?.per_page ?? 20,
            ...newFilters,
            ...(resetPage ? { page: 1 } : {}),
        };

        // Remover chaves com valores undefined
        Object.keys(merged).forEach((key) => {
            if (merged[key as keyof Filters] === undefined) {
                delete merged[key as keyof Filters];
            }
        });

        router.get('/orders', merged, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    // Helper para construir URL de paginação com todos os filtros
    const buildPageUrl = (page: number) => {
        const params = new URLSearchParams();

        // Adicionar todos os filtros atuais
        Object.entries(filters || {}).forEach(([key, value]) => {
            if (value !== null && value !== undefined && value !== '') {
                params.append(key, String(value));
            }
        });

        // Adicionar página e per_page
        params.set('page', String(page));
        params.set(
            'per_page',
            String(filters?.per_page ?? pagination?.per_page ?? 20),
        );

        return `/orders?${params.toString()}`;
    };

    const table = useReactTable({
        data,
        columns: columnsWithAssociate,
        state: {
            sorting,
            columnFilters,
            columnVisibility,
        },
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onColumnVisibilityChange: setColumnVisibility,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getExpandedRowModel: getExpandedRowModel(),
        meta: {
            marginSettings,
        },
    });

    return (
        <div className="flex w-full flex-col gap-4 px-4 lg:px-6">
            {/* Avisos minimalistas no topo */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-2">
                    {/* Aviso: Produtos não associados */}
                    {(unmappedProductsCount ?? 0) > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-9 gap-2 border border-red-200 bg-red-50 text-red-900 hover:bg-red-100 hover:text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100 dark:hover:bg-red-900"
                            onClick={() =>
                                updateFilters({ unmapped_only: '1' })
                            }
                        >
                            <AlertCircle className="h-4 w-4" />
                            <span className="font-medium">
                                {unmappedProductsCount} não associados
                            </span>
                        </Button>
                    )}

                    {/* Aviso: Pedidos sem método de pagamento */}
                    {(noPaymentMethodCount ?? 0) > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-9 gap-2 border border-orange-200 bg-orange-50 text-orange-900 hover:bg-orange-100 hover:text-orange-900 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-100 dark:hover:bg-orange-900"
                            onClick={() =>
                                updateFilters({ no_payment_method: '1' })
                            }
                        >
                            <CreditCard className="h-4 w-4" />
                            <span className="font-medium">
                                {noPaymentMethodCount} sem taxa vinculada
                            </span>
                        </Button>
                    )}

                    {/* Aviso: Pedidos sem pagamento */}
                    {(noPaymentInfoCount ?? 0) > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-9 gap-2 border border-gray-200 bg-gray-50 text-gray-900 hover:bg-gray-100 hover:text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
                            onClick={() =>
                                updateFilters({ no_payment_info: '1' })
                            }
                        >
                            <Ban className="h-4 w-4" />
                            <span className="font-medium">
                                {noPaymentInfoCount} sem pagamento
                            </span>
                        </Button>
                    )}
                </div>

                {/* Botões de sincronização Takeat */}
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSyncToday}
                        disabled={isSyncingToday}
                        title="Sincronizar pedidos de hoje"
                    >
                        <RefreshCw
                            className={`h-4 w-4 ${isSyncingToday ? 'animate-spin' : ''}`}
                        />
                        <span className="ml-2">Sincronizar Hoje</span>
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSyncDialogOpen(true)}
                        title="Sincronizar período específico"
                    >
                        <Calendar className="h-4 w-4" />
                        <span className="ml-2">Sincronizar Data</span>
                    </Button>
                </div>
            </div>

            {/* Indicadores do período */}
            <OrderIndicators data={indicators} />

            {/* 🔎 Filtros */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                    {/* Badge de filtro ativo - produtos não associados */}
                    {filters?.unmapped_only && (
                        <Badge variant="destructive" className="h-9 gap-2 px-3">
                            Apenas não associados
                            <button
                                onClick={() =>
                                    updateFilters({ unmapped_only: undefined })
                                }
                                className="ml-1 rounded-full hover:bg-red-700"
                            >
                                <svg
                                    className="h-4 w-4"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M6 18L18 6M6 6l12 12"
                                    />
                                </svg>
                            </button>
                        </Badge>
                    )}

                    {/* Badge de filtro ativo - sem método de pagamento */}
                    {filters?.no_payment_method && (
                        <Badge variant="destructive" className="h-9 gap-2 px-3">
                            Sem taxa vinculada
                            <button
                                onClick={() =>
                                    updateFilters({
                                        no_payment_method: undefined,
                                    })
                                }
                                className="ml-1 rounded-full hover:bg-red-700"
                            >
                                <svg
                                    className="h-4 w-4"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M6 18L18 6M6 6l12 12"
                                    />
                                </svg>
                            </button>
                        </Badge>
                    )}

                    {/* Badge de filtro ativo - sem pagamento */}
                    {filters?.no_payment_info && (
                        <Badge variant="secondary" className="h-9 gap-2 px-3">
                            Sem pagamento
                            <button
                                onClick={() =>
                                    updateFilters({
                                        no_payment_info: undefined,
                                    })
                                }
                                className="ml-1 rounded-full hover:bg-gray-700"
                            >
                                <svg
                                    className="h-4 w-4"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M6 18L18 6M6 6l12 12"
                                    />
                                </svg>
                            </button>
                        </Badge>
                    )}

                    {/* Badge de filtro ativo - tipo de pedido */}
                    {filters?.order_type && (
                        <Badge variant="secondary" className="h-9 gap-2 px-3">
                            {filters.order_type === 'delivery' && '🚗 Delivery'}
                            {filters.order_type === 'takeout' && '🛍️ Retirada'}
                            {filters.order_type === 'balcony' && '🏪 Balcão'}
                            {filters.order_type === 'self-service' &&
                                '🍽️ Autoatendimento'}
                            <button
                                onClick={() =>
                                    updateFilters({
                                        order_type: undefined,
                                    })
                                }
                                className="ml-1 rounded-full hover:bg-gray-400"
                            >
                                <svg
                                    className="h-4 w-4"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M6 18L18 6M6 6l12 12"
                                    />
                                </svg>
                            </button>
                        </Badge>
                    )}

                    {/* Buscar por código */}
                    <Input
                        placeholder="Buscar pedido..."
                        value={searchValue}
                        onChange={(e) => setSearchValue(e.target.value)}
                        className="h-9 w-[200px]"
                    />

                    {/* Filtro por status */}
                    <Combobox
                        options={[
                            { value: 'all', label: 'Todos os status' },
                            { value: 'PLACED', label: 'Novo' },
                            { value: 'CONFIRMED', label: 'Confirmado' },
                            {
                                value: 'SEPARATION_START',
                                label: 'Separação iniciada',
                            },
                            {
                                value: 'SEPARATION_END',
                                label: 'Separação finalizada',
                            },
                            {
                                value: 'READY_TO_PICKUP',
                                label: 'Pronto para retirada',
                            },
                            { value: 'DISPATCHED', label: 'Despachado' },
                            { value: 'CONCLUDED', label: 'Concluído' },
                            { value: 'CANCELLED', label: 'Cancelado' },
                        ]}
                        placeholder="Filtrar status"
                        value={filters?.status ?? 'all'}
                        onChange={(value) =>
                            updateFilters({
                                status: value === 'all' ? undefined : value,
                            })
                        }
                    />

                    {/* Filtro por loja */}
                    <Combobox
                        options={[
                            { value: 'all', label: 'Todas as lojas' },
                            ...stores.map((s) => ({
                                value: String(s.id),
                                label: s.name,
                            })),
                        ]}
                        placeholder="Filtrar loja"
                        value={
                            filters?.store_id ? String(filters.store_id) : 'all'
                        }
                        onChange={(value) =>
                            updateFilters({
                                store_id:
                                    value === 'all' ? undefined : Number(value),
                            })
                        }
                    />

                    {/* Filtro por canal */}
                    <Combobox
                        options={[
                            { value: 'all', label: 'Todos os canais' },
                            ...providerOptions,
                        ]}
                        placeholder="Filtrar canal"
                        value={filters?.provider ?? 'all'}
                        onChange={(value) =>
                            updateFilters({
                                provider: value === 'all' ? undefined : value,
                            })
                        }
                    />

                    {/* Filtro por meio de pagamento */}
                    <MultiSelect
                        options={[
                            { value: 'CASH', label: 'Dinheiro' },
                            { value: 'CREDIT', label: 'Crédito' },
                            { value: 'DEBIT', label: 'Débito' },
                            { value: 'PIX', label: 'PIX' },
                            { value: 'VOUCHER', label: 'Voucher' },
                            { value: 'ONLINE', label: 'Online' },
                        ]}
                        placeholder="Meio de pagamento"
                        values={localPaymentMethods}
                        onChange={(values) => {
                            setLocalPaymentMethods(values);
                            updateFilters({
                                payment_method:
                                    values.length > 0
                                        ? values.join(',')
                                        : undefined,
                            });
                        }}
                        searchPlaceholder="Buscar método..."
                        className="w-[200px]"
                    />

                    {/* Filtro por tipo de pedido */}
                    <Combobox
                        options={[
                            { value: 'all', label: 'Todos os tipos' },
                            { value: 'delivery', label: '🚗 Delivery' },
                            { value: 'takeout', label: '🛍️ Retirada' },
                            { value: 'balcony', label: '🏪 Balcão' },
                            {
                                value: 'self-service',
                                label: '🍽️ Autoatendimento',
                            },
                        ]}
                        placeholder="Filtrar tipo"
                        value={filters?.order_type ?? 'all'}
                        onChange={(value) =>
                            updateFilters({
                                order_type: value === 'all' ? undefined : value,
                            })
                        }
                    />

                    {/* 📅 Date Range */}
                    <DateRangePicker
                        value={dateRange}
                        onChange={(range) => {
                            setDateRange(range);
                            updateFilters({
                                start_date: range?.from
                                    ? range.from.toISOString().split('T')[0]
                                    : undefined,
                                end_date: range?.to
                                    ? range.to.toISOString().split('T')[0]
                                    : undefined,
                            });
                        }}
                    />
                </div>

                {/* 👁️ Colunas visíveis */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                            <IconLayoutColumns />
                            <span className="ml-2">Colunas</span>
                            <IconChevronDown />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                        {table
                            .getAllColumns()
                            .filter(
                                (column) =>
                                    typeof column.accessorFn !== 'undefined' &&
                                    column.getCanHide(),
                            )
                            .map((column) => (
                                <DropdownMenuCheckboxItem
                                    key={column.id}
                                    checked={column.getIsVisible()}
                                    onCheckedChange={(value) =>
                                        column.toggleVisibility(!!value)
                                    }
                                >
                                    {column.columnDef.meta?.label ||
                                        (typeof column.columnDef.header ===
                                        'string'
                                            ? column.columnDef.header
                                            : column.id)}
                                </DropdownMenuCheckboxItem>
                            ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* 📋 Tabela */}
            <div className="mt-4 overflow-hidden rounded-lg border">
                <Table className="text-xs lg:text-sm">
                    <TableHeader className="sticky top-0 z-10 bg-muted">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => {
                                    const sorted = header.column.getIsSorted();

                                    // Colunas que NÃO têm order_by
                                    const nonSortableColumns = [
                                        'expand', // primeira (se tiver)
                                        'provider', // Canal
                                        'actions', // última (botões)
                                        'status',
                                    ];

                                    const isSortable =
                                        header.column.getCanSort?.() &&
                                        !nonSortableColumns.includes(
                                            header.column.id,
                                        );

                                    // Colunas numéricas que devem alinhar à direita
                                    const isNumeric = [
                                        'total',
                                        'cost',
                                        'tax',
                                        'extra_cost',
                                        'total_costs',
                                        'total_commissions',
                                        'payment_fees',
                                        'net_total',
                                        'margin',
                                    ].includes(header.column.id);

                                    return (
                                        <TableHead
                                            key={header.id}
                                            className={` ${isNumeric ? 'text-end' : 'text-start'} ${isSortable ? 'cursor-pointer select-none hover:bg-muted/60' : ''} `}
                                            onClick={
                                                isSortable
                                                    ? header.column.getToggleSortingHandler()
                                                    : undefined
                                            }
                                        >
                                            <div
                                                className={`flex items-center gap-1 ${
                                                    isNumeric
                                                        ? 'justify-end'
                                                        : ''
                                                }`}
                                            >
                                                {flexRender(
                                                    header.column.columnDef
                                                        .header,
                                                    header.getContext(),
                                                )}

                                                {/* 🔽 Ícones só aparecem se a coluna for ordenável */}
                                                {isSortable && (
                                                    <>
                                                        {sorted === 'asc' && (
                                                            <IconArrowUp
                                                                size={14}
                                                            />
                                                        )}
                                                        {sorted === 'desc' && (
                                                            <IconArrowDown
                                                                size={14}
                                                            />
                                                        )}
                                                        {!sorted && (
                                                            <IconArrowsSort
                                                                size={14}
                                                                className="opacity-30"
                                                            />
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </TableHead>
                                    );
                                })}
                            </TableRow>
                        ))}
                    </TableHeader>

                    <TableBody>
                        {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <React.Fragment key={row.id}>
                                    {/* Linha principal */}
                                    <TableRow
                                        className={`bg-card ${row.getIsExpanded() ? 'border-b-0' : ''}`}
                                    >
                                        {row.getVisibleCells().map((cell) => (
                                            <TableCell
                                                key={cell.id}
                                                className={
                                                    // Alinha à direita se for coluna de valores
                                                    [
                                                        'total',
                                                        'cost',
                                                        'tax',
                                                        'extra_cost',
                                                        'net_total',
                                                        'margin',
                                                        'expand',
                                                    ].includes(cell.column.id)
                                                        ? 'text-end'
                                                        : 'text-start'
                                                }
                                            >
                                                {flexRender(
                                                    cell.column.columnDef.cell,
                                                    cell.getContext(),
                                                )}
                                            </TableCell>
                                        ))}
                                    </TableRow>

                                    {/* Linha expandida */}
                                    {row.getIsExpanded() && (
                                        <TableRow className="bg-card hover:bg-card">
                                            <TableCell
                                                colSpan={columns.length + 1}
                                                className="border-t-0 p-0" // 🔥 remove a borda superior
                                            >
                                                <div className="grid grid-cols-1 gap-4 p-4 duration-300 animate-in slide-in-from-top-2 xl:grid-cols-2">
                                                    {/* Coluna 1: Itens + Observações */}
                                                    <div className="flex flex-col gap-4">
                                                        {/* Card: Itens do pedido */}
                                                        <Card className="h-fit gap-1 border-0 bg-gray-100 p-1 shadow-none dark:bg-neutral-950">
                                                            <CardHeader className="gap-0 bg-gray-100 px-2 py-2 dark:bg-neutral-950">
                                                                <CardTitle className="flex items-center gap-1 font-semibold">
                                                                    Itens do
                                                                    Pedido{' '}
                                                                    <Badge className="text-14px/[16px] bg-gray-200 px-3 py-0 text-gray-600">
                                                                        {(() => {
                                                                            const items =
                                                                                row
                                                                                    .original
                                                                                    .raw
                                                                                    ?.items ||
                                                                                row
                                                                                    .original
                                                                                    .items ||
                                                                                [];
                                                                            return items.length;
                                                                        })()}
                                                                    </Badge>
                                                                </CardTitle>
                                                            </CardHeader>
                                                            <CardContent className="rounded-md bg-card p-0">
                                                                <ul className="m-0 flex w-full basis-full list-none flex-col gap-2 pt-2 pl-0">
                                                                    {/* Cabeçalho */}
                                                                    <li className="hidden flex-wrap items-center gap-2 px-3 py-2 md:flex">
                                                                        <span className="text-start leading-4 font-bold no-underline md:min-w-[32px]">
                                                                            Qtd.
                                                                        </span>
                                                                        <span className="grow text-start leading-4 font-bold no-underline">
                                                                            Item
                                                                        </span>
                                                                        <span className="hidden text-end leading-4 font-bold no-underline md:flex md:min-w-[120px] md:justify-end">
                                                                            Valor
                                                                            unitário
                                                                        </span>
                                                                        <span className="text-end leading-4 font-bold no-underline md:min-w-[120px]">
                                                                            Subtotal
                                                                        </span>
                                                                    </li>

                                                                    {/* Itens do pedido */}
                                                                    {(() => {
                                                                        const order =
                                                                            row.original;
                                                                        let items =
                                                                            [];

                                                                        // Para Takeat: mesclar dados do raw (valores corretos) com dados do banco (associações)
                                                                        if (
                                                                            order.provider ===
                                                                                'takeat' &&
                                                                            order
                                                                                .raw
                                                                                ?.basket
                                                                                ?.orders
                                                                        ) {
                                                                            const rawItems =
                                                                                order
                                                                                    .raw
                                                                                    .basket
                                                                                    .orders;
                                                                            const dbItems =
                                                                                order.items ||
                                                                                [];

                                                                            items =
                                                                                rawItems.map(
                                                                                    (
                                                                                        rawItem: any,
                                                                                        index: number,
                                                                                    ) => {
                                                                                        // Encontrar item correspondente no banco pelo índice ou SKU
                                                                                        const dbItem =
                                                                                            dbItems.find(
                                                                                                (
                                                                                                    db: any,
                                                                                                ) =>
                                                                                                    db.sku ===
                                                                                                        rawItem.product?.id?.toString() ||
                                                                                                    db.name ===
                                                                                                        rawItem
                                                                                                            .product
                                                                                                            ?.name,
                                                                                            ) ||
                                                                                            dbItems[
                                                                                                index
                                                                                            ];

                                                                                        // Mapear complement_categories para options (para exibição)
                                                                                        const options: any[] =
                                                                                            [];
                                                                                        if (
                                                                                            rawItem.complement_categories
                                                                                        ) {
                                                                                            rawItem.complement_categories.forEach(
                                                                                                (
                                                                                                    cat: any,
                                                                                                ) => {
                                                                                                    cat.order_complements?.forEach(
                                                                                                        (
                                                                                                            comp: any,
                                                                                                        ) => {
                                                                                                            options.push(
                                                                                                                {
                                                                                                                    id: comp.id,
                                                                                                                    name:
                                                                                                                        comp
                                                                                                                            .complement
                                                                                                                            ?.name ||
                                                                                                                        '',
                                                                                                                    quantity:
                                                                                                                        comp.amount ||
                                                                                                                        1,
                                                                                                                    unitPrice: 0,
                                                                                                                    price: 0,
                                                                                                                    totalPrice: 0,
                                                                                                                },
                                                                                                            );
                                                                                                        },
                                                                                                    );
                                                                                                },
                                                                                            );
                                                                                        }

                                                                                        // Mesclar dados: valores do raw + associações do banco
                                                                                        return {
                                                                                            id:
                                                                                                dbItem?.id ||
                                                                                                rawItem.id,
                                                                                            qty:
                                                                                                rawItem.amount ||
                                                                                                1,
                                                                                            quantity:
                                                                                                rawItem.amount ||
                                                                                                1,
                                                                                            name:
                                                                                                rawItem
                                                                                                    .product
                                                                                                    ?.name ||
                                                                                                '',
                                                                                            sku:
                                                                                                dbItem?.sku ||
                                                                                                rawItem.product?.id?.toString(),
                                                                                            price: parseFloat(
                                                                                                rawItem.price ||
                                                                                                    0,
                                                                                            ),
                                                                                            unit_price:
                                                                                                parseFloat(
                                                                                                    rawItem.price ||
                                                                                                        0,
                                                                                                ),
                                                                                            total_price:
                                                                                                parseFloat(
                                                                                                    rawItem.total_price ||
                                                                                                        0,
                                                                                                ),
                                                                                            // Dados do banco (associações)
                                                                                            internal_product:
                                                                                                dbItem?.internal_product,
                                                                                            mappings:
                                                                                                dbItem?.mappings ||
                                                                                                [],
                                                                                            add_ons:
                                                                                                dbItem?.add_ons ||
                                                                                                [],
                                                                                            complement_categories:
                                                                                                rawItem.complement_categories ||
                                                                                                [],
                                                                                            options:
                                                                                                options,
                                                                                            observations:
                                                                                                dbItem?.observations,
                                                                                        };
                                                                                    },
                                                                                );
                                                                        } else {
                                                                            // Para iFood e outros: usar raw.items ou items do banco
                                                                            items =
                                                                                order
                                                                                    .raw
                                                                                    ?.items ||
                                                                                order.items ||
                                                                                [];
                                                                        }

                                                                        const displayItems =
                                                                            items.map(
                                                                                (
                                                                                    item: any,
                                                                                ) => ({
                                                                                    id: item.id,
                                                                                    quantity:
                                                                                        item.qty ||
                                                                                        item.quantity ||
                                                                                        0,
                                                                                    name: item.name,
                                                                                    unitPrice:
                                                                                        item.unit_price ||
                                                                                        item.unitPrice ||
                                                                                        item.price ||
                                                                                        0,
                                                                                    totalPrice:
                                                                                        item.total_price ||
                                                                                        item.totalPrice ||
                                                                                        (item.unit_price ||
                                                                                            item.unitPrice ||
                                                                                            item.price ||
                                                                                            0) *
                                                                                            (item.qty ||
                                                                                                item.quantity ||
                                                                                                0) ||
                                                                                        0,
                                                                                    observations:
                                                                                        item.observations,
                                                                                    options:
                                                                                        item.options ||
                                                                                        [],
                                                                                    add_ons:
                                                                                        item.add_ons ||
                                                                                        [],
                                                                                    internal_product:
                                                                                        item.internal_product,
                                                                                    mappings:
                                                                                        item.mappings ||
                                                                                        [],
                                                                                    sku: item.sku,
                                                                                }),
                                                                            );

                                                                        return displayItems.map(
                                                                            (
                                                                                item: any,
                                                                                index: number,
                                                                            ) => (
                                                                                <li
                                                                                    key={`${item.id}-${index}`}
                                                                                    className="flex flex-wrap items-center gap-2 px-3 py-2"
                                                                                >
                                                                                    {/* Produto principal (1º nível) */}
                                                                                    <span className="md:min-w-[32px]">
                                                                                        {
                                                                                            item.quantity
                                                                                        }

                                                                                        x
                                                                                    </span>
                                                                                    <span className="grow font-medium">
                                                                                        <div className="flex items-center gap-2">
                                                                                            <span>
                                                                                                {
                                                                                                    item.name
                                                                                                }
                                                                                            </span>
                                                                                            {/* Botão Pencil temporariamente escondido - usar Triagem de Itens */}
                                                                                            {/* <Button
                                                                                                size="icon"
                                                                                                variant="ghost"
                                                                                                className="h-6 w-6"
                                                                                                onClick={() => {
                                                                                                    setSelectedItem(
                                                                                                        item,
                                                                                                    );
                                                                                                    setItemMappingsDialogOpen(
                                                                                                        true,
                                                                                                    );
                                                                                                }}
                                                                                                title="Editar associações"
                                                                                            >
                                                                                                <Pencil className="h-3 w-3" />
                                                                                            </Button> */}
                                                                                        </div>
                                                                                        {item.observations && (
                                                                                            <div className="mt-1 text-xs text-muted-foreground italic">
                                                                                                Obs:{' '}
                                                                                                {
                                                                                                    item.observations
                                                                                                }
                                                                                            </div>
                                                                                        )}
                                                                                    </span>
                                                                                    <span className="hidden justify-end md:flex md:min-w-[120px]">
                                                                                        {new Intl.NumberFormat(
                                                                                            'pt-BR',
                                                                                            {
                                                                                                style: 'currency',
                                                                                                currency:
                                                                                                    'BRL',
                                                                                            },
                                                                                        ).format(
                                                                                            item.unitPrice,
                                                                                        )}
                                                                                    </span>
                                                                                    <span className="text-end md:min-w-[120px]">
                                                                                        {new Intl.NumberFormat(
                                                                                            'pt-BR',
                                                                                            {
                                                                                                style: 'currency',
                                                                                                currency:
                                                                                                    'BRL',
                                                                                            },
                                                                                        ).format(
                                                                                            item.totalPrice,
                                                                                        )}
                                                                                    </span>

                                                                                    {/* Segundo nível (options) */}
                                                                                    {item
                                                                                        .options
                                                                                        ?.length >
                                                                                        0 && (
                                                                                        <ul className="m-0 flex w-full basis-full list-none flex-col gap-0 pt-0 pl-0">
                                                                                            {item.options.map(
                                                                                                (
                                                                                                    opt: unknown,
                                                                                                ) => (
                                                                                                    <li
                                                                                                        key={
                                                                                                            opt.id
                                                                                                        }
                                                                                                        className="flex flex-wrap items-center gap-2 py-2 text-muted-foreground"
                                                                                                    >
                                                                                                        <span className="text-start md:min-w-[32px]">
                                                                                                            {
                                                                                                                opt.quantity
                                                                                                            }

                                                                                                            x
                                                                                                        </span>
                                                                                                        <span className="grow">
                                                                                                            {
                                                                                                                opt.name
                                                                                                            }
                                                                                                        </span>
                                                                                                        <span className="hidden justify-end text-end md:flex md:min-w-[120px]">
                                                                                                            {new Intl.NumberFormat(
                                                                                                                'pt-BR',
                                                                                                                {
                                                                                                                    style: 'currency',
                                                                                                                    currency:
                                                                                                                        'BRL',
                                                                                                                },
                                                                                                            ).format(
                                                                                                                opt.unitPrice,
                                                                                                            )}
                                                                                                        </span>
                                                                                                        <span className="text-end md:min-w-[120px]">
                                                                                                            {new Intl.NumberFormat(
                                                                                                                'pt-BR',
                                                                                                                {
                                                                                                                    style: 'currency',
                                                                                                                    currency:
                                                                                                                        'BRL',
                                                                                                                },
                                                                                                            ).format(
                                                                                                                opt.price ??
                                                                                                                    opt.totalPrice ??
                                                                                                                    0,
                                                                                                            )}
                                                                                                        </span>

                                                                                                        {/* Terceiro nível (customizations) */}
                                                                                                        {opt
                                                                                                            .customizations
                                                                                                            ?.length >
                                                                                                            0 && (
                                                                                                            <ul className="m-0 flex w-full basis-full list-none flex-col gap-0 pt-0 pl-0">
                                                                                                                {opt.customizations.map(
                                                                                                                    (
                                                                                                                        cust: unknown,
                                                                                                                    ) => (
                                                                                                                        <li
                                                                                                                            key={
                                                                                                                                cust.id
                                                                                                                            }
                                                                                                                            className="flex flex-wrap items-center gap-2 py-2"
                                                                                                                        >
                                                                                                                            <span className="ms-5 grow border-s-2 border-muted-foreground ps-5 text-muted-foreground">
                                                                                                                                {
                                                                                                                                    cust.quantity
                                                                                                                                }

                                                                                                                                x{' '}
                                                                                                                                {
                                                                                                                                    cust.name
                                                                                                                                }
                                                                                                                            </span>
                                                                                                                            <span className="hidden justify-end text-end text-muted-foreground md:flex md:min-w-[120px]">
                                                                                                                                {new Intl.NumberFormat(
                                                                                                                                    'pt-BR',
                                                                                                                                    {
                                                                                                                                        style: 'currency',
                                                                                                                                        currency:
                                                                                                                                            'BRL',
                                                                                                                                    },
                                                                                                                                ).format(
                                                                                                                                    cust.unitPrice,
                                                                                                                                )}
                                                                                                                            </span>
                                                                                                                            <span className="text-end text-muted-foreground md:min-w-[120px]">
                                                                                                                                {new Intl.NumberFormat(
                                                                                                                                    'pt-BR',
                                                                                                                                    {
                                                                                                                                        style: 'currency',
                                                                                                                                        currency:
                                                                                                                                            'BRL',
                                                                                                                                    },
                                                                                                                                ).format(
                                                                                                                                    cust.price ??
                                                                                                                                        0,
                                                                                                                                )}
                                                                                                                            </span>
                                                                                                                        </li>
                                                                                                                    ),
                                                                                                                )}
                                                                                                            </ul>
                                                                                                        )}
                                                                                                    </li>
                                                                                                ),
                                                                                            )}
                                                                                        </ul>
                                                                                    )}

                                                                                    {/* Complementos/Add-ons (só renderizar se NÃO houver options) */}
                                                                                    {item
                                                                                        .add_ons
                                                                                        ?.length >
                                                                                        0 &&
                                                                                        (!item.options ||
                                                                                            item
                                                                                                .options
                                                                                                .length ===
                                                                                                0) && (
                                                                                            <ul className="m-0 flex w-full basis-full list-none flex-col gap-0 pt-0 pl-0">
                                                                                                {item.add_ons.map(
                                                                                                    (
                                                                                                        addon: any,
                                                                                                        idx: number,
                                                                                                    ) => (
                                                                                                        <li
                                                                                                            key={
                                                                                                                idx
                                                                                                            }
                                                                                                            className="flex flex-wrap items-center gap-2 py-2 text-muted-foreground"
                                                                                                        >
                                                                                                            <span className="text-start md:min-w-[32px]">
                                                                                                                {
                                                                                                                    addon.quantity
                                                                                                                }

                                                                                                                x
                                                                                                            </span>
                                                                                                            <span className="grow">
                                                                                                                {
                                                                                                                    addon.name
                                                                                                                }
                                                                                                            </span>
                                                                                                            <span className="hidden justify-end text-end md:flex md:min-w-[120px]">
                                                                                                                {new Intl.NumberFormat(
                                                                                                                    'pt-BR',
                                                                                                                    {
                                                                                                                        style: 'currency',
                                                                                                                        currency:
                                                                                                                            'BRL',
                                                                                                                    },
                                                                                                                ).format(
                                                                                                                    addon.price ??
                                                                                                                        0,
                                                                                                                )}
                                                                                                            </span>
                                                                                                            <span className="text-end md:min-w-[120px]">
                                                                                                                {new Intl.NumberFormat(
                                                                                                                    'pt-BR',
                                                                                                                    {
                                                                                                                        style: 'currency',
                                                                                                                        currency:
                                                                                                                            'BRL',
                                                                                                                    },
                                                                                                                ).format(
                                                                                                                    (addon.price ??
                                                                                                                        0) *
                                                                                                                        (addon.quantity ??
                                                                                                                            1),
                                                                                                                )}
                                                                                                            </span>
                                                                                                        </li>
                                                                                                    ),
                                                                                                )}
                                                                                            </ul>
                                                                                        )}
                                                                                </li>
                                                                            ),
                                                                        );
                                                                    })()}
                                                                </ul>

                                                                {/* Rodapé com total */}
                                                                <div className="flex w-full justify-between border-t px-3 py-4">
                                                                    <div className="flex w-full flex-row justify-between gap-2">
                                                                        <span className="leading-4 font-semibold">
                                                                            Total
                                                                            dos
                                                                            itens
                                                                        </span>
                                                                        <span className="leading-4 font-semibold">
                                                                            {(() => {
                                                                                const order =
                                                                                    row.original;
                                                                                let total = 0;

                                                                                // Para Takeat: usar basket total_price
                                                                                if (
                                                                                    order.provider ===
                                                                                        'takeat' &&
                                                                                    order
                                                                                        .raw
                                                                                        ?.basket
                                                                                        ?.total_price
                                                                                ) {
                                                                                    total =
                                                                                        parseFloat(
                                                                                            String(
                                                                                                order
                                                                                                    .raw
                                                                                                    .basket
                                                                                                    .total_price,
                                                                                            ),
                                                                                        );
                                                                                } else {
                                                                                    // Para outros providers: somar items
                                                                                    const items =
                                                                                        order
                                                                                            .raw
                                                                                            ?.items ||
                                                                                        order.items ||
                                                                                        [];
                                                                                    total =
                                                                                        items.reduce(
                                                                                            (
                                                                                                sum: number,
                                                                                                item: any,
                                                                                            ) => {
                                                                                                const quantity =
                                                                                                    item.qty ||
                                                                                                    item.quantity ||
                                                                                                    0;
                                                                                                const unitPrice =
                                                                                                    item.unit_price ||
                                                                                                    item.unitPrice ||
                                                                                                    item.price ||
                                                                                                    0;
                                                                                                const price =
                                                                                                    item.totalPrice ||
                                                                                                    unitPrice *
                                                                                                        quantity ||
                                                                                                    0;
                                                                                                return (
                                                                                                    sum +
                                                                                                    price
                                                                                                );
                                                                                            },
                                                                                            0,
                                                                                        );
                                                                                }

                                                                                return new Intl.NumberFormat(
                                                                                    'pt-BR',
                                                                                    {
                                                                                        style: 'currency',
                                                                                        currency:
                                                                                            'BRL',
                                                                                    },
                                                                                ).format(
                                                                                    total,
                                                                                );
                                                                            })()}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </CardContent>
                                                        </Card>

                                                        {/* Card: Dados do Cliente Takeat */}
                                                        {row.original
                                                            .provider ===
                                                            'takeat' &&
                                                            row.original.raw
                                                                ?.session
                                                                ?.bills?.[0]
                                                                ?.buyer && (
                                                                <Card className="h-fit gap-1 border-0 bg-gray-100 p-1 text-sm shadow-none dark:bg-neutral-950">
                                                                    <CardHeader className="gap-0 bg-gray-100 px-2 py-2 dark:bg-neutral-950">
                                                                        <CardTitle className="flex h-[18px] items-center font-semibold">
                                                                            Dados
                                                                            do
                                                                            Cliente
                                                                        </CardTitle>
                                                                    </CardHeader>
                                                                    <CardContent className="rounded-md bg-card p-0">
                                                                        <ul className="m-0 flex w-full flex-col ps-0">
                                                                            {row
                                                                                .original
                                                                                .raw
                                                                                .session
                                                                                .bills[0]
                                                                                .buyer
                                                                                .name && (
                                                                                <li className="flex flex-row items-center justify-between gap-2 border-b border-border px-3 py-4 last:border-b-0">
                                                                                    <span className="text-sm leading-4 font-normal text-muted-foreground">
                                                                                        Nome
                                                                                    </span>
                                                                                    <span className="text-sm leading-4 font-medium whitespace-nowrap">
                                                                                        {
                                                                                            row
                                                                                                .original
                                                                                                .raw
                                                                                                .session
                                                                                                .bills[0]
                                                                                                .buyer
                                                                                                .name
                                                                                        }
                                                                                    </span>
                                                                                </li>
                                                                            )}
                                                                            {row
                                                                                .original
                                                                                .raw
                                                                                .session
                                                                                .bills[0]
                                                                                .buyer
                                                                                .phone && (
                                                                                <li className="flex flex-row items-center justify-between gap-2 px-3 py-4">
                                                                                    <span className="text-sm leading-4 font-normal text-muted-foreground">
                                                                                        Telefone
                                                                                    </span>
                                                                                    <span className="font-mono text-sm leading-4 font-medium whitespace-nowrap">
                                                                                        {
                                                                                            row
                                                                                                .original
                                                                                                .raw
                                                                                                .session
                                                                                                .bills[0]
                                                                                                .buyer
                                                                                                .phone
                                                                                        }
                                                                                    </span>
                                                                                </li>
                                                                            )}
                                                                        </ul>
                                                                    </CardContent>
                                                                </Card>
                                                            )}

                                                        {/* Card: Dados do Cliente iFood */}
                                                        {row.original.raw
                                                            ?.customer && (
                                                            <Card className="h-fit gap-1 border-0 bg-gray-100 p-1 text-sm shadow-none dark:bg-neutral-950">
                                                                <CardHeader className="gap-0 bg-gray-100 px-2 py-2 dark:bg-neutral-950">
                                                                    <CardTitle className="flex h-[18px] items-center font-semibold">
                                                                        Dados do
                                                                        Cliente
                                                                    </CardTitle>
                                                                </CardHeader>
                                                                <CardContent className="rounded-md bg-card p-0">
                                                                    <ul className="m-0 flex w-full flex-col ps-0">
                                                                        <li className="flex flex-col gap-1 px-3 py-2">
                                                                            {typeof row
                                                                                .original
                                                                                .raw
                                                                                .customer
                                                                                .name ===
                                                                                'string' && (
                                                                                <span className="text-xs text-muted-foreground">
                                                                                    {
                                                                                        row
                                                                                            .original
                                                                                            .raw
                                                                                            .customer
                                                                                            .name
                                                                                    }
                                                                                </span>
                                                                            )}
                                                                            {row
                                                                                .original
                                                                                .raw
                                                                                .customer
                                                                                .phone
                                                                                ?.number && (
                                                                                <span className="text-xs text-muted-foreground">
                                                                                    Telefone:{' '}
                                                                                    {
                                                                                        row
                                                                                            .original
                                                                                            .raw
                                                                                            .customer
                                                                                            .phone
                                                                                            .number
                                                                                    }
                                                                                </span>
                                                                            )}
                                                                            {typeof row
                                                                                .original
                                                                                .raw
                                                                                .customer
                                                                                .documentNumber ===
                                                                                'string' && (
                                                                                <span className="text-xs text-muted-foreground">
                                                                                    Documento:{' '}
                                                                                    {
                                                                                        row
                                                                                            .original
                                                                                            .raw
                                                                                            .customer
                                                                                            .documentNumber
                                                                                    }
                                                                                </span>
                                                                            )}
                                                                        </li>
                                                                    </ul>
                                                                </CardContent>
                                                            </Card>
                                                        )}

                                                        {/* Card: Endereço de Entrega */}
                                                        {row.original.raw
                                                            ?.delivery
                                                            ?.deliveryAddress && (
                                                            <Card className="h-fit gap-1 border-0 bg-gray-100 p-1 text-sm shadow-none dark:bg-neutral-950">
                                                                <CardHeader className="gap-0 bg-gray-100 px-2 py-2 dark:bg-neutral-950">
                                                                    <CardTitle className="flex h-[18px] items-center font-semibold">
                                                                        Endereço
                                                                        de
                                                                        Entrega
                                                                    </CardTitle>
                                                                </CardHeader>
                                                                <CardContent className="rounded-md bg-card p-0">
                                                                    <ul className="m-0 flex w-full flex-col ps-0">
                                                                        <li className="flex flex-col gap-1 px-3 py-2">
                                                                            {row
                                                                                .original
                                                                                .raw
                                                                                .delivery
                                                                                .deliveryAddress
                                                                                .streetName && (
                                                                                <span className="text-xs text-muted-foreground">
                                                                                    {
                                                                                        row
                                                                                            .original
                                                                                            .raw
                                                                                            .delivery
                                                                                            .deliveryAddress
                                                                                            .streetName
                                                                                    }

                                                                                    ,{' '}
                                                                                    {
                                                                                        row
                                                                                            .original
                                                                                            .raw
                                                                                            .delivery
                                                                                            .deliveryAddress
                                                                                            .streetNumber
                                                                                    }
                                                                                </span>
                                                                            )}
                                                                            {row
                                                                                .original
                                                                                .raw
                                                                                .delivery
                                                                                .deliveryAddress
                                                                                .neighborhood && (
                                                                                <span className="text-xs text-muted-foreground">
                                                                                    Bairro:{' '}
                                                                                    {
                                                                                        row
                                                                                            .original
                                                                                            .raw
                                                                                            .delivery
                                                                                            .deliveryAddress
                                                                                            .neighborhood
                                                                                    }
                                                                                </span>
                                                                            )}
                                                                            {row
                                                                                .original
                                                                                .raw
                                                                                .delivery
                                                                                .deliveryAddress
                                                                                .city && (
                                                                                <span className="text-xs text-muted-foreground">
                                                                                    Cidade:{' '}
                                                                                    {
                                                                                        row
                                                                                            .original
                                                                                            .raw
                                                                                            .delivery
                                                                                            .deliveryAddress
                                                                                            .city
                                                                                    }
                                                                                </span>
                                                                            )}
                                                                            {row
                                                                                .original
                                                                                .raw
                                                                                .delivery
                                                                                .deliveryAddress
                                                                                .state && (
                                                                                <span className="text-xs text-muted-foreground">
                                                                                    UF:{' '}
                                                                                    {
                                                                                        row
                                                                                            .original
                                                                                            .raw
                                                                                            .delivery
                                                                                            .deliveryAddress
                                                                                            .state
                                                                                    }
                                                                                </span>
                                                                            )}
                                                                            {row
                                                                                .original
                                                                                .raw
                                                                                .delivery
                                                                                .deliveryAddress
                                                                                .complement && (
                                                                                <span className="text-xs text-muted-foreground">
                                                                                    Complemento:{' '}
                                                                                    {
                                                                                        row
                                                                                            .original
                                                                                            .raw
                                                                                            .delivery
                                                                                            .deliveryAddress
                                                                                            .complement
                                                                                    }
                                                                                </span>
                                                                            )}
                                                                            {row
                                                                                .original
                                                                                .raw
                                                                                .delivery
                                                                                .deliveryAddress
                                                                                .reference && (
                                                                                <span className="text-xs text-muted-foreground">
                                                                                    Referência:{' '}
                                                                                    {
                                                                                        row
                                                                                            .original
                                                                                            .raw
                                                                                            .delivery
                                                                                            .deliveryAddress
                                                                                            .reference
                                                                                    }
                                                                                </span>
                                                                            )}
                                                                            {row
                                                                                .original
                                                                                .raw
                                                                                .delivery
                                                                                .deliveryAddress
                                                                                .postalCode && (
                                                                                <span className="text-xs text-muted-foreground">
                                                                                    CEP:{' '}
                                                                                    {
                                                                                        row
                                                                                            .original
                                                                                            .raw
                                                                                            .delivery
                                                                                            .deliveryAddress
                                                                                            .postalCode
                                                                                    }
                                                                                </span>
                                                                            )}
                                                                        </li>
                                                                    </ul>
                                                                </CardContent>
                                                            </Card>
                                                        )}
                                                        {row.original.raw
                                                            ?.delivery
                                                            ?.observations && (
                                                            <Card className="h-fit gap-1 border-0 bg-gray-100 p-1 text-sm shadow-none dark:bg-neutral-950">
                                                                <CardHeader className="gap-0 bg-gray-100 px-2 py-2 dark:bg-neutral-950">
                                                                    <CardTitle className="flex h-[18px] items-center font-semibold">
                                                                        Observações
                                                                        da
                                                                        Entrega
                                                                    </CardTitle>
                                                                </CardHeader>
                                                                <CardContent className="rounded-md bg-card p-0">
                                                                    <div className="px-3 py-4">
                                                                        <p className="text-sm leading-4 font-normal text-gray-700">
                                                                            {
                                                                                row
                                                                                    .original
                                                                                    .raw
                                                                                    .delivery
                                                                                    .observations
                                                                            }
                                                                        </p>
                                                                    </div>
                                                                </CardContent>
                                                            </Card>
                                                        )}
                                                    </div>

                                                    {/* Coluna 2: Detalhamento Financeiro + Pagamento */}
                                                    <div className="flex flex-col gap-4">
                                                        {/* Card: Detalhamento Financeiro */}
                                                        <OrderFinancialCard
                                                            sale={
                                                                row.original
                                                                    .sale
                                                            }
                                                            order={row.original}
                                                            internalProducts={
                                                                internalProducts
                                                            }
                                                        />

                                                        {/* Card: Pagamento (abaixo do detalhamento) */}
                                                        <Card className="h-fit gap-1 border-0 bg-gray-100 p-1 text-sm shadow-none dark:bg-neutral-950">
                                                            <CardHeader className="gap-0 bg-gray-100 px-2 py-2 dark:bg-neutral-950">
                                                                <CardTitle className="flex h-[18px] items-center font-semibold">
                                                                    Pagamento
                                                                </CardTitle>
                                                            </CardHeader>
                                                            <CardContent className="rounded-md bg-card p-0">
                                                                {/* Detalhes de pagamento - iFood */}
                                                                {row.original
                                                                    .raw
                                                                    ?.payments
                                                                    ?.methods &&
                                                                    row.original
                                                                        .raw
                                                                        .payments
                                                                        .methods
                                                                        .length >
                                                                        0 && (
                                                                        <>
                                                                            <div className="flex w-full flex-row justify-between gap-2 border-b px-3 py-2">
                                                                                <span className="text-sm font-semibold">
                                                                                    Pagamento
                                                                                </span>
                                                                                <span className="text-sm font-semibold">
                                                                                    {row
                                                                                        .original
                                                                                        .raw
                                                                                        .payments
                                                                                        .methods[0]
                                                                                        ?.type ===
                                                                                    'ONLINE'
                                                                                        ? 'Online'
                                                                                        : 'Offline'}
                                                                                </span>
                                                                            </div>
                                                                            <ul className="m-0 flex w-full flex-col ps-0">
                                                                                {row.original.raw.payments.methods.map(
                                                                                    (
                                                                                        payment: unknown,
                                                                                        index: number,
                                                                                    ) => (
                                                                                        <li
                                                                                            key={
                                                                                                index
                                                                                            }
                                                                                            className="flex flex-col gap-2 border-b-1 px-3 py-4 last:border-b-0"
                                                                                        >
                                                                                            <div className="flex w-full flex-row items-center justify-between gap-2">
                                                                                                <div className="flex items-center gap-2">
                                                                                                    <span className="text-sm leading-4 font-medium">
                                                                                                        {payment.method ===
                                                                                                        'CASH'
                                                                                                            ? 'Dinheiro'
                                                                                                            : payment.method ===
                                                                                                                'CREDIT'
                                                                                                              ? 'Crédito'
                                                                                                              : payment.method ===
                                                                                                                  'DEBIT'
                                                                                                                ? 'Débito'
                                                                                                                : payment.method ===
                                                                                                                    'MEAL_VOUCHER'
                                                                                                                  ? 'Vale Refeição'
                                                                                                                  : payment.method ===
                                                                                                                      'FOOD_VOUCHER'
                                                                                                                    ? 'Vale Alimentação'
                                                                                                                    : payment.method ===
                                                                                                                        'DIGITAL_WALLET'
                                                                                                                      ? 'Carteira Digital'
                                                                                                                      : payment.method ===
                                                                                                                          'PIX'
                                                                                                                        ? 'PIX'
                                                                                                                        : payment.method}
                                                                                                    </span>
                                                                                                </div>
                                                                                                <span className="text-sm leading-4 font-semibold whitespace-nowrap">
                                                                                                    {new Intl.NumberFormat(
                                                                                                        'pt-BR',
                                                                                                        {
                                                                                                            style: 'currency',
                                                                                                            currency:
                                                                                                                'BRL',
                                                                                                        },
                                                                                                    ).format(
                                                                                                        payment.value ||
                                                                                                            0,
                                                                                                    )}
                                                                                                </span>
                                                                                            </div>
                                                                                            {(payment
                                                                                                .card
                                                                                                ?.brand ||
                                                                                                payment
                                                                                                    .wallet
                                                                                                    ?.name ||
                                                                                                payment
                                                                                                    .cash
                                                                                                    ?.changeFor) && (
                                                                                                <ul className="flex w-full flex-col gap-2 pl-0">
                                                                                                    {payment
                                                                                                        .card
                                                                                                        ?.brand && (
                                                                                                        <li className="flex w-full flex-row items-start justify-between px-0 py-0">
                                                                                                            <span className="text-xs leading-4 font-normal text-muted-foreground">
                                                                                                                {
                                                                                                                    payment
                                                                                                                        .card
                                                                                                                        .brand
                                                                                                                }
                                                                                                            </span>
                                                                                                        </li>
                                                                                                    )}
                                                                                                    {payment
                                                                                                        .wallet
                                                                                                        ?.name && (
                                                                                                        <li className="flex w-full flex-row items-start justify-between px-0 py-0">
                                                                                                            <span className="text-xs leading-4 font-normal text-muted-foreground">
                                                                                                                {payment.wallet.name
                                                                                                                    .replace(
                                                                                                                        '_',
                                                                                                                        ' ',
                                                                                                                    )
                                                                                                                    .toLowerCase()
                                                                                                                    .replace(
                                                                                                                        /\b\w/g,
                                                                                                                        (
                                                                                                                            l: string,
                                                                                                                        ) =>
                                                                                                                            l.toUpperCase(),
                                                                                                                    )}
                                                                                                            </span>
                                                                                                        </li>
                                                                                                    )}
                                                                                                    {payment
                                                                                                        .cash
                                                                                                        ?.changeFor && (
                                                                                                        <li className="flex w-full flex-row items-start justify-between px-0 py-0">
                                                                                                            <span className="text-xs leading-4 font-normal text-muted-foreground">
                                                                                                                Troco
                                                                                                                para:{' '}
                                                                                                                {new Intl.NumberFormat(
                                                                                                                    'pt-BR',
                                                                                                                    {
                                                                                                                        style: 'currency',
                                                                                                                        currency:
                                                                                                                            'BRL',
                                                                                                                    },
                                                                                                                ).format(
                                                                                                                    payment
                                                                                                                        .cash
                                                                                                                        .changeFor,
                                                                                                                )}
                                                                                                            </span>
                                                                                                        </li>
                                                                                                    )}
                                                                                                </ul>
                                                                                            )}
                                                                                        </li>
                                                                                    ),
                                                                                )}
                                                                            </ul>
                                                                        </>
                                                                    )}

                                                                {/* Detalhes de pagamento - Takeat */}
                                                                {row.original
                                                                    .raw
                                                                    ?.session
                                                                    ?.payments &&
                                                                    row.original
                                                                        .raw
                                                                        .session
                                                                        .payments
                                                                        .length >
                                                                        0 && (
                                                                        <div className="flex w-full flex-col gap-2 px-3 py-4">
                                                                            {/* Total pago */}
                                                                            <div className="flex w-full flex-row justify-between gap-2">
                                                                                <span className="text-sm font-semibold">
                                                                                    Total
                                                                                    pago
                                                                                </span>
                                                                                <span className="text-sm font-semibold">
                                                                                    {new Intl.NumberFormat(
                                                                                        'pt-BR',
                                                                                        {
                                                                                            style: 'currency',
                                                                                            currency:
                                                                                                'BRL',
                                                                                        },
                                                                                    ).format(
                                                                                        row.original.raw.session.payments.reduce(
                                                                                            (
                                                                                                sum: number,
                                                                                                p: any,
                                                                                            ) =>
                                                                                                sum +
                                                                                                parseFloat(
                                                                                                    p.payment_value ||
                                                                                                        '0',
                                                                                                ),
                                                                                            0,
                                                                                        ),
                                                                                    )}
                                                                                </span>
                                                                            </div>
                                                                            {/* Detalhes dos métodos de pagamento como descrição */}
                                                                            <ul className="m-0 flex w-full flex-col gap-1 ps-0">
                                                                                {row.original.raw.session.payments.map(
                                                                                    (
                                                                                        payment: any,
                                                                                        index: number,
                                                                                    ) => {
                                                                                        const keyword =
                                                                                            payment
                                                                                                .payment_method
                                                                                                ?.keyword ||
                                                                                            '';
                                                                                        const paymentName =
                                                                                            payment
                                                                                                .payment_method
                                                                                                ?.name ||
                                                                                            'Pagamento';

                                                                                        const isOnline =
                                                                                            keyword.includes(
                                                                                                'pagamento_online',
                                                                                            ) ||
                                                                                            keyword.includes(
                                                                                                'ifood',
                                                                                            ) ||
                                                                                            keyword.includes(
                                                                                                '99food',
                                                                                            ) ||
                                                                                            keyword.includes(
                                                                                                'neemo',
                                                                                            ) ||
                                                                                            keyword.includes(
                                                                                                'rappi',
                                                                                            );

                                                                                        return (
                                                                                            <li
                                                                                                key={
                                                                                                    index
                                                                                                }
                                                                                                className="flex w-full flex-row items-start justify-between gap-2"
                                                                                            >
                                                                                                <span className="text-xs leading-4 text-muted-foreground">
                                                                                                    {
                                                                                                        paymentName
                                                                                                    }
                                                                                                    {isOnline
                                                                                                        ? ' (Online)'
                                                                                                        : ' (Offline)'}
                                                                                                </span>
                                                                                                <span className="text-xs leading-4 whitespace-nowrap text-muted-foreground">
                                                                                                    {new Intl.NumberFormat(
                                                                                                        'pt-BR',
                                                                                                        {
                                                                                                            style: 'currency',
                                                                                                            currency:
                                                                                                                'BRL',
                                                                                                        },
                                                                                                    ).format(
                                                                                                        parseFloat(
                                                                                                            payment.payment_value ||
                                                                                                                '0',
                                                                                                        ),
                                                                                                    )}
                                                                                                </span>
                                                                                            </li>
                                                                                        );
                                                                                    },
                                                                                )}
                                                                            </ul>
                                                                        </div>
                                                                    )}

                                                                {/* Mensagem quando não há pagamentos */}
                                                                {!row.original
                                                                    .raw
                                                                    ?.payments
                                                                    ?.methods
                                                                    ?.length &&
                                                                    !row
                                                                        .original
                                                                        .raw
                                                                        ?.session
                                                                        ?.payments
                                                                        ?.length && (
                                                                        <div className="flex flex-col items-center justify-center px-3 py-6 text-center">
                                                                            <p className="text-sm text-muted-foreground">
                                                                                Nenhum
                                                                                pagamento
                                                                                registrado
                                                                            </p>
                                                                            <p className="mt-1 text-xs text-muted-foreground">
                                                                                Informações
                                                                                de
                                                                                pagamento
                                                                                não
                                                                                disponíveis
                                                                                para
                                                                                este
                                                                                pedido
                                                                            </p>
                                                                        </div>
                                                                    )}
                                                            </CardContent>
                                                        </Card>

                                                        {/* Outros detalhes: Cupons, CPF, Agendamento, etc. */}
                                                        <OrderExpandedDetails
                                                            order={row.original}
                                                        />
                                                    </div>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </React.Fragment>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell
                                    colSpan={columns.length}
                                    className="h-24 text-center"
                                >
                                    Nenhum pedido encontrado.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>

                    {/* Rodapé com totais */}
                    <TableFooter>
                        <TableRow className="bg-muted hover:bg-muted">
                            {table.getVisibleLeafColumns().map((column) => {
                                // Colunas que devem mostrar totais
                                const showTotal = [
                                    'total',
                                    'cost',
                                    'tax',
                                    'total_costs',
                                    'total_commissions',
                                    'payment_fees',
                                    'net_total',
                                ].includes(column.id);

                                if (!showTotal) {
                                    return <TableCell key={column.id} />;
                                }

                                // Usar indicadores para totais do período (não apenas página atual)
                                let total = 0;
                                
                                if (column.id === 'total') {
                                    total = indicators.subtotal;
                                } else if (column.id === 'cost') {
                                    total = indicators.cmv;
                                } else if (column.id === 'net_total') {
                                    total = indicators.netRevenue;
                                } else {
                                    // Para outras colunas (tax, total_costs, etc), calcular de todos os pedidos
                                    total = data.reduce((sum, order) => {
                                        const items = order.items || [];
                                        const isCancelled =
                                            order.status === 'CANCELLED';

                                        // Não somar pedidos cancelados
                                        if (isCancelled) return sum;

                                        if (column.id === 'tax') {
                                            // Impostos (produtos + adicionais)
                                            const productTax = items.reduce(
                                                (itemSum, item) => {
                                                    if (
                                                        item.internal_product
                                                            ?.tax_category
                                                            ?.total_tax_rate !==
                                                            undefined &&
                                                        item.internal_product
                                                            ?.tax_category
                                                            ?.total_tax_rate !==
                                                            null
                                                    ) {
                                                        const quantity =
                                                            item.qty ||
                                                            item.quantity ||
                                                            0;
                                                        const unitPrice =
                                                            item.unit_price ||
                                                            item.price ||
                                                            0;
                                                        const itemTotal =
                                                            quantity *
                                                            unitPrice;
                                                        const taxRate =
                                                            item
                                                                .internal_product
                                                                .tax_category
                                                                .total_tax_rate /
                                                            100;
                                                        return (
                                                            itemSum +
                                                            itemTotal * taxRate
                                                        );
                                                    }
                                                    return itemSum;
                                                },
                                                0,
                                            );

                                            const calculatedCosts =
                                                order.calculated_costs;
                                            const additionalTaxes =
                                                calculatedCosts?.taxes || [];
                                            const totalAdditionalTax =
                                                additionalTaxes.reduce(
                                                    (
                                                        taxSum: number,
                                                        tax: any,
                                                    ) =>
                                                        taxSum +
                                                        (tax.calculated_value ||
                                                            0),
                                                    0,
                                                );

                                            return (
                                                sum +
                                                productTax +
                                                totalAdditionalTax
                                            );
                                        }

                                        if (column.id === 'total_costs') {
                                            // Custos
                                            const totalCosts =
                                                order.total_costs;
                                            if (
                                                totalCosts !== null &&
                                                totalCosts !== undefined
                                            ) {
                                                const value =
                                                    typeof totalCosts ===
                                                    'string'
                                                        ? parseFloat(
                                                              totalCosts,
                                                          ) || 0
                                                        : totalCosts;
                                                return (
                                                    sum +
                                                    (isNaN(value) ? 0 : value)
                                                );
                                            }
                                            return sum;
                                        }

                                        if (column.id === 'total_commissions') {
                                            // Comissões
                                            const totalCommissions =
                                                order.total_commissions;
                                            if (
                                                totalCommissions !== null &&
                                                totalCommissions !== undefined
                                            ) {
                                                const value =
                                                    typeof totalCommissions ===
                                                    'string'
                                                        ? parseFloat(
                                                              totalCommissions,
                                                          ) || 0
                                                        : totalCommissions;
                                                return (
                                                    sum +
                                                    (isNaN(value) ? 0 : value)
                                                );
                                            }
                                            return sum;
                                        }

                                        if (column.id === 'payment_fees') {
                                            // Taxa Pgto
                                            const calculatedCosts =
                                                order.calculated_costs;
                                            const paymentMethodFees =
                                                calculatedCosts?.payment_methods ||
                                                [];
                                            const totalPaymentFee =
                                                paymentMethodFees.reduce(
                                                    (
                                                        feeSum: number,
                                                        fee: any,
                                                    ) =>
                                                        feeSum +
                                                        (fee.calculated_value ||
                                                            0),
                                                    0,
                                                );
                                            return sum + totalPaymentFee;
                                        }

                                        return sum;
                                    }, 0);
                                }

                                // Alinhar à direita se for coluna numérica
                                const isNumeric = [
                                    'total',
                                    'cost',
                                    'tax',
                                    'total_costs',
                                    'total_commissions',
                                    'payment_fees',
                                    'net_total',
                                ].includes(column.id);

                                return (
                                    <TableCell
                                        key={column.id}
                                        className={`font-semibold ${isNumeric ? 'text-right' : ''}`}
                                    >
                                        {!isNaN(total) && total > 0
                                            ? new Intl.NumberFormat('pt-BR', {
                                                  style: 'currency',
                                                  currency: 'BRL',
                                              }).format(total)
                                            : '--'}
                                    </TableCell>
                                );
                            })}
                        </TableRow>
                    </TableFooter>
                </Table>
            </div>

            {/* 📌 Paginação */}
            <div className="flex items-center justify-between px-4">
                <div className="hidden flex-1 text-sm text-muted-foreground lg:flex">
                    Exibindo {pagination.from} – {pagination.to} de{' '}
                    {pagination.total} pedidos
                </div>

                <div className="flex w-full items-center gap-8 lg:w-fit">
                    <div className="hidden items-center gap-2 lg:flex">
                        <Label
                            htmlFor="rows-per-page"
                            className="text-sm font-medium"
                        >
                            Linhas por página
                        </Label>
                        <Select
                            value={`${filters?.per_page ?? pagination.per_page ?? 20}`}
                            onValueChange={(value) =>
                                updateFilters({ per_page: Number(value) })
                            }
                        >
                            <SelectTrigger
                                size="sm"
                                className="w-20"
                                id="rows-per-page"
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent side="top">
                                {[10, 20, 30, 40, 50, 100, 200, 500, 1000].map(
                                    (pageSize) => (
                                        <SelectItem
                                            key={pageSize}
                                            value={`${pageSize}`}
                                        >
                                            {pageSize}
                                        </SelectItem>
                                    ),
                                )}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex w-fit items-center justify-center text-sm font-medium">
                        Página {pagination.current_page} de{' '}
                        {pagination.last_page}
                    </div>

                    <div className="ml-auto flex items-center gap-2 lg:ml-0">
                        {/* Primeira */}
                        <Button
                            variant="outline"
                            className="hidden h-8 w-8 p-0 lg:flex"
                            disabled={pagination.current_page === 1}
                            asChild
                        >
                            {pagination.current_page === 1 ? (
                                <span className="cursor-not-allowed opacity-40">
                                    <IconChevronsLeft />
                                </span>
                            ) : (
                                <Link
                                    href={buildPageUrl(1)}
                                    preserveScroll
                                    preserveState
                                >
                                    <IconChevronsLeft />
                                </Link>
                            )}
                        </Button>

                        {/* Anterior */}
                        <Button
                            variant="outline"
                            className="size-8"
                            size="icon"
                            disabled={!pagination.prev_page_url}
                            asChild
                        >
                            {pagination.prev_page_url ? (
                                <Link
                                    href={pagination.prev_page_url}
                                    preserveScroll
                                    preserveState
                                >
                                    <IconChevronLeft />
                                </Link>
                            ) : (
                                <span className="cursor-not-allowed opacity-40">
                                    <IconChevronLeft />
                                </span>
                            )}
                        </Button>

                        {/* Próxima */}
                        <Button
                            variant="outline"
                            className="size-8"
                            size="icon"
                            disabled={!pagination.next_page_url}
                            asChild
                        >
                            {pagination.next_page_url ? (
                                <Link
                                    href={pagination.next_page_url}
                                    preserveScroll
                                    preserveState
                                >
                                    <IconChevronRight />
                                </Link>
                            ) : (
                                <span className="cursor-not-allowed opacity-40">
                                    <IconChevronRight />
                                </span>
                            )}
                        </Button>

                        {/* Última */}
                        <Button
                            variant="outline"
                            className="hidden size-8 lg:flex"
                            size="icon"
                            disabled={
                                pagination.current_page === pagination.last_page
                            }
                            asChild
                        >
                            {pagination.current_page ===
                            pagination.last_page ? (
                                <span className="cursor-not-allowed opacity-40">
                                    <IconChevronsRight />
                                </span>
                            ) : (
                                <Link
                                    href={buildPageUrl(pagination.last_page)}
                                    preserveScroll
                                    preserveState
                                >
                                    <IconChevronsRight />
                                </Link>
                            )}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Modal de Associação Rápida */}
            {selectedOrder && (
                <QuickAssociateDialog
                    open={associateDialogOpen}
                    onOpenChange={setAssociateDialogOpen}
                    orderCode={selectedOrder.code}
                    items={selectedOrder.items || []}
                    internalProducts={internalProducts}
                    provider={selectedOrder.provider}
                    onOpenDetailedMappings={(item) => {
                        setSelectedItem(item);
                        setItemMappingsDialogOpen(true);
                    }}
                />
            )}

            {/* Modal de Associações Detalhadas do Item */}
            <ItemMappingsDialog
                open={itemMappingsDialogOpen}
                onOpenChange={setItemMappingsDialogOpen}
                item={selectedItem}
                internalProducts={internalProducts}
                provider={selectedOrder?.provider || 'ifood'}
            />

            {/* Dialog de Sincronização Takeat */}
            <SyncTakeatDialog
                open={syncDialogOpen}
                onOpenChange={setSyncDialogOpen}
            />
        </div>
    );
}
