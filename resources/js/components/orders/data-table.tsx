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

import { DateRangePicker } from '@/components/date-range-picker';
import { columns, Order } from '@/components/orders/columns';
import { OrderExpandedDetails } from '@/components/orders/order-expanded-details';
import { OrderFinancialCard } from '@/components/orders/order-financial-card';
import { QuickAssociateDialog } from '@/components/orders/quick-associate-dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Link, router } from '@inertiajs/react';
import { DateRange } from 'react-day-picker';
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
    unmappedProductsCount = 0,
    internalProducts = [],
    marginSettings,
}: {
    data: Order[];
    pagination: Pagination;
    filters: Filters;
    stores: { id: number; name: string }[];
    unmappedProductsCount?: number;
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
}) {
    const [sorting, setSorting] = React.useState<SortingState>([
        { id: 'placed_at', desc: true }, // 🔧 padrão: ordenado por data
    ]);

    const [associateDialogOpen, setAssociateDialogOpen] = React.useState(false);
    const [selectedOrder, setSelectedOrder] = React.useState<Order | null>(
        null,
    );
    const selectedOrderIdRef = React.useRef<number | null>(null);

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

    // Adicionar coluna de produtos não associados
    const columnsWithAssociate = React.useMemo(() => {
        const associateColumn = {
            id: 'unmapped_products',
            header: 'Produtos',
            enableSorting: false,
            cell: ({ row }: { row: import('./columns').Order }) => {
                const order = row.original as Order;

                // Contar items sem internal_product diretamente da relação carregada
                const unmappedCount =
                    order.items?.filter((item) => !item.internal_product)
                        .length || 0;

                if (unmappedCount === 0) return null;

                return (
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1 text-xs"
                        onClick={() => {
                            setSelectedOrder(order);
                            setAssociateDialogOpen(true);
                        }}
                    >
                        <Badge variant="secondary" className="h-5 px-1.5">
                            {unmappedCount}
                        </Badge>
                        <span>Associar</span>
                    </Button>
                );
            },
        };

        // Inserir a coluna antes da coluna de ações
        const actionIndex = columns.findIndex((col) => col.id === 'actions');
        const newColumns = [...columns];
        newColumns.splice(actionIndex, 0, associateColumn);
        return newColumns;
    }, []);

    const [dateRange, setDateRange] = React.useState<DateRange | undefined>({
        from: filters?.start_date ? new Date(filters.start_date) : undefined,
        to: filters?.end_date ? new Date(filters.end_date) : undefined,
    });

    const [columnFilters, setColumnFilters] =
        React.useState<ColumnFiltersState>([]);
    const [columnVisibility, setColumnVisibility] =
        React.useState<VisibilityState>({
            margin: true,
            net_total: true,
            total: true,
            cost: true,
            tax: true,
            extra_cost: true,
            code: true,
        });

    // Atualiza filtros mantendo per_page
    const updateFilters = (newFilters: Partial<Filters>, resetPage = true) => {
        const merged = {
            ...filters,
            per_page: filters?.per_page ?? pagination?.per_page ?? 20,
            ...newFilters,
            ...(resetPage ? { page: 1 } : {}),
        };

        router.get('/orders', merged, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
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
        <div className="flex w-full flex-col gap-4 space-x-4 px-4 lg:px-6">
            {/* Banner de produtos não mapeados */}
            {unmappedProductsCount > 0 && (
                <Button
                    variant="outline"
                    className="h-auto w-full justify-start gap-3 rounded-lg border-2 border-red-500 bg-red-50 p-4 text-left hover:bg-red-100 dark:border-red-900 dark:bg-red-950 dark:hover:bg-red-900"
                    onClick={() => updateFilters({ unmapped_only: '1' })}
                >
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-500 text-white">
                        <svg
                            className="h-5 w-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                            />
                        </svg>
                    </div>
                    <div className="flex-1">
                        <div className="text-base font-bold text-red-900 dark:text-red-100">
                            {unmappedProductsCount} vendas sem produto vinculado
                        </div>
                        <div className="mt-1 text-sm text-red-700 dark:text-red-300">
                            Clique para filtrar apenas pedidos com produtos não
                            associados
                        </div>
                    </div>
                    <div className="flex-shrink-0">
                        <svg
                            className="h-5 w-5 text-red-700 dark:text-red-300"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 5l7 7-7 7"
                            />
                        </svg>
                    </div>
                </Button>
            )}

            {/* 🔎 Filtros */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                    {/* Badge de filtro ativo */}
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

                    {/* Buscar por código */}
                    <Input
                        placeholder="Buscar pedido..."
                        defaultValue={filters?.search ?? ''}
                        onBlur={(e) =>
                            updateFilters({ search: e.target.value })
                        }
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
                            { value: 'ifood', label: 'iFood' },
                            { value: 'takeat', label: 'Takeat' },
                            { value: '99food', label: '99Food' },
                        ]}
                        placeholder="Filtrar canal"
                        value={filters?.provider ?? 'all'}
                        onChange={(value) =>
                            updateFilters({
                                provider: value === 'all' ? undefined : value,
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
                                    {typeof column.columnDef.header === 'string'
                                        ? column.columnDef.header
                                        : column.id}
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
                                                                        // Para iFood: usa raw.items
                                                                        // Para Takeat: usa items do banco
                                                                        const items =
                                                                            row
                                                                                .original
                                                                                .raw
                                                                                ?.items ||
                                                                            row
                                                                                .original
                                                                                .items ||
                                                                            [];
                                                                        const displayItems =
                                                                            items.map(
                                                                                (
                                                                                    item: any,
                                                                                ) => ({
                                                                                    id: item.id,
                                                                                    quantity:
                                                                                        item.quantity ||
                                                                                        item.qty ||
                                                                                        0,
                                                                                    name: item.name,
                                                                                    unitPrice:
                                                                                        item.unitPrice ||
                                                                                        item.unit_price ||
                                                                                        item.price ||
                                                                                        0,
                                                                                    totalPrice:
                                                                                        item.totalPrice ||
                                                                                        item.price *
                                                                                            (item.quantity ||
                                                                                                item.qty ||
                                                                                                0) ||
                                                                                        0,
                                                                                    observations:
                                                                                        item.observations,
                                                                                    options:
                                                                                        item.options ||
                                                                                        [],
                                                                                    internal_product:
                                                                                        item.internal_product,
                                                                                }),
                                                                            );

                                                                        return displayItems.map(
                                                                            (
                                                                                item: any,
                                                                            ) => (
                                                                                <li
                                                                                    key={
                                                                                        item.id
                                                                                    }
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
                                                                                        {
                                                                                            item.name
                                                                                        }
                                                                                        {item.internal_product && (
                                                                                            <div className="mt-1 text-xs font-semibold text-emerald-600">
                                                                                                Custo:{' '}
                                                                                                {new Intl.NumberFormat(
                                                                                                    'pt-BR',
                                                                                                    {
                                                                                                        style: 'currency',
                                                                                                        currency:
                                                                                                            'BRL',
                                                                                                    },
                                                                                                ).format(
                                                                                                    parseFloat(
                                                                                                        item
                                                                                                            .internal_product
                                                                                                            .unit_cost,
                                                                                                    ),
                                                                                                )}
                                                                                            </div>
                                                                                        )}
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
                                                                                // Para iFood: usa raw.items
                                                                                // Para Takeat: usa items do banco
                                                                                const items =
                                                                                    row
                                                                                        .original
                                                                                        .raw
                                                                                        ?.items ||
                                                                                    row
                                                                                        .original
                                                                                        .items ||
                                                                                    [];
                                                                                const total =
                                                                                    items.reduce(
                                                                                        (
                                                                                            sum,
                                                                                            item: any,
                                                                                        ) => {
                                                                                            const price =
                                                                                                item.totalPrice ||
                                                                                                item.price *
                                                                                                    (item.quantity ||
                                                                                                        item.qty ||
                                                                                                        0) ||
                                                                                                0;
                                                                                            return (
                                                                                                sum +
                                                                                                price
                                                                                            );
                                                                                        },
                                                                                        0,
                                                                                    );
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

                                                        {/* Card: Dados do Cliente */}
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
                                                        />

                                                        {/* Card: Pagamento (abaixo do detalhamento) */}
                                                        <Card className="h-fit gap-1 border-0 bg-gray-100 p-1 text-sm shadow-none dark:bg-neutral-950">
                                                            <CardHeader className="gap-0 bg-gray-100 px-2 py-2 dark:bg-neutral-950">
                                                                <CardTitle className="flex h-[18px] items-center font-semibold">
                                                                    Pagamento
                                                                </CardTitle>
                                                            </CardHeader>
                                                            <CardContent className="rounded-md bg-card p-0">
                                                                {/* Total do pedido */}
                                                                <div className="flex w-full flex-row justify-between gap-2 border-b px-3 py-2">
                                                                    <span className="text-sm font-semibold">
                                                                        Total do
                                                                        pedido
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
                                                                            // iFood: raw.total.orderAmount
                                                                            // Takeat: gross_total
                                                                            row
                                                                                .original
                                                                                .raw
                                                                                ?.total
                                                                                ?.orderAmount ??
                                                                                parseFloat(
                                                                                    row
                                                                                        .original
                                                                                        .gross_total ||
                                                                                        '0',
                                                                                ),
                                                                        )}
                                                                    </span>
                                                                </div>

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
                                                                    ?.bills?.[0]
                                                                    ?.payments &&
                                                                    row.original
                                                                        .raw
                                                                        .session
                                                                        .bills[0]
                                                                        .payments
                                                                        .length >
                                                                        0 && (
                                                                        <ul className="m-0 flex w-full flex-col ps-0">
                                                                            {row.original.raw.session.bills[0].payments.map(
                                                                                (
                                                                                    payment: any,
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
                                                                                                    {payment
                                                                                                        .payment_method
                                                                                                        ?.name ||
                                                                                                        'Pagamento'}
                                                                                                </span>
                                                                                            </div>
                                                                                            <span className="text-sm font-semibold">
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
                                                                                        </div>

                                                                                        {payment.change &&
                                                                                            parseFloat(
                                                                                                payment.change,
                                                                                            ) >
                                                                                                0 && (
                                                                                                <div className="flex w-full flex-row justify-between gap-2 text-xs text-muted-foreground">
                                                                                                    <span>
                                                                                                        Troco
                                                                                                    </span>
                                                                                                    <span>
                                                                                                        {new Intl.NumberFormat(
                                                                                                            'pt-BR',
                                                                                                            {
                                                                                                                style: 'currency',
                                                                                                                currency:
                                                                                                                    'BRL',
                                                                                                            },
                                                                                                        ).format(
                                                                                                            parseFloat(
                                                                                                                payment.change,
                                                                                                            ),
                                                                                                        )}
                                                                                                    </span>
                                                                                                </div>
                                                                                            )}
                                                                                    </li>
                                                                                ),
                                                                            )}
                                                                        </ul>
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
                                {[10, 20, 30, 40, 50].map((pageSize) => (
                                    <SelectItem
                                        key={pageSize}
                                        value={`${pageSize}`}
                                    >
                                        {pageSize}
                                    </SelectItem>
                                ))}
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
                                    href={`/orders?page=1&per_page=${pagination.per_page}`}
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
                                    href={`/orders?page=${pagination.last_page}&per_page=${pagination.per_page}`}
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
                />
            )}
        </div>
    );
}
