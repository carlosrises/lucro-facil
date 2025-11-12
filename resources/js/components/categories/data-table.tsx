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
import { ChevronDown, LayoutGrid, Plus } from 'lucide-react';
import { CategoryManageDialog } from './category-manage-dialog';
import { createColumns, type Category } from './columns';

interface DataTableProps {
    data: Category[];
    filters: {
        search?: string;
        type?: string;
        active?: string;
    };
}

export function DataTable({ data, filters }: DataTableProps) {
    const [sorting, setSorting] = React.useState<SortingState>([
        { id: 'name', desc: false },
    ]);
    const [columnFilters, setColumnFilters] =
        React.useState<ColumnFiltersState>([]);
    const [columnVisibility, setColumnVisibility] =
        React.useState<VisibilityState>({});
    const [rowSelection, setRowSelection] = React.useState({});
    const [isFormOpen, setIsFormOpen] = React.useState(false);
    const [editingCategory, setEditingCategory] =
        React.useState<Category | null>(null);

    const handleEdit = (category: Category) => {
        setEditingCategory(category);
        setIsFormOpen(true);
    };

    const handleDelete = (category: Category) => {
        if (
            confirm(
                `Tem certeza que deseja excluir a categoria "${category.name}"?`,
            )
        ) {
            router.delete(`/api/categories/${category.id}`, {
                preserveScroll: true,
            });
        }
    };

    const columns = React.useMemo(
        () =>
            createColumns({
                onEdit: handleEdit,
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

    const updateFilters = (newFilters: Partial<typeof filters>) => {
        router.get(
            '/categories',
            {
                ...filters,
                ...newFilters,
            },
            {
                preserveState: true,
                preserveScroll: true,
            },
        );
    };

    return (
        <>
            <div className="flex w-full flex-col gap-4 space-x-4 px-4 lg:px-6">
                {/* Filtros */}
                <div className="flex flex-wrap items-center gap-2">
                    <Input
                        placeholder="Buscar categorias..."
                        value={filters.search || ''}
                        onChange={(e) =>
                            updateFilters({ search: e.target.value })
                        }
                        className="h-9 max-w-sm"
                    />

                    <Select
                        value={filters.type || 'all'}
                        onValueChange={(value) =>
                            updateFilters({
                                type: value === 'all' ? undefined : value,
                            })
                        }
                    >
                        <SelectTrigger className="h-9 w-[140px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos tipos</SelectItem>
                            <SelectItem value="ingredient">Insumos</SelectItem>
                            <SelectItem value="product">Produtos</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select
                        value={filters.active || 'all'}
                        onValueChange={(value) =>
                            updateFilters({
                                active: value === 'all' ? undefined : value,
                            })
                        }
                    >
                        <SelectTrigger className="h-9 w-[140px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos status</SelectItem>
                            <SelectItem value="1">Ativos</SelectItem>
                            <SelectItem value="0">Inativos</SelectItem>
                        </SelectContent>
                    </Select>

                    <div className="ml-auto flex gap-2">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="h-9">
                                    <LayoutGrid className="mr-2 h-4 w-4" />
                                    Colunas
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
                                                {column.id}
                                            </DropdownMenuCheckboxItem>
                                        );
                                    })}
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <Button
                            onClick={() => {
                                setEditingCategory(null);
                                setIsFormOpen(true);
                            }}
                            className="h-9"
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            Nova Categoria
                        </Button>
                    </div>
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
                                        Nenhuma categoria encontrada.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* Dialog de Formulário */}
            <CategoryManageDialog
                open={isFormOpen}
                onOpenChange={setIsFormOpen}
                category={editingCategory}
            />
        </>
    );
}
