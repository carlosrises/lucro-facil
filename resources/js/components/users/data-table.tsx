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
    IconChevronLeft,
    IconChevronRight,
    IconChevronsLeft,
    IconChevronsRight,
    IconLayoutColumns,
} from '@tabler/icons-react';
import { Plus } from 'lucide-react';
import { createColumns, User } from './columns';

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
    role?: string;
    status?: string;
    show_deleted?: string;
};

type Role = {
    id: number;
    name: string;
};

interface DataTableProps {
    data: User[];
    pagination: Pagination;
    filters: Filters;
    roles: Role[];
    onCreateUser: () => void;
    onEditUser: (user: User) => void;
    onDeleteUser: (user: User) => void;
    onRestoreUser: (user: User) => void;
}

export function DataTable({
    data,
    pagination,
    filters,
    roles,
    onCreateUser,
    onEditUser,
    onDeleteUser,
    onRestoreUser,
}: DataTableProps) {
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [columnFilters, setColumnFilters] =
        React.useState<ColumnFiltersState>([]);
    const [columnVisibility, setColumnVisibility] =
        React.useState<VisibilityState>({});

    // Estados locais para os filtros com debounce
    const [searchValue, setSearchValue] = React.useState(filters?.search || '');

    const columns = createColumns({
        onEdit: onEditUser,
        onDelete: onDeleteUser,
        onRestore: onRestoreUser,
    });

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
        manualPagination: true,
        pageCount: pagination.last_page,
    });

    // Debounce para busca
    const handleFilterChange = React.useCallback(
        (newFilters: Partial<Filters>) => {
            const cleanFilters = Object.fromEntries(
                Object.entries({ ...filters, ...newFilters }).filter(
                    ([, value]) =>
                        value !== '' && value !== null && value !== undefined,
                ),
            );

            router.get('/users', cleanFilters, {
                preserveState: true,
                preserveScroll: true,
            });
        },
        [filters],
    );

    React.useEffect(() => {
        const timer = setTimeout(() => {
            if (searchValue !== filters?.search) {
                handleFilterChange({ search: searchValue });
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [searchValue, filters?.search, handleFilterChange]);

    const handlePageChange = (page: number) => {
        router.get(
            '/users',
            { ...filters, page },
            { preserveState: true, preserveScroll: true },
        );
    };

    const columnLabels: Record<string, string> = {
        name: 'Nome',
        primary_role: 'Função',
        created_at: 'Cadastrado em',
        status: 'Status',
        actions: 'Ações',
    };

    const roleLabels: Record<string, string> = {
        gerente: 'Gerente',
        vendedor: 'Vendedor',
        cozinha: 'Cozinha',
    };

    return (
        <div className="flex w-full flex-col gap-4 space-x-4 px-4 lg:px-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-1 flex-col gap-4 md:flex-row md:items-center">
                    <Input
                        placeholder="Buscar por nome ou email..."
                        value={searchValue}
                        onChange={(e) => setSearchValue(e.target.value)}
                        className="h-9 w-full md:max-w-sm"
                    />

                    <Select
                        value={filters?.role || 'all'}
                        onValueChange={(value) =>
                            handleFilterChange({
                                role: value === 'all' ? '' : value,
                            })
                        }
                    >
                        <SelectTrigger className="h-9 w-full md:w-[180px]">
                            <SelectValue placeholder="Todas as funções" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">
                                Todas as funções
                            </SelectItem>
                            {roles.map((role) => (
                                <SelectItem key={role.id} value={role.name}>
                                    {roleLabels[role.name] || role.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select
                        value={filters?.status || 'all'}
                        onValueChange={(value) =>
                            handleFilterChange({
                                status: value === 'all' ? '' : value,
                            })
                        }
                    >
                        <SelectTrigger className="h-9 w-full md:w-[180px]">
                            <SelectValue placeholder="Todos os status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos os status</SelectItem>
                            <SelectItem value="active">Ativos</SelectItem>
                            <SelectItem value="deleted">Excluídos</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex items-center gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-9">
                                <IconLayoutColumns className="mr-2 h-4 w-4" />
                                Colunas
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
                                            {columnLabels[column.id] ||
                                                column.id}
                                        </DropdownMenuCheckboxItem>
                                    );
                                })}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <Button onClick={onCreateUser} size="sm" className="h-9">
                        <Plus className="mr-2 h-4 w-4" />
                        Novo Usuário
                    </Button>
                </div>
            </div>

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
                                    Nenhum usuário encontrado.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="text-sm text-muted-foreground">
                    Mostrando {pagination.from} até {pagination.to} de{' '}
                    {pagination.total} usuário(s)
                </div>

                <div className="flex items-center space-x-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(1)}
                        disabled={pagination.current_page === 1}
                    >
                        <IconChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                            handlePageChange(pagination.current_page - 1)
                        }
                        disabled={pagination.current_page === 1}
                    >
                        <IconChevronLeft className="h-4 w-4" />
                    </Button>

                    <div className="flex items-center gap-1">
                        <div className="text-sm font-medium">
                            Página {pagination.current_page} de{' '}
                            {pagination.last_page}
                        </div>
                    </div>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                            handlePageChange(pagination.current_page + 1)
                        }
                        disabled={
                            pagination.current_page === pagination.last_page
                        }
                    >
                        <IconChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(pagination.last_page)}
                        disabled={
                            pagination.current_page === pagination.last_page
                        }
                    >
                        <IconChevronsRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
