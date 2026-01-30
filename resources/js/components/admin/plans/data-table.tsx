import {
    closestCenter,
    DndContext,
    KeyboardSensor,
    MouseSensor,
    TouchSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
    type UniqueIdentifier,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
    arrayMove,
    SortableContext,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    ColumnFiltersState,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
    VisibilityState,
    type Row,
    type SortingState,
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
    Download,
    GripVertical,
    LayoutGrid,
    Plus,
    RefreshCw,
    Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { createColumns, type Plan } from './columns';

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

// Componente para o drag handle
function DragHandle({
    attributes,
    listeners,
}: {
    attributes: any;
    listeners: any;
}) {
    return (
        <Button
            {...attributes}
            {...listeners}
            variant="ghost"
            size="icon"
            className="size-7 cursor-grab text-muted-foreground hover:bg-transparent active:cursor-grabbing"
        >
            <GripVertical className="size-4" />
            <span className="sr-only">Arrastar para reordenar</span>
        </Button>
    );
}

// Componente para linha arrastável
function DraggableRow({ row }: { row: Row<Plan> }) {
    const {
        transform,
        transition,
        setNodeRef,
        isDragging,
        attributes,
        listeners,
    } = useSortable({
        id: row.original.id,
    });

    return (
        <TableRow
            data-state={row.getIsSelected() && 'selected'}
            data-dragging={isDragging}
            ref={setNodeRef}
            className="relative z-0 data-[dragging=true]:z-10 data-[dragging=true]:opacity-80"
            style={{
                transform: CSS.Transform.toString(transform),
                transition: transition,
            }}
        >
            {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, {
                        ...cell.getContext(),
                        dragHandleAttributes: attributes,
                        dragHandleListeners: listeners,
                    })}
                </TableCell>
            ))}
        </TableRow>
    );
}

export function DataTable({
    data: initialData,
    pagination,
    filters,
    onCreatePlan,
    onEditPlan,
}: DataTableProps) {
    const [data, setData] = React.useState(() => initialData);
    const [columnFilters, setColumnFilters] =
        React.useState<ColumnFiltersState>([]);
    const [columnVisibility, setColumnVisibility] =
        React.useState<VisibilityState>({});
    const [rowSelection, setRowSelection] = React.useState({});
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [localPagination, setLocalPagination] = React.useState({
        pageIndex: 0,
        pageSize: 10,
    });
    const [isSyncing, setIsSyncing] = React.useState(false);
    const [searchValue, setSearchValue] = React.useState(filters?.search || '');

    const sortableId = React.useId();
    const sensors = useSensors(
        useSensor(MouseSensor, {}),
        useSensor(TouchSensor, {}),
        useSensor(KeyboardSensor, {}),
    );

    const dataIds = React.useMemo<UniqueIdentifier[]>(() => {
        const ids = data?.map(({ id }) => id) || [];
        console.log('DataIds:', ids);
        return ids;
    }, [data]);

    // Atualiza data quando initialData muda
    React.useEffect(() => {
        setData(initialData);
    }, [initialData]);

    const columns = React.useMemo(
        () =>
            createColumns({
                onEdit: onEditPlan,
                DragHandle: ({ attributes, listeners }: any) => (
                    <DragHandle attributes={attributes} listeners={listeners} />
                ),
            }),
        [onEditPlan],
    );

    const table = useReactTable({
        data,
        columns,
        state: {
            sorting,
            columnVisibility,
            rowSelection,
            columnFilters,
            pagination: localPagination,
        },
        getRowId: (row) => row.id.toString(),
        enableRowSelection: true,
        onRowSelectionChange: setRowSelection,
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onColumnVisibilityChange: setColumnVisibility,
        onPaginationChange: setLocalPagination,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
    });

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;
        console.log('Drag End Event:', {
            active,
            over,
            activeId: active?.id,
            overId: over?.id,
        });
        if (active && over && active.id !== over.id) {
            setData((data) => {
                const oldIndex = dataIds.indexOf(active.id);
                const newIndex = dataIds.indexOf(over.id);
                console.log('Moving from', oldIndex, 'to', newIndex);
                const newData = arrayMove(data, oldIndex, newIndex);

                // Atualizar display_order no backend
                const orderedPlans = newData.map((plan, index) => ({
                    id: plan.id,
                    display_order: index,
                }));

                router.post(
                    '/admin/plans/update-order',
                    { plans: orderedPlans },
                    {
                        preserveScroll: true,
                        onSuccess: () => {
                            toast.success('Ordem atualizada com sucesso!');
                        },
                        onError: () => {
                            toast.error('Erro ao atualizar ordem');
                            // Reverter em caso de erro
                            setData(initialData);
                        },
                    },
                );

                return newData;
            });
        }
    }

    const handleSyncFromStripe = () => {
        setIsSyncing(true);
        router.post(
            '/admin/plans/sync-from-stripe',
            {},
            {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success('Planos importados do Stripe com sucesso!');
                    setIsSyncing(false);
                },
                onError: (errors) => {
                    toast.error(
                        errors.error
                            ? (errors.error as string)
                            : 'Erro ao importar planos',
                    );
                    setIsSyncing(false);
                },
                onFinish: () => {
                    setIsSyncing(false);
                },
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
                onSuccess: () => {
                    toast.success('Planos enviados para o Stripe com sucesso!');
                    setIsSyncing(false);
                },
                onError: (errors) => {
                    toast.error(
                        errors.error
                            ? (errors.error as string)
                            : 'Erro ao enviar planos',
                    );
                    setIsSyncing(false);
                },
                onFinish: () => {
                    setIsSyncing(false);
                },
            },
        );
    };

    // Debounce para busca
    React.useEffect(() => {
        const timer = setTimeout(() => {
            if (searchValue !== filters?.search) {
                router.get(
                    '/admin/plans',
                    { search: searchValue, active: filters?.active },
                    { preserveState: true, preserveScroll: true },
                );
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [searchValue, filters?.search, filters?.active]);

    const handleActiveFilterChange = (value: string) => {
        router.get(
            '/admin/plans',
            {
                search: filters?.search,
                ...(value !== 'all' && { active: value }),
            },
            { preserveState: true, preserveScroll: true },
        );
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex flex-1 items-center gap-2">
                    <Input
                        placeholder="Buscar planos..."
                        value={searchValue}
                        onChange={(e) => setSearchValue(e.target.value)}
                        className="h-9 w-[250px]"
                    />
                    <Select
                        value={filters?.active || 'all'}
                        onValueChange={handleActiveFilterChange}
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

                <div className="flex items-center gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                                <LayoutGrid className="mr-2 h-4 w-4" />
                                Colunas
                                <ChevronDown className="ml-2 h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            {table
                                .getAllColumns()
                                .filter(
                                    (column) =>
                                        typeof column.accessorFn !==
                                            'undefined' && column.getCanHide(),
                                )
                                .map((column) => {
                                    const columnLabels: Record<string, string> =
                                        {
                                            code: 'Código',
                                            name: 'Nome',
                                            description: 'Descrição',
                                            price: 'Preço',
                                            features: 'Recursos',
                                            active: 'Status',
                                            is_visible: 'Visível',
                                            is_contact_plan: 'Sob Consulta',
                                            is_featured: 'Destaque',
                                            subscriptions_count: 'Assinaturas',
                                            actions: 'Ações',
                                        };

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

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={isSyncing}
                            >
                                {isSyncing ? (
                                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                )}
                                Sincronizar
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuCheckboxItem
                                onSelect={handleSyncFromStripe}
                            >
                                <Download className="mr-2 h-4 w-4" />
                                Importar do Stripe
                            </DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem
                                onSelect={handleSyncToStripe}
                            >
                                <Upload className="mr-2 h-4 w-4" />
                                Enviar para Stripe
                            </DropdownMenuCheckboxItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <Button onClick={onCreatePlan} size="sm">
                        <Plus className="mr-2 h-4 w-4" />
                        Novo Plano
                    </Button>
                </div>
            </div>

            <div className="rounded-md border">
                <DndContext
                    collisionDetection={closestCenter}
                    modifiers={[restrictToVerticalAxis]}
                    onDragEnd={handleDragEnd}
                    sensors={sensors}
                    id={sortableId}
                >
                    <Table>
                        <TableHeader>
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id}>
                                    {headerGroup.headers.map((header) => {
                                        return (
                                            <TableHead
                                                key={header.id}
                                                colSpan={header.colSpan}
                                            >
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
                                <SortableContext
                                    items={dataIds}
                                    strategy={verticalListSortingStrategy}
                                >
                                    {table.getRowModel().rows.map((row) => (
                                        <DraggableRow key={row.id} row={row} />
                                    ))}
                                </SortableContext>
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
                </DndContext>
            </div>

            <div className="flex items-center justify-between px-2">
                <div className="flex-1 text-sm text-muted-foreground">
                    {table.getFilteredSelectedRowModel().rows.length} de{' '}
                    {table.getFilteredRowModel().rows.length} linha(s)
                    selecionada(s).
                </div>
                <div className="flex items-center space-x-6 lg:space-x-8">
                    <div className="flex items-center space-x-2">
                        <p className="text-sm font-medium">Página</p>
                        <p className="text-sm font-medium">
                            {pagination.currentPage} de {pagination.lastPage}
                        </p>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Button
                            variant="outline"
                            className="hidden h-8 w-8 p-0 lg:flex"
                            onClick={() =>
                                router.get(
                                    '/admin/plans?page=1',
                                    {},
                                    { preserveState: true },
                                )
                            }
                            disabled={pagination.currentPage === 1}
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
                                router.get(
                                    `/admin/plans?page=${pagination.currentPage - 1}`,
                                    {},
                                    { preserveState: true },
                                )
                            }
                            disabled={pagination.currentPage === 1}
                        >
                            <span className="sr-only">Página anterior</span>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            className="h-8 w-8 p-0"
                            onClick={() =>
                                router.get(
                                    `/admin/plans?page=${pagination.currentPage + 1}`,
                                    {},
                                    { preserveState: true },
                                )
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
                                router.get(
                                    `/admin/plans?page=${pagination.lastPage}`,
                                    {},
                                    { preserveState: true },
                                )
                            }
                            disabled={
                                pagination.currentPage === pagination.lastPage
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
