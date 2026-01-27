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
    DropdownMenuItem,
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
    Download,
    LayoutGrid,
    Plus,
    RefreshCw,
    Upload,
} from 'lucide-react';
import { createColumns, type Plan } from './table-columns';

type PlansPagination = {
    currentPage: number;
    lastPage: number;
    perPage: number;
    from: number;
    to: number;
    total: number;
};

type PlansFilters = {
    search: string;
    active: string;
};

interface DataTableProps {
    data: Plan[];
    pagination: PlansPagination;
    filters: PlansFilters;
    onCreatePlan: () => void;
    onEditPlan: (plan: Plan) => void;
}

export function DataTable({
    data,
    pagination,
    filters,
    onCreatePlan,
    onEditPlan,
}: DataTableProps) {
    const [sorting, setSorting] = React.useState<SortingState>([
        { id: 'price', desc: false },
    ]);
    const [columnFilters, setColumnFilters] =
        React.useState<ColumnFiltersState>([]);
    const [columnVisibility, setColumnVisibility] =
        React.useState<VisibilityState>({});
    const [rowSelection, setRowSelection] = React.useState({});
    const [isSyncing, setIsSyncing] = React.useState(false);

    // Estado local para busca com debounce
    const [searchValue, setSearchValue] = React.useState(filters?.search || '');

    const handleSyncFromStripe = () => {
        setIsSyncing(true);
        router.post(
            '/admin/plans/sync-from-stripe',
            {},
            {
                preserveScroll: true,
                onFinish: () => setIsSyncing(false),
            },
        );
    };

    const handleSyncToStripe = () => {
        setIsSyncing(true);
        router.post(
            '/admin/plans/sync-to-stripe',
            {},
            {
                preserveScroll: true,
                onFinish: () => setIsSyncing(false),
            },
        );
    };

    const columns = createColumns({
        onEdit: onEditPlan,
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

                router.get('/admin/plans', cleanFilters, {
                    preserveState: true,
                    preserveScroll: true,
                });
            }
        }, 500);

        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchValue, filters?.search]);

    const updateFilters = (newFilters: Partial<PlansFilters>) => {
        const cleanFilters = Object.fromEntries(
            Object.entries({ ...filters, ...newFilters }).filter(
                ([, value]) =>
                    value !== '' && value !== null && value !== undefined,
            ),
        );

        router.get('/admin/plans', cleanFilters, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const handlePageChange = (page: number) => {
        router.get(
            '/admin/plans',
            { ...filters, page },
            {
                preserveState: true,
                preserveScroll: true,
            },
        );
    };

    return (
        <div className="flex w-full flex-col gap-4">
            {/* 🔎 Filtros */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                    {/* Buscar */}
                    <Input
                        placeholder="Buscar plano..."
                        value={searchValue}
                        onChange={(e) => setSearchValue(e.target.value)}
                        className="h-9 w-[200px]"
                    />

                    {/* Filtro por status */}
                    <Select
                        value={filters?.active ?? 'all'}
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
                            <SelectItem value="all">Todos</SelectItem>
                            <SelectItem value="true">Ativos</SelectItem>
                            <SelectItem value="false">Inativos</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Ações à direita */}
                <div className="flex items-center gap-2">
                    {/* Sincronizar do Stripe */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={isSyncing}
                            >
                                <RefreshCw
                                    className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`}
                                />
                                <span className="ml-2">Sincronizar</span>
                                <ChevronDown className="ml-1 h-3 w-3" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={handleSyncFromStripe}>
                                <Download className="mr-2 h-4 w-4" />
                                Importar do Stripe
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={handleSyncToStripe}>
                                <Upload className="mr-2 h-4 w-4" />
                                Enviar para Stripe
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* className="h-9 w-[200px]"
                    />

                    {/* Filtro por status */}
                    <Select
                        value={filters?.active ?? 'all'}
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
                            <SelectItem value="all">Todos</SelectItem>
                            <SelectItem value="true">Ativos</SelectItem>
                            <SelectItem value="false">Inativos</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Ações à direita */}
                <div className="flex items-center gap-2">
                    {/* Adicionar Plano */}
                    <Button size="sm" onClick={onCreatePlan}>
                        <Plus className="h-4 w-4" />
                        <span className="ml-2">Novo Plano</span>
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
                                    Nenhum plano encontrado.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* 📄 Paginação */}
            <div className="flex items-center justify-between px-2">
                <div className="flex-1 text-sm text-muted-foreground">
                    Mostrando {pagination.from ?? 0} até {pagination.to ?? 0} de{' '}
                    {pagination.total} plano(s).
                </div>
                <div className="flex items-center space-x-6 lg:space-x-8">
                    <div className="flex items-center space-x-2">
                        <Button
                            variant="outline"
                            className="hidden h-8 w-8 p-0 lg:flex"
                            onClick={() => handlePageChange(1)}
                            disabled={pagination.currentPage === 1}
                        >
                            <span className="sr-only">Primeira página</span>
                            <ChevronsLeft className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            className="h-8 w-8 p-0"
                            onClick={() =>
                                handlePageChange(pagination.currentPage - 1)
                            }
                            disabled={pagination.currentPage === 1}
                        >
                            <span className="sr-only">Página anterior</span>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <div className="flex w-[100px] items-center justify-center text-sm font-medium">
                            Página {pagination.currentPage} de{' '}
                            {pagination.lastPage}
                        </div>
                        <Button
                            variant="outline"
                            className="h-8 w-8 p-0"
                            onClick={() =>
                                handlePageChange(pagination.currentPage + 1)
                            }
                            disabled={
                                pagination.currentPage === pagination.lastPage
                            }
                        >
                            <span className="sr-only">Próxima página</span>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            className="hidden h-8 w-8 p-0 lg:flex"
                            onClick={() =>
                                handlePageChange(pagination.lastPage)
                            }
                            disabled={
                                pagination.currentPage === pagination.lastPage
                            }
                        >
                            <span className="sr-only">Última página</span>
                            <ChevronsRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
