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
import { toast } from 'sonner';
import { createColumns, type Ingredient } from './columns';
import { IngredientFormDialog } from './ingredient-form-dialog';

type IngredientsPagination = {
    current_page: number;
    last_page: number;
    per_page: number;
    from: number;
    to: number;
    total: number;
    next_page_url?: string | null;
    prev_page_url?: string | null;
};

type IngredientsFilters = {
    search: string;
    category_id: string;
    active: string;
    per_page: number;
    page?: number;
};

interface Category {
    id: number;
    name: string;
}

interface DataTableProps {
    data: Ingredient[];
    pagination: IngredientsPagination;
    filters: IngredientsFilters;
    categories: Category[];
}

export function DataTable({
    data,
    pagination,
    filters,
    categories,
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
    const [editingIngredient, setEditingIngredient] =
        React.useState<Ingredient | null>(null);
    const [deletingIngredient, setDeletingIngredient] =
        React.useState<Ingredient | null>(null);
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

    const handleEdit = (ingredient: Ingredient) => {
        setEditingIngredient(ingredient);
        setIsFormOpen(true);
    };

    const handleDuplicate = (ingredient: Ingredient) => {
        // Cria uma cópia do ingrediente para duplicar
        const duplicatedIngredient = {
            ...ingredient,
            name: `${ingredient.name} (Cópia)`,
            _isDuplicate: true,
        };
        // Remove o id para criar um novo ingrediente
        delete (duplicatedIngredient as Partial<Ingredient>).id;
        setEditingIngredient(duplicatedIngredient as unknown as Ingredient);
        setIsFormOpen(true);
    };

    const handleDelete = (ingredient: Ingredient) => {
        setDeletingIngredient(ingredient);
        setIsDeleteDialogOpen(true);
    };

    const confirmDelete = () => {
        if (deletingIngredient) {
            router.delete(`/ingredients/${deletingIngredient.id}`, {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success('Insumo excluído com sucesso!');
                    setIsDeleteDialogOpen(false);
                    setDeletingIngredient(null);
                },
                onError: () => {
                    toast.error('Erro ao excluir insumo');
                },
            });
        }
    };

    const columns = React.useMemo(
        () =>
            createColumns({
                onEdit: handleEdit,
                onDuplicate: handleDuplicate,
                onDelete: handleDelete,
            }),
        [],
    );

    const table = useReactTable({
        data,
        columns,
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        onColumnVisibilityChange: setColumnVisibility,
        onRowSelectionChange: setRowSelection,
        manualPagination: true,
        pageCount: pagination.last_page,
        state: {
            sorting,
            columnFilters,
            columnVisibility,
            rowSelection,
        },
    });

    const updateFilters = (
        newFilters: Partial<IngredientsFilters>,
        resetPage = true,
    ) => {
        const merged = {
            ...filters,
            per_page: filters?.per_page ?? pagination?.per_page ?? 10,
            ...newFilters,
            ...(resetPage ? { page: 1 } : {}),
        };

        // Remover chaves com valores undefined
        Object.keys(merged).forEach((key) => {
            if (merged[key as keyof IngredientsFilters] === undefined) {
                delete merged[key as keyof IngredientsFilters];
            }
        });

        router.get('/ingredients', merged, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const columnLabels: Record<string, string> = {
        status_indicator: '',
        name: 'Nome',
        category: 'Categoria',
        unit: 'Unidade',
        unit_price: 'Preço Unitário',
        current_stock: 'Estoque Atual',
        ideal_stock: 'Estoque Ideal',
        actions: 'Ações',
    };

    return (
        <>
            <div className="flex w-full flex-col gap-4 space-x-4 px-4 lg:px-6">
                {/* 🔎 Filtros */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                        {/* Buscar por nome */}
                        <Input
                            placeholder="Buscar insumo..."
                            value={searchValue}
                            onChange={(e) => setSearchValue(e.target.value)}
                            className="h-9 w-[200px]"
                        />

                        {/* Filtro por categoria */}
                        <Select
                            value={
                                filters?.category_id &&
                                filters.category_id !== ''
                                    ? filters.category_id
                                    : 'all'
                            }
                            onValueChange={(value) =>
                                updateFilters({
                                    category_id: value === 'all' ? '' : value,
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
                        {/* Botão Categorias */}
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => router.get('/categories')}
                        >
                            <LayoutGrid className="h-4 w-4" />
                            <span className="ml-2">Categorias</span>
                        </Button>

                        {/* Adicionar Insumo */}
                        <Button
                            size="sm"
                            onClick={() => {
                                setEditingIngredient(null);
                                setIsFormOpen(true);
                            }}
                        >
                            <Plus className="h-4 w-4" />
                            <span className="ml-2">Adicionar Insumo</span>
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
                                        Nenhum insumo encontrado.
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
                        {pagination.total} insumo(s)
                    </div>
                    <div className="flex items-center space-x-6 lg:space-x-8">
                        <div className="flex items-center space-x-2">
                            <p className="text-sm font-medium">
                                Linhas por página
                            </p>
                            <Select
                                value={`${filters?.per_page ?? pagination?.per_page ?? 10}`}
                                onValueChange={(value) =>
                                    updateFilters({
                                        per_page: Number(value),
                                    })
                                }
                            >
                                <SelectTrigger className="h-8 w-[70px]">
                                    <SelectValue />
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
                                    updateFilters(
                                        {
                                            page: 1,
                                        },
                                        false,
                                    )
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
                                    updateFilters(
                                        {
                                            page: pagination.current_page - 1,
                                        },
                                        false,
                                    )
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
                                    updateFilters(
                                        {
                                            page: pagination.current_page + 1,
                                        },
                                        false,
                                    )
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
                                    updateFilters(
                                        {
                                            page: pagination.last_page,
                                        },
                                        false,
                                    )
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
            <IngredientFormDialog
                open={isFormOpen}
                onOpenChange={setIsFormOpen}
                ingredient={editingIngredient}
                categories={categories}
            />

            {/* Dialog de Confirmação de Exclusão */}
            <AlertDialog
                open={isDeleteDialogOpen}
                onOpenChange={setIsDeleteDialogOpen}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja excluir o insumo{' '}
                            <span className="font-semibold">
                                "{deletingIngredient?.name}"
                            </span>
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
        </>
    );
}
