import {
    ColumnFiltersState,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getSortedRowModel,
    SortingState,
    useReactTable,
    VisibilityState,
} from '@tanstack/react-table';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
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
import { router } from '@inertiajs/react';
import {
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    Columns3,
} from 'lucide-react';
import { TaxCategory, columns as taxCategoryColumns } from './columns';

interface Pagination {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
}

interface Filters {
    search: string;
    active: string;
    tax_calculation_type: string;
    per_page: number;
}

interface DataTableProps {
    data: TaxCategory[];
    columns?: typeof taxCategoryColumns;
    pagination: Pagination;
    filters: Filters;
}

export function DataTable({
    data,
    columns = taxCategoryColumns,
    pagination,
    filters,
}: DataTableProps) {
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [columnFilters, setColumnFilters] =
        React.useState<ColumnFiltersState>([]);
    const [columnVisibility, setColumnVisibility] =
        React.useState<VisibilityState>({});
    const [searchValue, setSearchValue] = React.useState(filters?.search ?? '');

    // Debounce para o search
    React.useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (searchValue !== filters?.search) {
                router.get(
                    '/tax-categories',
                    { ...filters, search: searchValue, page: 1 },
                    { preserveState: true, preserveScroll: true },
                );
            }
        }, 500);

        return () => clearTimeout(timeoutId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchValue]);

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onColumnVisibilityChange: setColumnVisibility,
        state: {
            sorting,
            columnFilters,
            columnVisibility,
        },
    });

    const handleActiveFilter = (value: string) => {
        router.get(
            '/tax-categories',
            { ...filters, active: value === 'all' ? '' : value, page: 1 },
            { preserveState: true, preserveScroll: true },
        );
    };

    const handleCalculationTypeFilter = (value: string) => {
        router.get(
            '/tax-categories',
            {
                ...filters,
                tax_calculation_type: value === 'all' ? '' : value,
                page: 1,
            },
            { preserveState: true, preserveScroll: true },
        );
    };

    const handlePerPageChange = (value: string) => {
        router.get(
            '/tax-categories',
            { ...filters, per_page: parseInt(value), page: 1 },
            { preserveState: true, preserveScroll: true },
        );
    };

    const goToPage = (page: number) => {
        router.get(
            '/tax-categories',
            { ...filters, page },
            { preserveState: true, preserveScroll: true },
        );
    };

    return (
        <div className="flex w-full flex-col gap-4 px-4 lg:px-6">
            {/* 🔎 Filtros */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                    {/* Buscar por nome, CFOP, CST ou NCM */}
                    <Input
                        placeholder="Buscar por nome, CFOP, CST ou NCM..."
                        value={searchValue}
                        onChange={(e) => setSearchValue(e.target.value)}
                        className="h-9 w-[280px]"
                    />

                    {/* Filtro por status */}
                    <Select
                        value={
                            filters?.active && filters.active !== ''
                                ? filters.active
                                : 'all'
                        }
                        onValueChange={handleActiveFilter}
                    >
                        <SelectTrigger className="h-9 w-[130px]">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos</SelectItem>
                            <SelectItem value="1">Ativos</SelectItem>
                            <SelectItem value="0">Inativos</SelectItem>
                        </SelectContent>
                    </Select>

                    {/* Filtro por tipo de cálculo */}
                    <Select
                        value={
                            filters?.tax_calculation_type &&
                            filters.tax_calculation_type !== ''
                                ? filters.tax_calculation_type
                                : 'all'
                        }
                        onValueChange={handleCalculationTypeFilter}
                    >
                        <SelectTrigger className="h-9 w-[170px]">
                            <SelectValue placeholder="Tipo de cálculo" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos os tipos</SelectItem>
                            <SelectItem value="detailed">
                                📊 Detalhado
                            </SelectItem>
                            <SelectItem value="fixed">💰 Fixo</SelectItem>
                            <SelectItem value="none">🚫 Isento</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Dropdown de colunas */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="h-9">
                            <Columns3 className="mr-2 h-4 w-4" />
                            Colunas
                            <ChevronDown className="ml-2 h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {table
                            .getAllColumns()
                            .filter((column) => column.getCanHide())
                            .map((column) => {
                                const columnLabels: Record<string, string> = {
                                    name: 'Nome',
                                    sale_cfop: 'CFOP Venda',
                                    csosn_cst: 'CSOSN/CST',
                                    ncm: 'NCM',
                                    icms_origin: 'Origem ICMS',
                                    tax_calculation_type: 'Tipo de Cálculo',
                                    total_tax_rate: 'Total de Impostos',
                                };
                                return (
                                    <DropdownMenuCheckboxItem
                                        key={column.id}
                                        checked={column.getIsVisible()}
                                        onCheckedChange={(value) =>
                                            column.toggleVisibility(!!value)
                                        }
                                    >
                                        {columnLabels[column.id] || column.id}
                                    </DropdownMenuCheckboxItem>
                                );
                            })}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Tabela */}
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => {
                                    return (
                                        <TableHead key={header.id}>
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(
                                                      header.column.columnDef
                                                          .header,
                                                      header.getContext(),
                                                  )}
                                        </TableHead>
                                    );
                                })}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    data-state={
                                        row.getIsSelected() && 'selected'
                                    }
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id}>
                                            {flexRender(
                                                cell.column.columnDef.cell,
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
                                    Nenhum resultado encontrado.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Paginação */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <p className="text-sm text-muted-foreground">
                        Mostrando{' '}
                        {(pagination.current_page - 1) * pagination.per_page +
                            1}{' '}
                        a{' '}
                        {Math.min(
                            pagination.current_page * pagination.per_page,
                            pagination.total,
                        )}{' '}
                        de {pagination.total} resultado(s)
                    </p>
                </div>

                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                        <p className="text-sm text-muted-foreground">
                            Linhas por página
                        </p>
                        <Select
                            value={filters.per_page.toString()}
                            onValueChange={handlePerPageChange}
                        >
                            <SelectTrigger className="h-8 w-[70px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {[10, 20, 30, 50, 100].map((pageSize) => (
                                    <SelectItem
                                        key={pageSize}
                                        value={pageSize.toString()}
                                    >
                                        {pageSize}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => goToPage(1)}
                            disabled={pagination.current_page === 1}
                        >
                            <ChevronsLeft className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() =>
                                goToPage(pagination.current_page - 1)
                            }
                            disabled={pagination.current_page === 1}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <div className="flex items-center gap-1">
                            <span className="text-sm">
                                Página {pagination.current_page} de{' '}
                                {pagination.last_page}
                            </span>
                        </div>
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() =>
                                goToPage(pagination.current_page + 1)
                            }
                            disabled={
                                pagination.current_page === pagination.last_page
                            }
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => goToPage(pagination.last_page)}
                            disabled={
                                pagination.current_page === pagination.last_page
                            }
                        >
                            <ChevronsRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
