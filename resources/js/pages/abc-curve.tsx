import { Head, router } from '@inertiajs/react';
import { IconSearch } from '@tabler/icons-react';
import {
    type ColumnDef,
    type ColumnFiltersState,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    type SortingState,
    useReactTable,
    type VisibilityState,
} from '@tanstack/react-table';
import { ArrowUpDown, ChevronDown } from 'lucide-react';
import * as React from 'react';
import { useMemo, useState } from 'react';

import { DateRangePicker } from '@/components/date-range-picker';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem, type DateRange } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Curva ABC',
        href: '/abc-curve',
    },
];

type Product = {
    id: number;
    name: string;
    sku: string | null;
    quantity: number;
    revenue: number;
    profit: number;
    cost: number;
    order_count: number;
    percentage: number;
    curve: 'A' | 'B' | 'C';
};

type CurveMetrics = {
    quantity: number;
    revenue: number;
    count: number;
};

type AbcCurveProps = {
    products: Product[];
    metrics: {
        curveA: CurveMetrics;
        curveB: CurveMetrics;
        curveC: CurveMetrics;
        total: CurveMetrics;
    };
    filters: {
        start_date: string;
        end_date: string;
    };
};

export default function AbcCurve({
    products,
    metrics,
    filters,
}: AbcCurveProps) {
    const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
        if (filters.start_date && filters.end_date) {
            return {
                from: new Date(filters.start_date + 'T12:00:00'),
                to: new Date(filters.end_date + 'T12:00:00'),
            };
        }
        return undefined;
    });

    const [sorting, setSorting] = useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
        {},
    );
    const [curveFilter, setCurveFilter] = useState<string>('all');

    const handleDateRangeChange = (range: DateRange | undefined) => {
        setDateRange(range);
        router.get(
            '/abc-curve',
            {
                start_date: range?.from
                    ? range.from.toISOString().split('T')[0]
                    : undefined,
                end_date: range?.to
                    ? range.to.toISOString().split('T')[0]
                    : undefined,
            },
            {
                preserveState: true,
                preserveScroll: true,
            },
        );
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
        }).format(value);
    };

    const formatNumber = (value: number) => {
        return new Intl.NumberFormat('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(value);
    };

    const getCurveBadgeColor = (curve: string) => {
        switch (curve) {
            case 'A':
                return 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100';
            case 'B':
                return 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100';
            case 'C':
                return 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100';
            default:
                return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    const columns: ColumnDef<Product>[] = useMemo(
        () => [
            {
                accessorKey: 'name',
                id: 'name',
                meta: {
                    label: 'Nome',
                },
                header: ({ column }) => {
                    return (
                        <Button
                            variant="ghost"
                            onClick={() =>
                                column.toggleSorting(
                                    column.getIsSorted() === 'asc',
                                )
                            }
                        >
                            Item
                            <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                    );
                },
                cell: ({ row }) => {
                    const product = row.original;
                    return (
                        <div className="flex items-center gap-3">
                            <div
                                className={`flex h-10 w-10 items-center justify-center rounded text-xs font-medium ${
                                    product.curve === 'A'
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : product.curve === 'B'
                                          ? 'bg-blue-100 text-blue-700'
                                          : 'bg-amber-100 text-amber-700'
                                }`}
                            >
                                {product.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <div className="font-medium">
                                    {product.name}
                                </div>
                                {product.sku && (
                                    <div className="text-xs text-muted-foreground">
                                        SKU: {product.sku}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                },
            },
            {
                accessorKey: 'quantity',
                id: 'quantity',
                meta: {
                    label: 'Quantidade',
                },
                header: ({ column }) => {
                    return (
                        <Button
                            variant="ghost"
                            onClick={() =>
                                column.toggleSorting(
                                    column.getIsSorted() === 'asc',
                                )
                            }
                            className="w-full justify-end"
                        >
                            Unidades
                            <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                    );
                },
                cell: ({ row }) => {
                    return (
                        <div className="text-right">
                            {formatNumber(row.getValue('quantity'))}
                        </div>
                    );
                },
            },
            {
                accessorKey: 'revenue',
                id: 'revenue',
                meta: {
                    label: 'Faturamento',
                },
                header: ({ column }) => {
                    return (
                        <Button
                            variant="ghost"
                            onClick={() =>
                                column.toggleSorting(
                                    column.getIsSorted() === 'asc',
                                )
                            }
                            className="w-full justify-end"
                        >
                            Faturamento
                            <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                    );
                },
                cell: ({ row }) => {
                    return (
                        <div className="text-right font-medium">
                            {formatCurrency(row.getValue('revenue'))}
                        </div>
                    );
                },
            },
            {
                accessorKey: 'profit',
                id: 'profit',
                meta: {
                    label: 'Lucro',
                },
                header: ({ column }) => {
                    return (
                        <Button
                            variant="ghost"
                            onClick={() =>
                                column.toggleSorting(
                                    column.getIsSorted() === 'asc',
                                )
                            }
                            className="w-full justify-end"
                        >
                            Lucro
                            <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                    );
                },
                cell: ({ row }) => {
                    const profit = row.getValue('profit') as number;
                    return (
                        <div
                            className={`text-right font-medium ${
                                profit >= 0
                                    ? 'text-emerald-600'
                                    : 'text-red-600'
                            }`}
                        >
                            {formatCurrency(profit)}
                        </div>
                    );
                },
            },
            {
                accessorKey: 'percentage',
                id: 'percentage',
                meta: {
                    label: 'Porcentagem',
                },
                header: ({ column }) => {
                    return (
                        <Button
                            variant="ghost"
                            onClick={() =>
                                column.toggleSorting(
                                    column.getIsSorted() === 'asc',
                                )
                            }
                            className="w-full justify-end"
                        >
                            % Faturamento
                            <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                    );
                },
                cell: ({ row }) => {
                    return (
                        <div className="text-right">
                            {(row.getValue('percentage') as number).toFixed(2)}%
                        </div>
                    );
                },
            },
            {
                accessorKey: 'order_count',
                id: 'order_count',
                meta: {
                    label: 'Nº de Pedidos',
                },
                header: ({ column }) => {
                    return (
                        <Button
                            variant="ghost"
                            onClick={() =>
                                column.toggleSorting(
                                    column.getIsSorted() === 'asc',
                                )
                            }
                            className="w-full justify-end"
                        >
                            Pedidos
                            <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                    );
                },
                cell: ({ row }) => {
                    return (
                        <div className="text-right">
                            {row.getValue('order_count')}
                        </div>
                    );
                },
            },
            {
                accessorKey: 'curve',
                id: 'curve',
                meta: {
                    label: 'Curva',
                },
                header: () => <div className="text-center">Curva</div>,
                cell: ({ row }) => {
                    const curve = row.getValue('curve') as string;
                    return (
                        <div className="flex justify-center">
                            <Badge
                                variant="outline"
                                className={getCurveBadgeColor(curve)}
                            >
                                {curve}
                            </Badge>
                        </div>
                    );
                },
                filterFn: (row, id, value) => {
                    return row.getValue(id) === value;
                },
            },
        ],
        [],
    );

    const table = useReactTable({
        data: products,
        columns,
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        onColumnVisibilityChange: setColumnVisibility,
        state: {
            sorting,
            columnFilters,
            columnVisibility,
        },
        initialState: {
            pagination: {
                pageSize: 25,
            },
        },
    });

    // Sincronizar curveFilter com o filtro da tabela
    React.useEffect(() => {
        if (curveFilter === 'all') {
            table.getColumn('curve')?.setFilterValue(undefined);
        } else {
            table.getColumn('curve')?.setFilterValue(curveFilter);
        }
    }, [curveFilter, table]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Curva ABC" />

            <div className="flex flex-1 flex-col">
                <div className="@container/main flex flex-1 flex-col gap-2">
                    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                        {/* Header */}
                        <div className="flex flex-col gap-4 px-4 lg:px-6">
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex flex-col gap-1">
                                    <h1 className="text-2xl font-bold">
                                        Curva ABC
                                    </h1>
                                    <p className="text-muted-foreground">
                                        Análise de vendas por produto baseada no
                                        princípio de Pareto
                                    </p>
                                </div>
                                <DateRangePicker
                                    value={dateRange}
                                    onChange={handleDateRangeChange}
                                />
                            </div>
                        </div>

                        {/* Cards de Curvas */}
                        <div className="grid grid-cols-1 gap-4 px-4 md:grid-cols-2 lg:grid-cols-4 lg:px-6">
                            <Card className="border-l-4 border-l-emerald-500 bg-gradient-to-br from-emerald-50/50 to-transparent">
                                <CardHeader>
                                    <CardTitle className="text-lg text-emerald-700">
                                        Curva A
                                    </CardTitle>
                                    <CardDescription>
                                        {metrics.curveA.count} produtos (
                                        {(
                                            (metrics.curveA.count /
                                                metrics.total.count) *
                                            100
                                        ).toFixed(1)}
                                        %)
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                            Unidades vendidas
                                        </span>
                                        <span className="font-medium">
                                            {formatNumber(
                                                metrics.curveA.quantity,
                                            )}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                            Faturamento
                                        </span>
                                        <span className="font-medium">
                                            {formatCurrency(
                                                metrics.curveA.revenue,
                                            )}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-xs text-muted-foreground">
                                        <span>% do total</span>
                                        <span>
                                            {(
                                                (metrics.curveA.revenue /
                                                    metrics.total.revenue) *
                                                100
                                            ).toFixed(1)}
                                            %
                                        </span>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="border-l-4 border-l-blue-500 bg-gradient-to-br from-blue-50/50 to-transparent">
                                <CardHeader>
                                    <CardTitle className="text-lg text-blue-700">
                                        Curva B
                                    </CardTitle>
                                    <CardDescription>
                                        {metrics.curveB.count} produtos (
                                        {(
                                            (metrics.curveB.count /
                                                metrics.total.count) *
                                            100
                                        ).toFixed(1)}
                                        %)
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                            Unidades vendidas
                                        </span>
                                        <span className="font-medium">
                                            {formatNumber(
                                                metrics.curveB.quantity,
                                            )}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                            Faturamento
                                        </span>
                                        <span className="font-medium">
                                            {formatCurrency(
                                                metrics.curveB.revenue,
                                            )}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-xs text-muted-foreground">
                                        <span>% do total</span>
                                        <span>
                                            {(
                                                (metrics.curveB.revenue /
                                                    metrics.total.revenue) *
                                                100
                                            ).toFixed(1)}
                                            %
                                        </span>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="border-l-4 border-l-amber-500 bg-gradient-to-br from-amber-50/50 to-transparent">
                                <CardHeader>
                                    <CardTitle className="text-lg text-amber-700">
                                        Curva C
                                    </CardTitle>
                                    <CardDescription>
                                        {metrics.curveC.count} produtos (
                                        {(
                                            (metrics.curveC.count /
                                                metrics.total.count) *
                                            100
                                        ).toFixed(1)}
                                        %)
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                            Unidades vendidas
                                        </span>
                                        <span className="font-medium">
                                            {formatNumber(
                                                metrics.curveC.quantity,
                                            )}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                            Faturamento
                                        </span>
                                        <span className="font-medium">
                                            {formatCurrency(
                                                metrics.curveC.revenue,
                                            )}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-xs text-muted-foreground">
                                        <span>% do total</span>
                                        <span>
                                            {(
                                                (metrics.curveC.revenue /
                                                    metrics.total.revenue) *
                                                100
                                            ).toFixed(1)}
                                            %
                                        </span>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">
                                        Total
                                    </CardTitle>
                                    <CardDescription>
                                        {metrics.total.count} produtos
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                            Unidades vendidas
                                        </span>
                                        <span className="font-medium">
                                            {formatNumber(
                                                metrics.total.quantity,
                                            )}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                            Faturamento
                                        </span>
                                        <span className="font-medium">
                                            {formatCurrency(
                                                metrics.total.revenue,
                                            )}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-xs text-muted-foreground">
                                        <span>Ticket médio</span>
                                        <span>
                                            {formatCurrency(
                                                metrics.total.revenue /
                                                    metrics.total.quantity,
                                            )}
                                        </span>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Filtros da Tabela */}
                        <div className="flex w-full flex-col gap-4 px-4 lg:px-6">
                            <div className="flex flex-wrap items-center gap-4">
                                <div className="relative flex-1">
                                    <IconSearch className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        placeholder="Pesquisar produto..."
                                        value={
                                            (table
                                                .getColumn('name')
                                                ?.getFilterValue() as string) ??
                                            ''
                                        }
                                        onChange={(event) =>
                                            table
                                                .getColumn('name')
                                                ?.setFilterValue(
                                                    event.target.value,
                                                )
                                        }
                                        className="pl-9"
                                    />
                                </div>
                                <Select
                                    value={curveFilter}
                                    onValueChange={setCurveFilter}
                                >
                                    <SelectTrigger className="w-[140px]">
                                        <SelectValue placeholder="Todas curvas" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">
                                            Todas
                                        </SelectItem>
                                        <SelectItem value="A">
                                            Curva A
                                        </SelectItem>
                                        <SelectItem value="B">
                                            Curva B
                                        </SelectItem>
                                        <SelectItem value="C">
                                            Curva C
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline">
                                            Colunas{' '}
                                            <ChevronDown className="ml-2 h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        {table
                                            .getAllColumns()
                                            .filter((column) =>
                                                column.getCanHide(),
                                            )
                                            .map((column) => {
                                                const meta = column.columnDef
                                                    .meta as
                                                    | { label?: string }
                                                    | undefined;
                                                return (
                                                    <DropdownMenuCheckboxItem
                                                        key={column.id}
                                                        className="capitalize"
                                                        checked={column.getIsVisible()}
                                                        onCheckedChange={(
                                                            value,
                                                        ) =>
                                                            column.toggleVisibility(
                                                                !!value,
                                                            )
                                                        }
                                                    >
                                                        {meta?.label ||
                                                            column.id}
                                                    </DropdownMenuCheckboxItem>
                                                );
                                            })}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>

                        {/* Tabela de Produtos com DataTable */}
                        <div className="flex w-full flex-col gap-4 space-x-4 px-4 lg:px-6">
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        {table
                                            .getHeaderGroups()
                                            .map((headerGroup) => (
                                                <TableRow key={headerGroup.id}>
                                                    {headerGroup.headers.map(
                                                        (header) => {
                                                            return (
                                                                <TableHead
                                                                    key={
                                                                        header.id
                                                                    }
                                                                >
                                                                    {header.isPlaceholder
                                                                        ? null
                                                                        : flexRender(
                                                                              header
                                                                                  .column
                                                                                  .columnDef
                                                                                  .header,
                                                                              header.getContext(),
                                                                          )}
                                                                </TableHead>
                                                            );
                                                        },
                                                    )}
                                                </TableRow>
                                            ))}
                                    </TableHeader>
                                    <TableBody>
                                        {table.getRowModel().rows?.length ? (
                                            table
                                                .getRowModel()
                                                .rows.map((row) => (
                                                    <TableRow
                                                        key={row.id}
                                                        data-state={
                                                            row.getIsSelected() &&
                                                            'selected'
                                                        }
                                                    >
                                                        {row
                                                            .getVisibleCells()
                                                            .map((cell) => (
                                                                <TableCell
                                                                    key={
                                                                        cell.id
                                                                    }
                                                                >
                                                                    {flexRender(
                                                                        cell
                                                                            .column
                                                                            .columnDef
                                                                            .cell,
                                                                        cell.getContext(),
                                                                    )}
                                                                </TableCell>
                                                            ))}
                                                    </TableRow>
                                                ))
                                        ) : (
                                            <TableRow>
                                                <TableCell
                                                    colSpan={columns.length}
                                                    className="h-24 text-center"
                                                >
                                                    Nenhum produto encontrado
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Paginação */}
                            <div className="flex items-center justify-between bg-background px-4 py-3">
                                <div className="hidden flex-1 text-sm text-muted-foreground lg:flex">
                                    Exibindo{' '}
                                    {table.getState().pagination.pageIndex *
                                        table.getState().pagination.pageSize +
                                        1}{' '}
                                    -{' '}
                                    {Math.min(
                                        (table.getState().pagination.pageIndex +
                                            1) *
                                            table.getState().pagination
                                                .pageSize,
                                        products.length,
                                    )}{' '}
                                    de {products.length} produtos
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
                                                table.setPageSize(
                                                    Number(value),
                                                );
                                            }}
                                        >
                                            <SelectTrigger
                                                size="sm"
                                                className="w-20"
                                                id="rows-per-page"
                                            >
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent side="top">
                                                {[10, 25, 50, 100].map(
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
                                        Página{' '}
                                        {table.getState().pagination.pageIndex +
                                            1}{' '}
                                        de {table.getPageCount()}
                                    </div>

                                    <div className="ml-auto flex items-center gap-2 lg:ml-0">
                                        {/* Primeira */}
                                        <Button
                                            variant="outline"
                                            className="hidden h-8 w-8 p-0 lg:flex"
                                            size="icon"
                                            onClick={() =>
                                                table.setPageIndex(0)
                                            }
                                            disabled={
                                                !table.getCanPreviousPage()
                                            }
                                        >
                                            <span className="sr-only">
                                                Ir para primeira página
                                            </span>
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                width="24"
                                                height="24"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                className="h-4 w-4"
                                            >
                                                <polyline points="11 17 6 12 11 7"></polyline>
                                                <polyline points="18 17 13 12 18 7"></polyline>
                                            </svg>
                                        </Button>

                                        {/* Anterior */}
                                        <Button
                                            variant="outline"
                                            className="size-8"
                                            size="icon"
                                            onClick={() => table.previousPage()}
                                            disabled={
                                                !table.getCanPreviousPage()
                                            }
                                        >
                                            <span className="sr-only">
                                                Ir para página anterior
                                            </span>
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                width="24"
                                                height="24"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                className="h-4 w-4"
                                            >
                                                <polyline points="15 18 9 12 15 6"></polyline>
                                            </svg>
                                        </Button>

                                        {/* Próxima */}
                                        <Button
                                            variant="outline"
                                            className="size-8"
                                            size="icon"
                                            onClick={() => table.nextPage()}
                                            disabled={!table.getCanNextPage()}
                                        >
                                            <span className="sr-only">
                                                Ir para próxima página
                                            </span>
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                width="24"
                                                height="24"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                className="h-4 w-4"
                                            >
                                                <polyline points="9 18 15 12 9 6"></polyline>
                                            </svg>
                                        </Button>

                                        {/* Última */}
                                        <Button
                                            variant="outline"
                                            className="hidden size-8 lg:flex"
                                            size="icon"
                                            onClick={() =>
                                                table.setPageIndex(
                                                    table.getPageCount() - 1,
                                                )
                                            }
                                            disabled={!table.getCanNextPage()}
                                        >
                                            <span className="sr-only">
                                                Ir para última página
                                            </span>
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                width="24"
                                                height="24"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                className="h-4 w-4"
                                            >
                                                <polyline points="13 17 18 12 13 7"></polyline>
                                                <polyline points="6 17 11 12 6 7"></polyline>
                                            </svg>
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
