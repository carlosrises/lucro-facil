import {
    ColumnFiltersState,
    flexRender,
    getCoreRowModel,
    getExpandedRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    SortingState,
    useReactTable,
    VisibilityState,
} from '@tanstack/react-table';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
    IconChevronDown,
    IconChevronLeft,
    IconChevronRight,
    IconChevronsLeft,
    IconChevronsRight,
    IconLayoutColumns,
} from '@tabler/icons-react';

import { DateRangePicker } from '@/components/date-range-picker';
import { columns, Sale } from '@/components/sales/columns';
import { SaleExpandedDetails } from '@/components/sales/sale-expanded-details';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { DateRange } from 'react-day-picker';

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
    channel?: string;
    start_date?: string;
    end_date?: string;
    per_page?: number;
    page?: number;
};

export function DataTable({
    data,
    pagination: serverPagination,
    filters,
    stores,
}: {
    data: Sale[];
    pagination: Pagination;
    filters: Filters;
    stores: { id: number; name: string }[];
}) {
    // Evita warnings dos parâmetros não usados
    React.useEffect(() => {
        // Parâmetros disponíveis para uso futuro
        console.log(
            'Filters:',
            filters,
            'Stores:',
            stores,
            'Pagination:',
            serverPagination,
        );
    }, [filters, stores, serverPagination]);

    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [dateRange, setDateRange] = React.useState<DateRange | undefined>({
        from: undefined,
        to: undefined,
    });

    const [columnFilters, setColumnFilters] =
        React.useState<ColumnFiltersState>([]);
    const [columnVisibility, setColumnVisibility] =
        React.useState<VisibilityState>({});
    const [pagination, setPagination] = React.useState({
        pageIndex: 0,
        pageSize: 10,
    });

    const table = useReactTable({
        data: data || [],
        columns,
        state: {
            sorting,
            columnFilters,
            columnVisibility,
            pagination,
        },
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onColumnVisibilityChange: setColumnVisibility,
        onPaginationChange: setPagination,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getExpandedRowModel: getExpandedRowModel(),
    });

    return (
        <div className="flex w-full flex-col gap-4 space-x-4 px-4 lg:px-6">
            {/* 🔎 Filtros */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                    {/* Buscar por código */}
                    <Input
                        placeholder="Buscar pedido..."
                        value={
                            (table
                                .getColumn('code')
                                ?.getFilterValue() as string) ?? ''
                        }
                        onChange={(e) =>
                            table
                                .getColumn('code')
                                ?.setFilterValue(e.target.value)
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
                                value: 'PREPARATION_STARTED',
                                label: 'Em preparação',
                            },
                            { value: 'DISPATCHED', label: 'Despachado' },
                            {
                                value: 'READY_TO_PICKUP',
                                label: 'Pronto para retirada',
                            },
                            { value: 'CONCLUDED', label: 'Concluído' },
                            { value: 'CANCELLED', label: 'Cancelado' },
                        ]}
                        placeholder="Filtrar status"
                        value={
                            (table
                                .getColumn('status')
                                ?.getFilterValue() as string) ?? ''
                        }
                        onChange={(value) =>
                            table
                                .getColumn('status')
                                ?.setFilterValue(
                                    value === 'all' ? undefined : value,
                                )
                        }
                    />

                    {/* Filtro por canal */}
                    <Combobox
                        options={[
                            { value: 'all', label: 'Todos as canais' },
                            { value: 'ifood', label: 'iFood' },
                            { value: 'takeat', label: 'Takeat' },
                            { value: '99food', label: '99Food' },
                        ]}
                        placeholder="Filtrar canal"
                        value={
                            (table
                                .getColumn('provider')
                                ?.getFilterValue() as string) ?? ''
                        }
                        onChange={(value) =>
                            table
                                .getColumn('provider')
                                ?.setFilterValue(
                                    value === 'all' ? undefined : value,
                                )
                        }
                    />

                    {/* 📅 Date Range */}
                    <DateRangePicker
                        value={dateRange}
                        onChange={(range) => {
                            setDateRange(range);
                            table
                                .getColumn('placed_at')
                                ?.setFilterValue(range ?? undefined);
                        }}
                    />
                </div>

                {/* Colunas visíveis */}
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
                            .map((column) => {
                                return (
                                    <DropdownMenuCheckboxItem
                                        key={column.id}
                                        checked={column.getIsVisible()}
                                        onCheckedChange={(value) =>
                                            column.toggleVisibility(!!value)
                                        }
                                    >
                                        {typeof column.columnDef.header ===
                                        'string'
                                            ? column.columnDef.header
                                            : column.id}
                                    </DropdownMenuCheckboxItem>
                                );
                            })}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* 📋 Tabela */}
            <div className="mt-4 overflow-hidden rounded-lg border">
                <Table className="text-xs lg:text-sm">
                    <TableHeader className="sticky top-0 z-10 bg-muted">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <TableHead
                                        key={header.id}
                                        className={
                                            [
                                                'total',
                                                'cost',
                                                'tax',
                                                'extra_cost',
                                                'net_total',
                                                'margin',
                                                'expand',
                                            ].includes(header.column.id)
                                                ? 'text-end'
                                                : 'text-start'
                                        }
                                    >
                                        {header.isPlaceholder
                                            ? null
                                            : flexRender(
                                                  header.column.columnDef
                                                      .header,
                                                  header.getContext(),
                                              )}
                                    </TableHead>
                                ))}
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
                                                className="border-t-0 p-0"
                                            >
                                                <SaleExpandedDetails
                                                    sale={row.original}
                                                />
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </React.Fragment>
                            ))
                        ) : (
                            <React.Fragment>
                                <TableRow>
                                    <TableCell>
                                                        <CardHeader className="gap-0 bg-gray-100 px-2 py-2 dark:bg-neutral-950">
                                                            <CardTitle className="flex items-center gap-1 font-semibold">
                                                                Itens do Pedido{' '}
                                                                <Badge className="text-14px/[16px] bg-gray-200 px-3 py-0 text-gray-600">
                                                                    2
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
                                                                {row.original.raw?.items?.map(
                                                                    (
                                                                        item: RawSaleItem,
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
                                                                            {item.options &&
                                                                                item
                                                                                    .options
                                                                                    .length >
                                                                                    0 && (
                                                                                    <ul className="m-0 flex w-full basis-full list-none flex-col gap-0 pt-0 pl-0">
                                                                                        {item.options.map(
                                                                                            (
                                                                                                opt: NonNullable<
                                                                                                    RawSaleItem['options']
                                                                                                >[0],
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
                                                                                                            opt.unitPrice ??
                                                                                                                opt.totalPrice ??
                                                                                                                0,
                                                                                                        )}
                                                                                                    </span>

                                                                                                    {/* Terceiro nível (customizations) */}
                                                                                                    {opt.customizations &&
                                                                                                        opt
                                                                                                            .customizations
                                                                                                            .length >
                                                                                                            0 && (
                                                                                                            <ul className="m-0 flex w-full basis-full list-none flex-col gap-0 pt-0 pl-0">
                                                                                                                {opt.customizations.map(
                                                                                                                    (
                                                                                                                        cust: NonNullable<
                                                                                                                            NonNullable<
                                                                                                                                RawSaleItem['options']
                                                                                                                            >[0]['customizations']
                                                                                                                        >[0],
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
                                                                                                                                    cust.unitPrice ??
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
                                                                )}

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
                                                                        R$ 21,00
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </CardContent>
                                                    </Card>

                                                    {/* Card: Detalhamento Financeiro */}
                                                    <Card className="h-fit gap-1 border-0 bg-gray-100 p-1 text-sm shadow-none dark:bg-neutral-950">
                                                        <CardHeader className="gap-0 bg-gray-100 px-2 py-2 dark:bg-neutral-950">
                                                            <CardTitle className="flex h-[18px] items-center font-semibold">
                                                                Detalhamento
                                                                financeiro do
                                                                pedido
                                                            </CardTitle>
                                                        </CardHeader>
                                                        <CardContent className="rounded-md bg-card p-0">
                                                            <ul className="m-0 flex w-full flex-col ps-0">
                                                                {/* Valor bruto da venda */}
                                                                <li className="flex flex-col gap-2 border-b-1 px-0 py-4">
                                                                    <div className="flex w-full flex-row items-center gap-2 px-3 py-0">
                                                                        <div className="flex items-center justify-center rounded-full bg-green-100 p-0.5 text-green-800">
                                                                            <ArrowUpRight className="h-4 w-4" />
                                                                        </div>
                                                                        <span className="flex-grow text-sm leading-4 font-semibold">
                                                                            Valor
                                                                            bruto
                                                                            da
                                                                            venda
                                                                        </span>
                                                                        <span className="text-sm leading-4 whitespace-nowrap">
                                                                            R$
                                                                            54,49
                                                                        </span>
                                                                    </div>
                                                                    <ul className="flex w-full flex-col items-center justify-between gap-2 pl-0">
                                                                        <li className="flex w-full flex-row items-start justify-between px-3 py-0">
                                                                            <span className="text-xs leading-4 font-normal text-muted-foreground">
                                                                                Total
                                                                                recebido
                                                                                via
                                                                                iFood
                                                                            </span>
                                                                        </li>
                                                                        <li className="flex w-full flex-row items-start justify-between px-3 py-0">
                                                                            <span className="text-xs leading-4 font-normal text-muted-foreground">
                                                                                Promoções
                                                                                custeadas
                                                                                pela
                                                                                loja
                                                                            </span>
                                                                        </li>
                                                                        <li className="flex w-full flex-row items-start justify-between px-3 py-0">
                                                                            <span className="text-xs leading-4 font-normal text-muted-foreground">
                                                                                Taxa
                                                                                de
                                                                                entrega
                                                                                no
                                                                                valor
                                                                                de
                                                                                R$
                                                                                0,00
                                                                            </span>
                                                                        </li>
                                                                    </ul>
                                                                </li>

                                                                {/* Valores pagos pelo cliente devidos ao iFood */}
                                                                <li className="flex flex-col gap-2 border-b-1 px-0 py-4">
                                                                    <div className="flex w-full flex-row items-center gap-2 px-3 py-0">
                                                                        <div className="flex items-center justify-center rounded-full bg-red-100 p-0.5 text-red-900">
                                                                            <ArrowDownLeft className="h-4 w-4" />
                                                                        </div>
                                                                        <span className="flex-grow text-sm leading-4 font-semibold">
                                                                            Valores
                                                                            pagos
                                                                            pelo
                                                                            cliente
                                                                            devidos
                                                                            ao
                                                                            iFood
                                                                        </span>
                                                                        <span className="text-sm leading-4 whitespace-nowrap">
                                                                            -R$
                                                                            0,99
                                                                        </span>
                                                                    </div>
                                                                    <ul className="flex w-full flex-col items-center justify-between pl-0">
                                                                        <li className="flex w-full flex-row items-start justify-between px-3 py-2">
                                                                            <span className="text-sm leading-4 font-normal">
                                                                                <div className="flex h-[1em] items-center">
                                                                                    <span>
                                                                                        Taxa
                                                                                        de
                                                                                        serviço
                                                                                        iFood
                                                                                        cobrada
                                                                                        do
                                                                                        cliente
                                                                                    </span>
                                                                                </div>
                                                                            </span>
                                                                            <span className="text-sm leading-4 font-normal whitespace-nowrap text-gray-700">
                                                                                -R$
                                                                                0,99
                                                                            </span>
                                                                        </li>
                                                                    </ul>
                                                                </li>

                                                                {/* Promoções */}
                                                                <li className="flex flex-col gap-2 border-b-1 px-0 py-4">
                                                                    <div className="flex w-full flex-row items-center gap-2 px-3 py-0">
                                                                        <div className="flex items-center justify-center rounded-full bg-red-100 p-0.5 text-red-900">
                                                                            <ArrowDownLeft className="h-4 w-4" />
                                                                        </div>
                                                                        <span className="flex-grow text-sm leading-4 font-semibold">
                                                                            Promoções
                                                                        </span>
                                                                        <span className="text-sm leading-4 whitespace-nowrap">
                                                                            -R$
                                                                            13,37
                                                                        </span>
                                                                    </div>
                                                                    <ul className="flex w-full flex-col items-center justify-between gap-2 pl-0">
                                                                        <li className="flex w-full flex-row items-start justify-between px-3 py-2">
                                                                            <span className="text-sm leading-4 font-normal">
                                                                                Promoção
                                                                                custeada
                                                                                pela
                                                                                loja
                                                                            </span>
                                                                            <span className="text-sm leading-4 font-normal whitespace-nowrap text-gray-700">
                                                                                -
                                                                                R$
                                                                                13,37
                                                                            </span>
                                                                        </li>
                                                                        <li className="flex w-full flex-row items-start justify-between px-3 py-2">
                                                                            <span className="text-sm leading-4 font-normal whitespace-nowrap text-muted-foreground">
                                                                                Cupom
                                                                                Clube
                                                                                25%
                                                                                off
                                                                                -
                                                                                Limitado
                                                                                a
                                                                                R$
                                                                                20
                                                                                -
                                                                                Para
                                                                                novos
                                                                                clientes
                                                                                no
                                                                                valor
                                                                                de
                                                                                R$
                                                                                13,37
                                                                            </span>
                                                                        </li>
                                                                    </ul>
                                                                </li>

                                                                {/* Total recebido via loja */}
                                                                <li className="flex flex-col gap-2 border-b-1 px-0 py-4">
                                                                    <div className="flex w-full flex-row items-center gap-2 px-3 py-0">
                                                                        <div className="flex items-center justify-center rounded-full bg-gray-200 p-1 text-gray-700">
                                                                            <ArrowRightLeft className="h-3 w-3" />
                                                                        </div>
                                                                        <span className="flex-grow text-sm leading-4 font-semibold">
                                                                            Total
                                                                            recebido
                                                                            via
                                                                            loja
                                                                        </span>
                                                                        <span className="text-sm leading-4 whitespace-nowrap">
                                                                            R$
                                                                            0,00
                                                                        </span>
                                                                    </div>
                                                                    <ul className="flex w-full flex-col items-center justify-between pl-0">
                                                                        <li className="flex w-full flex-row items-start justify-between px-3 py-2">
                                                                            <span className="text-sm leading-4 font-normal whitespace-nowrap text-gray-700">
                                                                                Pedido
                                                                                recebido
                                                                                via
                                                                                iFood
                                                                                no
                                                                                valor
                                                                                de
                                                                                R$
                                                                                41,12
                                                                            </span>
                                                                        </li>
                                                                    </ul>
                                                                </li>

                                                                {/* Taxas e comissões iFood */}
                                                                <li className="flex flex-col gap-2 border-b-1 px-0 py-4">
                                                                    <div className="flex w-full flex-row items-center gap-2 px-3 py-0">
                                                                        <div className="flex items-center justify-center rounded-full bg-red-100 p-0.5 text-red-900">
                                                                            <ArrowDownLeft className="h-4 w-4" />
                                                                        </div>
                                                                        <span className="flex-grow text-sm leading-4 font-semibold">
                                                                            Taxas
                                                                            e
                                                                            comissões
                                                                            iFood
                                                                        </span>
                                                                        <span className="text-sm leading-4 whitespace-nowrap">
                                                                            -R$
                                                                            6,10
                                                                        </span>
                                                                    </div>
                                                                    <ul className="flex w-full flex-col items-center justify-between pl-0">
                                                                        <li className="flex w-full flex-row items-start justify-between px-3 py-2">
                                                                            <span className="text-sm leading-4 font-normal">
                                                                                Comissão
                                                                                pela
                                                                                transação
                                                                                do
                                                                                pagamento{' '}
                                                                            </span>
                                                                            <span className="text-sm leading-4 font-normal whitespace-nowrap text-gray-700">
                                                                                -R$
                                                                                1,28
                                                                            </span>
                                                                        </li>
                                                                        <li className="flex w-full flex-row items-start justify-between px-3 py-2">
                                                                            <span className="text-sm leading-4 font-normal">
                                                                                Comissão
                                                                                iFood
                                                                                de
                                                                                Entrega
                                                                                Própria
                                                                                (12,0%)
                                                                            </span>
                                                                            <span className="text-sm leading-4 font-normal whitespace-nowrap text-gray-700">
                                                                                -R$
                                                                                4,82
                                                                            </span>
                                                                        </li>
                                                                        <li className="flex w-full flex-row items-start justify-between px-3 py-2">
                                                                            <span className="text-xs leading-4 font-normal text-gray-700">
                                                                                O
                                                                                valor
                                                                                de
                                                                                R$
                                                                                40,13
                                                                                é
                                                                                o
                                                                                valor
                                                                                base
                                                                                usado
                                                                                para
                                                                                calcular
                                                                                as
                                                                                taxas
                                                                                e
                                                                                comissões
                                                                                iFood
                                                                                desse
                                                                                pedido.
                                                                            </span>
                                                                        </li>
                                                                    </ul>
                                                                </li>

                                                                {/* Valor líquido a receber */}
                                                                <li className="flex flex-col gap-2 px-0 py-4">
                                                                    <ul className="flex w-full flex-col items-center justify-between pl-0">
                                                                        <li className="flex w-full flex-row items-start justify-between px-3 py-2">
                                                                            <span className="text-sm leading-4 font-semibold">
                                                                                Valor
                                                                                líquido
                                                                                a
                                                                                receber
                                                                            </span>
                                                                            <span className="positive text-sm leading-4 font-semibold text-green-700">
                                                                                R$
                                                                                34,03
                                                                            </span>
                                                                        </li>
                                                                    </ul>
                                                                </li>
                                                            </ul>
                                                        </CardContent>
                                                    </Card>
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
                    {table.getFilteredSelectedRowModel().rows.length} de{' '}
                    {table.getFilteredRowModel().rows.length} pedidos
                    selecionados.
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
                            value={`${table.getState().pagination.pageSize}`}
                            onValueChange={(value) => {
                                table.setPageSize(Number(value));
                            }}
                        >
                            <SelectTrigger
                                size="sm"
                                className="w-20"
                                id="rows-per-page"
                            >
                                <SelectValue
                                    placeholder={
                                        table.getState().pagination.pageSize
                                    }
                                />
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
                        Página {table.getState().pagination.pageIndex + 1} de{' '}
                        {table.getPageCount()}
                    </div>
                    <div className="ml-auto flex items-center gap-2 lg:ml-0">
                        <Button
                            variant="outline"
                            className="hidden h-8 w-8 p-0 lg:flex"
                            onClick={() => table.setPageIndex(0)}
                            disabled={!table.getCanPreviousPage()}
                        >
                            <IconChevronsLeft />
                        </Button>
                        <Button
                            variant="outline"
                            className="size-8"
                            size="icon"
                            onClick={() => table.previousPage()}
                            disabled={!table.getCanPreviousPage()}
                        >
                            <IconChevronLeft />
                        </Button>
                        <Button
                            variant="outline"
                            className="size-8"
                            size="icon"
                            onClick={() => table.nextPage()}
                            disabled={!table.getCanNextPage()}
                        >
                            <IconChevronRight />
                        </Button>
                        <Button
                            variant="outline"
                            className="hidden size-8 lg:flex"
                            size="icon"
                            onClick={() =>
                                table.setPageIndex(table.getPageCount() - 1)
                            }
                            disabled={!table.getCanNextPage()}
                        >
                            <IconChevronsRight />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
