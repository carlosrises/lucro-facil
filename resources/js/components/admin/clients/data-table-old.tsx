import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
    flexRender,
    getCoreRowModel,
    getSortedRowModel,
    useReactTable,
} from '@tanstack/react-table';
import { ChevronLeft, ChevronRight, Filter, Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { columns, type Client } from './columns';

interface Plan {
    id: number;
    name: string;
}

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

interface ClientsDataTableProps {
    data: Client[];
    pagination: ClientsPagination;
    filters: {
        search: string;
        status: string;
        plan_id: string;
        sort_by: string;
        sort_direction: string;
    };
    plans: Plan[];
}

export function DataTable({
    data,
    pagination,
    filters,
    plans,
}: ClientsDataTableProps) {
    const [sorting, setSorting] = React.useState<SortingState>([
        { id: 'created_at', desc: true },
    ]);
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
    const [rowSelection, setRowSelection] = React.useState({});

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
            '/admin/clients',
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
        <div className="space-y-4">
            {/* Header com botão de novo cliente */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold">Clientes</h2>
                    <p className="text-muted-foreground">
                        Gerencie todos os clientes da plataforma
                    </p>
                </div>
                <Button onClick={handleNewClient}>
                    <Plus className="mr-2 h-4 w-4" />
                    Novo Cliente
                </Button>
            </div>

            {/* Filtros */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Filter className="h-5 w-5" />
                        Filtros
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col gap-4 sm:flex-row">
                        <div className="flex-1">
                            <Input
                                placeholder="Buscar por nome, email..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                onKeyPress={(e) =>
                                    e.key === 'Enter' && handleSearch()
                                }
                            />
                        </div>

                        <Select value={status} onValueChange={setStatus}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos</SelectItem>
                                <SelectItem value="active">Ativo</SelectItem>
                                <SelectItem value="inactive">
                                    Inativo
                                </SelectItem>
                            </SelectContent>
                        </Select>

                        <Select value={planId} onValueChange={setPlanId}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Plano" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">
                                    Todos os planos
                                </SelectItem>
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

                        <div className="flex gap-2">
                            <Button onClick={handleSearch}>
                                <Search className="mr-2 h-4 w-4" />
                                Buscar
                            </Button>
                            <Button variant="outline" onClick={clearFilters}>
                                Limpar
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Estatísticas */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <Card>
                    <CardContent className="p-4">
                        <div className="text-2xl font-bold">
                            {pagination?.total || data?.length || 0}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Total de clientes
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="text-2xl font-bold text-green-600">
                            {data?.filter((c: Client) => c.status === 'active')
                                .length || 0}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Clientes ativos
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="text-2xl font-bold text-gray-600">
                            {data?.filter(
                                (c: Client) => c.status === 'inactive',
                            ).length || 0}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Clientes inativos
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="text-2xl font-bold text-blue-600">
                            {data?.reduce(
                                (sum: number, c: Client) =>
                                    sum + c.stores_count,
                                0,
                            ) || 0}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Total de lojas
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Tabela */}
            <Card>
                <CardContent className="p-0">
                    <ClientsTable data={data || []} pagination={pagination} />
                </CardContent>
            </Card>
        </div>
    );
}

// Componente da tabela
function ClientsTable({
    data,
    pagination,
}: {
    data: Client[];
    pagination: ClientsPagination;
}) {
    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
    });

    const handlePreviousPage = () => {
        if ((pagination?.current_page || 0) > 1) {
            router.get(
                '/admin/clients',
                {
                    page: (pagination?.current_page || 1) - 1,
                },
                {
                    preserveState: true,
                    preserveScroll: true,
                },
            );
        }
    };

    const handleNextPage = () => {
        if ((pagination?.current_page || 0) < (pagination?.last_page || 0)) {
            router.get(
                '/admin/clients',
                {
                    page: (pagination?.current_page || 1) + 1,
                },
                {
                    preserveState: true,
                    preserveScroll: true,
                },
            );
        }
    };

    return (
        <div>
            <Table>
                <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id}>
                            {headerGroup.headers.map((header) => (
                                <TableHead key={header.id}>
                                    {header.isPlaceholder
                                        ? null
                                        : flexRender(
                                              header.column.columnDef.header,
                                              header.getContext(),
                                          )}
                                </TableHead>
                            ))}
                        </TableRow>
                    ))}
                </TableHeader>
                <TableBody>
                    {table.getRowModel().rows?.length ? (
                        table.getRowModel().rows.map((row) => (
                            <TableRow
                                key={row.id}
                                data-state={row.getIsSelected() && 'selected'}
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
                                Nenhum cliente encontrado.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>

            {/* Paginação */}
            <div className="flex items-center justify-between px-4 py-4">
                <div className="text-sm text-muted-foreground">
                    Mostrando{' '}
                    {((pagination?.current_page || 1) - 1) *
                        (pagination?.per_page || 10) +
                        1}{' '}
                    a{' '}
                    {Math.min(
                        (pagination?.current_page || 1) *
                            (pagination?.per_page || 10),
                        pagination?.total || 0,
                    )}{' '}
                    de {pagination?.total || 0} cliente(s)
                </div>
                <div className="flex items-center space-x-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handlePreviousPage}
                        disabled={(pagination?.current_page || 1) <= 1}
                    >
                        <ChevronLeft className="h-4 w-4" />
                        Anterior
                    </Button>
                    <span className="text-sm">
                        Página {pagination?.current_page || 1} de{' '}
                        {pagination?.last_page || 1}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleNextPage}
                        disabled={
                            (pagination?.current_page || 1) >=
                            (pagination?.last_page || 1)
                        }
                    >
                        Próximo
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
