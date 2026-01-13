import { Button } from '@/components/ui/button';
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
import { Link, router } from '@inertiajs/react';
import {
    IconArrowDown,
    IconArrowsSort,
    IconArrowUp,
    IconChevronLeft,
    IconChevronRight,
} from '@tabler/icons-react';
import {
    flexRender,
    getCoreRowModel,
    getSortedRowModel,
    SortingState,
    useReactTable,
} from '@tanstack/react-table';
import * as React from 'react';
import { columns, Store } from './columns';

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
    per_page?: number;
};

export function DataTable({
    data,
    pagination,
    filters,
}: {
    data: Store[];
    pagination: Pagination;
    filters: Filters;
}) {
    const [sorting, setSorting] = React.useState<SortingState>([
        { id: 'name', desc: false },
    ]);

    // Estado local para search com debounce
    const [searchValue, setSearchValue] = React.useState(filters?.search ?? '');

    // Sincronizar searchValue quando filters.search mudar externamente
    React.useEffect(() => {
        setSearchValue(filters?.search ?? '');
    }, [filters?.search]);

    // Debounce para search (500ms)
    React.useEffect(() => {
        const timer = setTimeout(() => {
            const normalizedSearch = searchValue || undefined;
            const currentSearch = filters?.search || undefined;

            if (normalizedSearch !== currentSearch) {
                updateFilters({ search: normalizedSearch });
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [searchValue]);

    const table = useReactTable({
        data,
        columns,
        state: { sorting },
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
    });

    const updateFilters = (newFilters: Partial<Filters>) => {
        const merged = { ...filters, ...newFilters };
        router.get('/stores', merged, {
            preserveScroll: true,
            preserveState: true,
            replace: true,
        });
    };

    return (
        <>
            {/* 🔍 Filtros */}
            <div className="flex flex-wrap items-center gap-2">
                <Input
                    placeholder="Buscar loja..."
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    className="h-9 w-[200px]"
                />

                <Select
                    value={filters?.status ?? 'all'}
                    onValueChange={(value) =>
                        updateFilters({
                            status: value === 'all' ? undefined : value,
                        })
                    }
                >
                    <SelectTrigger className="h-9 w-[160px]">
                        <SelectValue placeholder="Filtrar status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos os status</SelectItem>
                        <SelectItem value="active">Ativas</SelectItem>
                        <SelectItem value="inactive">Inativas</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* 📋 Tabela */}
            <div className="overflow-hidden rounded-lg border">
                <Table>
                    <TableHeader className="sticky top-0 z-10 bg-muted">
                        {table.getHeaderGroups().map((hg) => (
                            <TableRow key={hg.id}>
                                {hg.headers.map((header) => {
                                    const sorted = header.column.getIsSorted();
                                    const isSortable =
                                        header.column.getCanSort?.();

                                    return (
                                        <TableHead
                                            key={header.id}
                                            className={`${
                                                isSortable
                                                    ? 'cursor-pointer select-none hover:bg-muted/60'
                                                    : ''
                                            }`}
                                            onClick={
                                                isSortable
                                                    ? header.column.getToggleSortingHandler()
                                                    : undefined
                                            }
                                        >
                                            <div className="flex items-center gap-1">
                                                {flexRender(
                                                    header.column.columnDef
                                                        .header,
                                                    header.getContext(),
                                                )}
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
                                <TableRow key={row.id}>
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
                                    Nenhuma loja encontrada.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* 📌 Paginação */}
            <div className="flex items-center justify-between px-4">
                <div className="text-sm text-muted-foreground">
                    Exibindo {pagination.from} – {pagination.to} de{' '}
                    {pagination.total} lojas
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="icon"
                        disabled={!pagination.prev_page_url}
                        asChild
                    >
                        <Link
                            href={pagination.prev_page_url || '#'}
                            preserveScroll
                            preserveState
                        >
                            <IconChevronLeft />
                        </Link>
                    </Button>

                    <Button
                        variant="outline"
                        size="icon"
                        disabled={!pagination.next_page_url}
                        asChild
                    >
                        <Link
                            href={pagination.next_page_url || '#'}
                            preserveScroll
                            preserveState
                        >
                            <IconChevronRight />
                        </Link>
                    </Button>
                </div>
            </div>
        </>
    );
}
