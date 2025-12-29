'use client';

import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
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
import { ChevronDown } from 'lucide-react';
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
    category?: string;
    provider?: string;
    active?: string;
};

type DataTableProps = {
    data: CostCommission[];
    pagination: Pagination;
    filters: Filters;
    integratedProviders: string[];
    onEdit: (item: CostCommission) => void;
    onDelete: (item: CostCommission) => void;
    onToggle: (item: CostCommission) => void;
};

export function DataTable({
    data,
    pagination,
    filters,
    integratedProviders,
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

    const [searchValue, setSearchValue] = React.useState(filters?.search ?? '');

    // Opções de providers para o Combobox - apenas os integrados
    const providerOptions = [
        { value: '', label: 'Todos os marketplaces' },
        ...[
            { value: 'ifood', label: 'iFood' },
            { value: 'rappi', label: 'Rappi' },
            { value: 'uber_eats', label: 'Uber Eats' },
        ].filter((p) => integratedProviders.includes(p.value)),
    ];

    // Debounce para o search
    React.useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (searchValue !== filters?.search) {
                updateFilters({ search: searchValue });
            }
        }, 500);

        return () => clearTimeout(timeoutId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchValue]);

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

    const updateFilters = (newFilters: Partial<Filters>) => {
        router.get(
            '/cost-commissions',
            { ...filters, ...newFilters, page: 1 },
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
        if (filters.category) params.category = filters.category;
        if (filters.provider) params.provider = filters.provider;
        if (filters.active) params.active = filters.active;

        router.get('/cost-commissions', params, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const columnLabels: Record<string, string> = {
        name: 'Nome',
        category: 'Categoria',
        type: 'Tipo',
        value: 'Valor',
        provider: 'Marketplace',
        applies_to: 'Aplica-se a',
        active: 'Status',
    };

    return (
        <div className="flex w-full flex-col gap-4 px-4 lg:px-6">
            {/* 🔎 Filtros */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                    {/* Buscar por nome */}
                    <Input
                        placeholder="Buscar por nome..."
                        value={searchValue}
                        onChange={(e) => setSearchValue(e.target.value)}
                        className="h-9 w-[200px]"
                    />

                    {/* Filtro por Marketplace/Provider com Combobox */}
                    <Combobox
                        options={providerOptions}
                        value={filters?.provider ?? ''}
                        onChange={(value) => updateFilters({ provider: value })}
                        placeholder="Marketplace..."
                        searchPlaceholder="Buscar marketplace..."
                        emptyMessage="Nenhum marketplace integrado"
                        className="w-[200px]"
                    />

                    {/* Filtro por categoria */}
                    <Select
                        value={
                            filters?.category && filters.category !== ''
                                ? filters.category
                                : 'all'
                        }
                        onValueChange={(value) =>
                            updateFilters({
                                category: value === 'all' ? '' : value,
                            })
                        }
                    >
                        <SelectTrigger className="h-9 w-[180px]">
                            <SelectValue placeholder="Categoria" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">
                                Todas as categorias
                            </SelectItem>
                            <SelectItem value="cost">Custo</SelectItem>
                            <SelectItem value="commission">Comissão</SelectItem>
                            <SelectItem value="tax">Imposto</SelectItem>
                            <SelectItem value="payment_method">
                                Taxa de Pagamento
                            </SelectItem>
                        </SelectContent>
                    </Select>

                    {/* Filtro por tipo */}
                    <Select
                        value={
                            filters?.type && filters.type !== ''
                                ? filters.type
                                : 'all'
                        }
                        onValueChange={(value) =>
                            updateFilters({
                                type: value === 'all' ? '' : value,
                            })
                        }
                    >
                        <SelectTrigger className="h-9 w-[150px]">
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

                    {/* Filtro por status */}
                    <Select
                        value={
                            filters?.active && filters.active !== ''
                                ? filters.active
                                : 'all'
                        }
                        onValueChange={(value) =>
                            updateFilters({
                                active: value === 'all' ? '' : value,
                            })
                        }
                    >
                        <SelectTrigger className="h-9 w-[150px]">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos os status</SelectItem>
                            <SelectItem value="1">Ativos</SelectItem>
                            <SelectItem value="0">Inativos</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Dropdown de colunas */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="h-9">
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
