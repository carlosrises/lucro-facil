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

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { MonthYearPicker } from '@/components/ui/month-year-picker';
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
} from 'lucide-react';
import { toast } from 'sonner';
import { createColumns, type FinanceEntry } from './entries-columns';

type EntriesPagination = {
    current_page: number;
    last_page: number;
    per_page: number;
    from: number;
    to: number;
    total: number;
};

type EntriesFilters = {
    search: string;
    category_id: string;
    type: string;
    status: string;
    month: string;
    per_page: number;
    page?: number;
};

interface FinanceCategory {
    id: number;
    name: string;
    type: 'expense' | 'income';
    parent_id: number | null;
}

interface DataTableProps {
    data: FinanceEntry[];
    pagination: EntriesPagination;
    filters: EntriesFilters;
    categories: FinanceCategory[];
    onEdit: (entry: FinanceEntry) => void;
}

export function DataTable({
    data,
    pagination,
    filters,
    categories,
    onEdit,
}: DataTableProps) {
    const [sorting, setSorting] = React.useState<SortingState>([
        { id: 'occurred_on', desc: true },
    ]);
    const [columnFilters, setColumnFilters] =
        React.useState<ColumnFiltersState>([]);
    const [columnVisibility, setColumnVisibility] =
        React.useState<VisibilityState>({});
    const [deletingEntry, setDeletingEntry] =
        React.useState<FinanceEntry | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
    const [searchValue, setSearchValue] = React.useState(filters?.search ?? '');

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

    const handleDelete = (entry: FinanceEntry) => {
        setDeletingEntry(entry);
        setIsDeleteDialogOpen(true);
    };

    const confirmDelete = () => {
        if (!deletingEntry) return;

        router.delete(`/financial/entries/${deletingEntry.id}`, {
            preserveScroll: true,
            onSuccess: () => {
                toast.success('Movimentação excluída com sucesso!');
                setIsDeleteDialogOpen(false);
                setDeletingEntry(null);
            },
            onError: () => {
                toast.error('Erro ao excluir movimentação');
            },
        });
    };

    const columns = createColumns({ onEdit, onDelete: handleDelete });

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
        state: {
            sorting,
            columnFilters,
            columnVisibility,
        },
        manualPagination: true,
        pageCount: pagination.last_page,
    });

    const updateFilters = (newFilters: Partial<EntriesFilters>) => {
        router.get(
            '/financial/entries',
            {
                ...filters,
                ...newFilters,
                page: newFilters.search !== undefined ? 1 : filters.page,
            },
            {
                preserveState: true,
                preserveScroll: true,
            },
        );
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-1 flex-col gap-4 sm:flex-row sm:items-center">
                    <Input
                        placeholder="Buscar por fornecedor, referência..."
                        value={searchValue}
                        onChange={(e) => setSearchValue(e.target.value)}
                        className="h-9 w-full sm:w-[300px]"
                    />
                    <Select
                        value={filters?.type ?? 'all'}
                        onValueChange={(value) =>
                            updateFilters({
                                type: value === 'all' ? '' : value,
                            })
                        }
                    >
                        <SelectTrigger className="h-9 w-full sm:w-[180px]">
                            <SelectValue placeholder="Tipo" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos os tipos</SelectItem>
                            <SelectItem value="expense">Despesas</SelectItem>
                            <SelectItem value="income">Receitas</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select
                        value={filters?.category_id ?? 'all'}
                        onValueChange={(value) =>
                            updateFilters({
                                category_id: value === 'all' ? '' : value,
                            })
                        }
                    >
                        <SelectTrigger className="h-9 w-full sm:w-[200px]">
                            <SelectValue placeholder="Categoria" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">
                                Todas as categorias
                            </SelectItem>
                            {categories.map((category) => (
                                <SelectItem
                                    key={category.id}
                                    value={category.id.toString()}
                                >
                                    {category.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select
                        value={filters?.status ?? 'all'}
                        onValueChange={(value) =>
                            updateFilters({
                                status: value === 'all' ? '' : value,
                            })
                        }
                    >
                        <SelectTrigger className="h-9 w-full sm:w-[150px]">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos os status</SelectItem>
                            <SelectItem value="pending">Pendente</SelectItem>
                            <SelectItem value="paid">Pago</SelectItem>
                        </SelectContent>
                    </Select>
                    <MonthYearPicker
                        value={filters?.month ?? ''}
                        onChange={(value) => updateFilters({ month: value })}
                        placeholder="Filtrar por mês"
                        className="w-full sm:w-[200px]"
                    />
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="ml-auto h-9">
                            Colunas <ChevronDown className="ml-2 h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {table
                            .getAllColumns()
                            .filter((column) => column.getCanHide())
                            .map((column) => {
                                // Usar meta.label se disponível, senão column.id
                                const label =
                                    (
                                        column.columnDef.meta as {
                                            label?: string;
                                        }
                                    )?.label || column.id;

                                return (
                                    <DropdownMenuCheckboxItem
                                        key={column.id}
                                        className="capitalize"
                                        checked={column.getIsVisible()}
                                        onCheckedChange={(value) =>
                                            column.toggleVisibility(!!value)
                                        }
                                    >
                                        {label}
                                    </DropdownMenuCheckboxItem>
                                );
                            })}
                    </DropdownMenuContent>
                </DropdownMenu>
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
                                    Nenhuma movimentação encontrada.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
                <div className="flex-1 text-sm text-muted-foreground">
                    Mostrando {pagination.from} a {pagination.to} de{' '}
                    {pagination.total} movimentações
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">Linhas por página</p>
                        <Select
                            value={String(filters?.per_page ?? 10)}
                            onValueChange={(value) => {
                                updateFilters({ per_page: Number(value) });
                            }}
                        >
                            <SelectTrigger className="h-8 w-[70px]">
                                <SelectValue
                                    placeholder={String(
                                        filters?.per_page ?? 10,
                                    )}
                                />
                            </SelectTrigger>
                            <SelectContent side="top">
                                {[10, 20, 30, 40, 50].map((pageSize) => (
                                    <SelectItem
                                        key={pageSize}
                                        value={String(pageSize)}
                                    >
                                        {pageSize}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex items-center gap-1">
                        <Button
                            variant="outline"
                            className="h-8 w-8 p-0"
                            onClick={() => updateFilters({ page: 1 })}
                            disabled={pagination.current_page === 1}
                        >
                            <span className="sr-only">Primeira página</span>
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
                            disabled={pagination.current_page === 1}
                        >
                            <span className="sr-only">Página anterior</span>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <div className="flex items-center justify-center text-sm font-medium">
                            Página {pagination.current_page} de{' '}
                            {pagination.last_page}
                        </div>
                        <Button
                            variant="outline"
                            className="h-8 w-8 p-0"
                            onClick={() =>
                                updateFilters({
                                    page: pagination.current_page + 1,
                                })
                            }
                            disabled={
                                pagination.current_page === pagination.last_page
                            }
                        >
                            <span className="sr-only">Próxima página</span>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            className="h-8 w-8 p-0"
                            onClick={() =>
                                updateFilters({
                                    page: pagination.last_page,
                                })
                            }
                            disabled={
                                pagination.current_page === pagination.last_page
                            }
                        >
                            <span className="sr-only">Última página</span>
                            <ChevronsRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>

            <AlertDialog
                open={isDeleteDialogOpen}
                onOpenChange={setIsDeleteDialogOpen}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja excluir a movimentação{' '}
                            <strong>
                                {deletingEntry?.reference || 'sem referência'}
                            </strong>
                            ? Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDelete}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Excluir
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
