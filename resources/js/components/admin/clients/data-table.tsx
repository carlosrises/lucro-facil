import {
    ColumnFiltersState,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
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
    LayoutGrid,
    Plus,
} from 'lucide-react';
import { createColumns, type Client } from './columns';

type ClientsPagination = {
    current_page: number;
    last_page: number;
    per_page: number;
    from: number;
    to: number;
    total: number;
    next_page_url?: string | null;
    prev_page_url?: string | null;
};

type ClientsFilters = {
    search: string;
    status: string;
    plan_id: string;
    sort_by: string;
    sort_direction: string;
    page?: number;
};

interface Plan {
    id: number;
    name: string;
}

interface DataTableProps {
    data: Client[];
    pagination: ClientsPagination;
    filters: ClientsFilters;
    plans: Plan[];
    onCreateClient: () => void;
    onEditClient: (client: Client) => void;
    onViewDetails: (client: Client) => void;
    onDeleteClient: (client: Client) => void;
}

export function DataTable({
    data,
    pagination,
    filters,
    plans,
    onCreateClient,
    onEditClient,
    onViewDetails,
    onDeleteClient,
}: DataTableProps) {
    const [sorting, setSorting] = React.useState<SortingState>([
        { id: 'created_at', desc: true },
    ]);
    const [columnFilters, setColumnFilters] =
        React.useState<ColumnFiltersState>([]);
    const [columnVisibility, setColumnVisibility] =
        React.useState<VisibilityState>({});
    const [rowSelection, setRowSelection] = React.useState({});

    // Estado local para busca com debounce
    const [searchValue, setSearchValue] = React.useState(filters?.search || '');

    const columns = createColumns({
        onEdit: onEditClient,
        onDelete: onDeleteClient,
        onViewDetails,
    });

    const table = useReactTable({
        data,
        columns,
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
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
    });

    // Debounce para busca
    React.useEffect(() => {
        const timer = setTimeout(() => {
            if (searchValue !== filters?.search) {
                const cleanFilters = Object.fromEntries(
                    Object.entries({ ...filters, search: searchValue }).filter(
                        ([, value]) =>
                            value !== '' &&
                            value !== null &&
                            value !== undefined,
                    ),
                );

                router.get('/admin/clients', cleanFilters, {
                    preserveState: true,
                    preserveScroll: true,
                });
            }
        }, 500);

        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchValue, filters?.search]);

    const updateFilters = (newFilters: Partial<ClientsFilters>) => {
        const cleanFilters = Object.fromEntries(
            Object.entries({ ...filters, ...newFilters }).filter(
                ([, value]) =>
                    value !== '' && value !== null && value !== undefined,
            ),
        );

        router.get('/admin/clients', cleanFilters, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    return (
        <div className="flex w-full flex-col gap-4 space-x-4 px-4 lg:px-6">
            {/* 🔎 Filtros */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                    {/* Buscar por nome/email */}
                    <Input
                        placeholder="Buscar cliente..."
                        value={searchValue}
                        onChange={(e) => setSearchValue(e.target.value)}
                        className="h-9 w-[200px]"
                    />

                    {/* Filtro por status */}
                    <Select
                        value={filters?.status ?? 'all'}
                        onValueChange={(value) =>
                            updateFilters({
                                status: value === 'all' ? '' : value,
                            })
                        }
                    >
                        <SelectTrigger className="h-9 w-[150px]">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos</SelectItem>
                            <SelectItem value="active">Ativo</SelectItem>
                            <SelectItem value="inactive">Inativo</SelectItem>
                        </SelectContent>
                    </Select>

                    {/* Filtro por plano */}
                    <Select
                        value={filters?.plan_id ?? 'all'}
                        onValueChange={(value) =>
                            updateFilters({
                                plan_id: value === 'all' ? '' : value,
                            })
                        }
                    >
                        <SelectTrigger className="h-9 w-[180px]">
                            <SelectValue placeholder="Plano" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos os planos</SelectItem>
                            {plans.map((plan) => (
                                <SelectItem
                                    key={plan.id}
                                    value={plan.id.toString()}
                                >
                                    {plan.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Ações à direita */}
                <div className="flex items-center gap-2">
                    {/* Adicionar Cliente */}
                    <Button size="sm" onClick={onCreateClient}>
                        <Plus className="h-4 w-4" />
                        <span className="ml-2">Adicionar Cliente</span>
                    </Button>

                    {/* 👁️ Colunas visíveis */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                                <LayoutGrid className="h-4 w-4" />
                                <span className="ml-2">Colunas</span>
                                <ChevronDown className="h-4 w-4" />
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
            </div>

            {/* 📋 Tabela */}
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

            {/* 📊 Paginação */}
            <div className="flex items-center justify-between px-2">
                <div className="flex-1 text-sm text-muted-foreground">
                    {table.getFilteredSelectedRowModel().rows.length} de{' '}
                    {table.getFilteredRowModel().rows.length} linha(s)
                    selecionada(s).
                </div>
                <div className="flex items-center space-x-6 lg:space-x-8">
                    <div className="flex items-center space-x-2">
                        <p className="text-sm font-medium">Linhas por página</p>
                        <Select
                            value={`${table.getState().pagination.pageSize}`}
                            onValueChange={(value) => {
                                table.setPageSize(Number(value));
                            }}
                        >
                            <SelectTrigger className="h-8 w-[70px]">
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
                    <div className="flex w-[100px] items-center justify-center text-sm font-medium">
                        Página {pagination.current_page} de{' '}
                        {pagination.last_page}
                    </div>
                    <div className="flex items-center space-x-2">
                        <Button
                            variant="outline"
                            className="hidden h-8 w-8 p-0 lg:flex"
                            onClick={() => updateFilters({ page: 1 })}
                            disabled={pagination.current_page <= 1}
                        >
                            <span className="sr-only">
                                Ir para primeira página
                            </span>
                            <ChevronsLeft className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            className="h-8 w-8 p-0"
                            onClick={() =>
                                updateFilters({
                                    page: pagination.current_page - 1,
                                })
                            }
                            disabled={pagination.current_page <= 1}
                        >
                            <span className="sr-only">
                                Ir para página anterior
                            </span>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            className="h-8 w-8 p-0"
                            onClick={() =>
                                updateFilters({
                                    page: pagination.current_page + 1,
                                })
                            }
                            disabled={
                                pagination.current_page >= pagination.last_page
                            }
                        >
                            <span className="sr-only">
                                Ir para próxima página
                            </span>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            className="hidden h-8 w-8 p-0 lg:flex"
                            onClick={() =>
                                updateFilters({ page: pagination.last_page })
                            }
                            disabled={
                                pagination.current_page >= pagination.last_page
                            }
                        >
                            <span className="sr-only">
                                Ir para última página
                            </span>
                            <ChevronsRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
