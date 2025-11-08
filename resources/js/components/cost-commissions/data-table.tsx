'use client';

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
    IconChevronLeft,
    IconChevronRight,
    IconChevronsLeft,
    IconChevronsRight,
} from '@tabler/icons-react';
import {
    ColumnFiltersState,
    SortingState,
    VisibilityState,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getSortedRowModel,
    useReactTable,
} from '@tanstack/react-table';
import { ChevronDown, Search } from 'lucide-react';
import * as React from 'react';
import { columns, type CostCommission } from './columns';

type Pagination = {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
};

type Filters = {
    search?: string;
    type?: string;
    active?: string;
};

type DataTableProps = {
    data: CostCommission[];
    pagination: Pagination;
    filters: Filters;
    onEdit: (item: CostCommission) => void;
    onDelete: (item: CostCommission) => void;
    onToggle: (item: CostCommission) => void;
};

export function DataTable({
    data,
    pagination,
    filters,
    onEdit,
    onDelete,
    onToggle,
}: DataTableProps) {
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [columnFilters, setColumnFilters] =
        React.useState<ColumnFiltersState>([]);
    const [columnVisibility, setColumnVisibility] =
        React.useState<VisibilityState>({});
    const [rowSelection, setRowSelection] = React.useState({});

    const [localSearch, setLocalSearch] = React.useState(filters.search || '');
    const [localType, setLocalType] = React.useState(filters.type || 'all');
    const [localActive, setLocalActive] = React.useState(
        filters.active || 'all',
    );

    const table = useReactTable({
        data,
        columns: columns(onEdit, onDelete, onToggle),
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        onColumnVisibilityChange: setColumnVisibility,
        onRowSelectionChange: setRowSelection,
        state: {
            sorting,
            columnFilters,
            columnVisibility,
            rowSelection,
        },
        manualPagination: true,
        pageCount: pagination.last_page,
    });

    const handleSearch = () => {
        const params: Record<string, string> = {};

        if (localSearch) params.search = localSearch;
        if (localType !== 'all') params.type = localType;
        if (localActive !== 'all') params.active = localActive;

        router.get('/cost-commissions', params, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const handleClearFilters = () => {
        setLocalSearch('');
        setLocalType('all');
        setLocalActive('all');
        router.get(
            '/cost-commissions',
            {},
            {
                preserveState: true,
                preserveScroll: true,
            },
        );
    };

    const handlePageChange = (page: number) => {
        const params: Record<string, string> = { page: page.toString() };

        if (filters.search) params.search = filters.search;
        if (filters.type) params.type = filters.type;
        if (filters.active) params.active = filters.active;

        router.get('/cost-commissions', params, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    return (
        <div className="flex w-full flex-col gap-4 px-4 lg:px-6">
            {/* Filtros */}
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div className="flex flex-1 flex-col gap-4 md:flex-row md:items-end">
                    {/* Busca */}
                    <div className="flex-1">
                        <Input
                            placeholder="Buscar por nome..."
                            value={localSearch}
                            onChange={(e) => setLocalSearch(e.target.value)}
                            onKeyDown={(e) =>
                                e.key === 'Enter' && handleSearch()
                            }
                            className="max-w-sm"
                        />
                    </div>

                    {/* Filtro Tipo */}
                    <Select value={localType} onValueChange={setLocalType}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Tipo" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos os tipos</SelectItem>
                            <SelectItem value="percentage">
                                Percentual %
                            </SelectItem>
                            <SelectItem value="fixed">Fixo R$</SelectItem>
                        </SelectContent>
                    </Select>

                    {/* Filtro Status */}
                    <Select value={localActive} onValueChange={setLocalActive}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos os status</SelectItem>
                            <SelectItem value="1">Ativo</SelectItem>
                            <SelectItem value="0">Inativo</SelectItem>
                        </SelectContent>
                    </Select>

                    {/* Botões de Ação */}
                    <div className="flex gap-2">
                        <Button onClick={handleSearch} variant="default">
                            <Search className="mr-2 h-4 w-4" />
                            Filtrar
                        </Button>
                        <Button onClick={handleClearFilters} variant="outline">
                            Limpar
                        </Button>
                    </div>
                </div>

                {/* Dropdown de Colunas */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="ml-auto">
                            Colunas <ChevronDown className="ml-2 h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {table
                            .getAllColumns()
                            .filter((column) => column.getCanHide())
                            .map((column) => {
                                return (
                                    <DropdownMenuCheckboxItem
                                        key={column.id}
                                        className="capitalize"
                                        checked={column.getIsVisible()}
                                        onCheckedChange={(value) =>
                                            column.toggleVisibility(!!value)
                                        }
                                    >
                                        {column.id}
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
            <div className="flex items-center justify-between px-2">
                <div className="flex-1 text-sm text-muted-foreground">
                    {table.getFilteredSelectedRowModel().rows.length} de{' '}
                    {pagination.total} linha(s) selecionada(s).
                </div>
                <div className="flex items-center space-x-6 lg:space-x-8">
                    <div className="flex items-center space-x-2">
                        <p className="text-sm font-medium">Página</p>
                        <span className="text-sm font-medium">
                            {pagination.current_page} de {pagination.last_page}
                        </span>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Button
                            variant="outline"
                            className="hidden h-8 w-8 p-0 lg:flex"
                            onClick={() => handlePageChange(1)}
                            disabled={pagination.current_page === 1}
                        >
                            <span className="sr-only">
                                Ir para primeira página
                            </span>
                            <IconChevronsLeft className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            className="h-8 w-8 p-0"
                            onClick={() =>
                                handlePageChange(pagination.current_page - 1)
                            }
                            disabled={pagination.current_page === 1}
                        >
                            <span className="sr-only">
                                Ir para página anterior
                            </span>
                            <IconChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            className="h-8 w-8 p-0"
                            onClick={() =>
                                handlePageChange(pagination.current_page + 1)
                            }
                            disabled={
                                pagination.current_page === pagination.last_page
                            }
                        >
                            <span className="sr-only">
                                Ir para próxima página
                            </span>
                            <IconChevronRight className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            className="hidden h-8 w-8 p-0 lg:flex"
                            onClick={() =>
                                handlePageChange(pagination.last_page)
                            }
                            disabled={
                                pagination.current_page === pagination.last_page
                            }
                        >
                            <span className="sr-only">
                                Ir para última página
                            </span>
                            <IconChevronsRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
