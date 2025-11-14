import {
    ColumnDef,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    useReactTable,
} from '@tanstack/react-table';
import * as React from 'react';

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

interface DataTableProps<TData, TValue> {
    columns: ColumnDef<TData, TValue>[];
    data: TData[];
    filters: {
        search: string;
        mapping_status: string;
    };
}

export function DataTable<TData, TValue>({
    columns,
    data,
    filters,
}: DataTableProps<TData, TValue>) {
    const [searchValue, setSearchValue] = React.useState(filters.search || '');

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
    });

    // Debounce para busca
    React.useEffect(() => {
        const timer = setTimeout(() => {
            if (searchValue !== filters?.search) {
                const cleanFilters = Object.fromEntries(
                    Object.entries({
                        ...filters,
                        search: searchValue,
                    }).filter(
                        ([, value]) =>
                            value !== '' &&
                            value !== null &&
                            value !== undefined,
                    ),
                );

                router.get('/product-mappings', cleanFilters, {
                    preserveState: true,
                    preserveScroll: true,
                });
            }
        }, 500);

        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchValue, filters?.search]);

    const updateFilters = (newFilters: Partial<typeof filters>) => {
        const cleanFilters = Object.fromEntries(
            Object.entries({ ...filters, ...newFilters }).filter(
                ([, value]) =>
                    value !== '' && value !== null && value !== undefined,
            ),
        );

        router.get('/product-mappings', cleanFilters, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    return (
        <div className="flex w-full flex-col gap-4 space-x-4 px-4 lg:px-6">
            {/* Filtros */}
            <div className="flex items-center gap-2">
                <Input
                    placeholder="Buscar produtos..."
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    className="max-w-sm"
                />

                <Select
                    value={filters.mapping_status}
                    onValueChange={(value) =>
                        updateFilters({ mapping_status: value })
                    }
                >
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="mapped">Mapeados</SelectItem>
                        <SelectItem value="unmapped">Não Mapeados</SelectItem>
                    </SelectContent>
                </Select>
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
                                    Nenhum produto encontrado.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Informações de estatísticas */}
            <div className="flex items-center justify-between text-sm text-muted-foreground">
                <div>
                    Total: {data.length} produtos |{' '}
                    {
                        data.filter(
                            (item) => (item as { mapped: boolean }).mapped,
                        ).length
                    }{' '}
                    mapeados |{' '}
                    {
                        data.filter(
                            (item) => !(item as { mapped: boolean }).mapped,
                        ).length
                    }{' '}
                    não mapeados
                </div>
            </div>
        </div>
    );
}
