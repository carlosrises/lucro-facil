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
import { createColumns, type Product } from './columns';
import { ProductFormDialog } from './product-form-dialog';

type ProductsPagination = {
    current_page: number;
    last_page: number;
    per_page: number;
    from: number;
    to: number;
    total: number;
    next_page_url?: string | null;
    prev_page_url?: string | null;
};

type ProductsFilters = {
    search: string;
    type: string;
    active: string;
    per_page: number;
    page?: number;
};

type MarginSettings = {
    margin_excellent: number;
    margin_good_min: number;
    margin_good_max: number;
    margin_poor: number;
};

interface DataTableProps {
    data: Product[];
    pagination: ProductsPagination;
    filters: ProductsFilters;
    marginSettings: MarginSettings;
}

export function DataTable({
    data,
    pagination,
    filters,
    marginSettings,
}: DataTableProps) {
    const [sorting, setSorting] = React.useState<SortingState>([
        { id: 'name', desc: false },
    ]);
    const [columnFilters, setColumnFilters] =
        React.useState<ColumnFiltersState>([]);
    const [columnVisibility, setColumnVisibility] =
        React.useState<VisibilityState>({});
    const [rowSelection, setRowSelection] = React.useState({});
    const [isFormOpen, setIsFormOpen] = React.useState(false);
    const [editingProduct, setEditingProduct] = React.useState<Product | null>(
        null,
    );
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

    const handleEdit = (product: Product) => {
        setEditingProduct(product);
        setIsFormOpen(true);
    };

    const handleDelete = (product: Product) => {
        if (
            confirm(
                `Tem certeza que deseja excluir o produto "${product.name}"?`,
            )
        ) {
            router.delete(`/products/${product.id}`, {
                preserveScroll: true,
            });
        }
    };

    const columns = React.useMemo(
        () =>
            createColumns({
                onEdit: handleEdit,
                onDelete: handleDelete,
                marginSettings,
            }),
        [marginSettings],
    );

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

    const updateFilters = (newFilters: Partial<ProductsFilters>) => {
        const updatedFilters = { ...filters, ...newFilters };

        // Remove valores vazios/null/undefined
        const cleanFilters = Object.fromEntries(
            Object.entries(updatedFilters).filter(
                ([, value]) =>
                    value !== '' && value !== null && value !== undefined,
            ),
        );

        router.get('/products', cleanFilters, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const columnLabels: Record<string, string> = {
        status_indicator: '',
        name: 'Nome',
        type: 'Tipo',
        unit: 'Unidade',
        unit_cost: 'Custo (CMV)',
        sale_price: 'Preço de Venda',
        margin: 'Margem',
        costs_count: 'Insumos',
        actions: 'Ações',
    };

    return (
        <>
            <div className="flex w-full flex-col gap-4 space-x-4 px-4 lg:px-6">
                {/* 🔎 Filtros */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                        {/* Buscar por nome/SKU */}
                        <Input
                            placeholder="Buscar produto..."
                            value={searchValue}
                            onChange={(e) => setSearchValue(e.target.value)}
                            className="h-9 w-[200px]"
                        />

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
                                <SelectItem value="all">Todos</SelectItem>
                                <SelectItem value="product">Produto</SelectItem>
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
                                <SelectItem value="all">Todos</SelectItem>
                                <SelectItem value="1">Ativos</SelectItem>
                                <SelectItem value="0">Inativos</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Ações à direita */}
                    <div className="flex items-center gap-2">
                        {/* Adicionar Produto */}
                        <Button
                            size="sm"
                            onClick={() => {
                                setEditingProduct(null);
                                setIsFormOpen(true);
                            }}
                        >
                            <Plus className="h-4 w-4" />
                            <span className="ml-2">Adicionar Produto</span>
                        </Button>

                        {/* Dropdown de colunas visíveis */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm">
                                    <LayoutGrid className="h-4 w-4" />
                                    <span className="ml-2">Colunas</span>
                                    <ChevronDown className="ml-2 h-4 w-4" />
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
                                                    column.toggleVisibility(
                                                        !!value,
                                                    )
                                                }
                                            >
                                                {columnLabels[column.id] ||
                                                    column.id}
                                            </DropdownMenuCheckboxItem>
                                        );
                                    })}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                {/* 📊 Tabela */}
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
                                                          header.column
                                                              .columnDef.header,
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
                                        Nenhum produto encontrado.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* 📄 Paginação */}
                <div className="flex items-center justify-between px-2">
                    <div className="flex-1 text-sm text-muted-foreground">
                        Mostrando {pagination.from} a {pagination.to} de{' '}
                        {pagination.total} produto(s)
                    </div>
                    <div className="flex items-center space-x-6 lg:space-x-8">
                        <div className="flex items-center space-x-2">
                            <p className="text-sm font-medium">
                                Linhas por página
                            </p>
                            <Select
                                value={filters.per_page.toString()}
                                onValueChange={(value) =>
                                    updateFilters({
                                        per_page: parseInt(value),
                                    })
                                }
                            >
                                <SelectTrigger className="h-8 w-[70px]">
                                    <SelectValue
                                        placeholder={filters.per_page}
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
                                onClick={() =>
                                    updateFilters({
                                        page: 1,
                                    })
                                }
                                disabled={pagination.current_page === 1}
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
                                disabled={pagination.current_page === 1}
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
                                    pagination.current_page ===
                                    pagination.last_page
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
                                    updateFilters({
                                        page: pagination.last_page,
                                    })
                                }
                                disabled={
                                    pagination.current_page ===
                                    pagination.last_page
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

            {/* Dialog de Formulário */}
            <ProductFormDialog
                open={isFormOpen}
                onOpenChange={setIsFormOpen}
                product={editingProduct}
            />
        </>
    );
}
