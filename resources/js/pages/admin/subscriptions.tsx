import { Badge } from '@/components/ui/badge';
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
import AppLayout from '@/layouts/app-layout';
import admin from '@/routes/admin';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import {
    createColumnHelper,
    flexRender,
    getCoreRowModel,
    useReactTable,
} from '@tanstack/react-table';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Administração',
        href: admin.dashboard().url,
    },
    {
        title: 'Assinaturas',
        href: admin.subscriptions.index().url,
    },
];

interface Subscription {
    id: number;
    tenant: {
        id: number;
        name: string;
        users?: Array<{
            name: string;
            email: string;
        }>;
    };
    plan: {
        id: number;
        name: string;
    };
    price_interval: string;
    status: string;
    started_on: string;
    ends_on: string | null;
    trial_ends_at: string | null;
    stripe_subscription_id: string | null;
}

interface SubscriptionsProps {
    subscriptions: {
        data: Subscription[];
        current_page: number;
        last_page: number;
        per_page: number;
        from: number;
        to: number;
        total: number;
    };
    plans: Array<{
        id: number;
        name: string;
    }>;
    filters: {
        search: string;
        status: string;
        plan_id: string;
        price_interval: string;
    };
}

const columnHelper = createColumnHelper<Subscription>();

const statusLabels: Record<
    string,
    {
        label: string;
        variant:
            | 'default'
            | 'secondary'
            | 'destructive'
            | 'outline'
            | 'success';
    }
> = {
    active: { label: 'Ativo', variant: 'success' },
    trialing: { label: 'Trial', variant: 'default' },
    canceled: { label: 'Cancelado', variant: 'destructive' },
    past_due: { label: 'Vencido', variant: 'destructive' },
    incomplete: { label: 'Incompleto', variant: 'outline' },
    replaced: { label: 'Substituído', variant: 'secondary' },
};

const intervalLabels: Record<string, string> = {
    month: 'Mensal',
    year: 'Anual',
};

export default function AdminSubscriptions() {
    const { subscriptions, filters, plans } =
        usePage<SubscriptionsProps>().props;

    const [searchInput, setSearchInput] = useState(filters.search || '');

    const columns = [
        columnHelper.accessor('tenant.name', {
            header: 'Cliente',
            cell: (info) => {
                const tenant = info.row.original.tenant;
                const primaryUser = tenant.users?.[0];
                return (
                    <div className="flex flex-col">
                        <span className="font-medium">{info.getValue()}</span>
                        {primaryUser && (
                            <span className="text-xs text-muted-foreground">
                                {primaryUser.email}
                            </span>
                        )}
                    </div>
                );
            },
        }),
        columnHelper.accessor('plan.name', {
            header: 'Plano',
            cell: (info) => (
                <span className="font-medium">{info.getValue()}</span>
            ),
        }),
        columnHelper.accessor('price_interval', {
            header: 'Período',
            cell: (info) => (
                <Badge variant="outline">
                    {intervalLabels[info.getValue()] || info.getValue()}
                </Badge>
            ),
        }),
        columnHelper.accessor('status', {
            header: 'Status',
            cell: (info) => {
                const status = info.getValue();
                const config = statusLabels[status] || {
                    label: status,
                    variant: 'outline' as const,
                };
                return <Badge variant={config.variant}>{config.label}</Badge>;
            },
        }),
        columnHelper.accessor('started_on', {
            header: 'Início',
            cell: (info) => {
                const date = new Date(info.getValue());
                return date.toLocaleDateString('pt-BR');
            },
        }),
        columnHelper.accessor('ends_on', {
            header: 'Renovação',
            cell: (info) => {
                const value = info.getValue();
                if (!value)
                    return <span className="text-muted-foreground">—</span>;
                const date = new Date(value);
                return date.toLocaleDateString('pt-BR');
            },
        }),
        columnHelper.display({
            id: 'trial',
            header: 'Trial',
            cell: (info) => {
                const trial = info.row.original.trial_ends_at;
                if (!trial)
                    return <span className="text-muted-foreground">—</span>;
                const date = new Date(trial);
                return (
                    <span className="text-xs">
                        {date.toLocaleDateString('pt-BR')}
                    </span>
                );
            },
        }),
    ];

    const table = useReactTable({
        data: subscriptions.data,
        columns,
        getCoreRowModel: getCoreRowModel(),
    });

    const handleSearch = (value: string) => {
        router.get(
            admin.subscriptions.index().url,
            { ...filters, search: value },
            { preserveState: true, preserveScroll: true },
        );
    };

    const handleFilterChange = (key: string, value: string) => {
        router.get(
            admin.subscriptions.index().url,
            { ...filters, [key]: value || undefined },
            { preserveState: true, preserveScroll: true },
        );
    };

    const handlePageChange = (page: number) => {
        router.get(
            admin.subscriptions.index().url,
            { ...filters, page },
            { preserveState: true, preserveScroll: true },
        );
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Assinaturas - Admin" />

            <div className="flex flex-1 flex-col">
                <div className="@container/main flex flex-1 flex-col gap-2">
                    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                        <div className="flex w-full flex-col gap-4 space-x-4 px-4 lg:px-6">
                            {/* Header */}
                            <div className="flex items-center justify-between">
                                <div>
                                    <h1 className="text-2xl font-bold tracking-tight">
                                        Assinaturas
                                    </h1>
                                    <p className="text-sm text-muted-foreground">
                                        {subscriptions.total} assinatura
                                        {subscriptions.total !== 1
                                            ? 's'
                                            : ''}{' '}
                                        no total
                                    </p>
                                </div>
                            </div>

                            {/* Filtros */}
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                                <div className="relative flex-1">
                                    <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Buscar por cliente ou email..."
                                        value={searchInput}
                                        onChange={(e) =>
                                            setSearchInput(e.target.value)
                                        }
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                handleSearch(searchInput);
                                            }
                                        }}
                                        className="pl-8"
                                    />
                                </div>

                                <Select
                                    value={filters.status || 'all'}
                                    onValueChange={(value) =>
                                        handleFilterChange(
                                            'status',
                                            value === 'all' ? '' : value,
                                        )
                                    }
                                >
                                    <SelectTrigger className="w-full sm:w-[180px]">
                                        <SelectValue placeholder="Status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">
                                            Todos status
                                        </SelectItem>
                                        <SelectItem value="active">
                                            Ativo
                                        </SelectItem>
                                        <SelectItem value="trialing">
                                            Trial
                                        </SelectItem>
                                        <SelectItem value="canceled">
                                            Cancelado
                                        </SelectItem>
                                        <SelectItem value="past_due">
                                            Vencido
                                        </SelectItem>
                                    </SelectContent>
                                </Select>

                                <Select
                                    value={filters.plan_id || 'all'}
                                    onValueChange={(value) =>
                                        handleFilterChange(
                                            'plan_id',
                                            value === 'all' ? '' : value,
                                        )
                                    }
                                >
                                    <SelectTrigger className="w-full sm:w-[180px]">
                                        <SelectValue placeholder="Plano" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">
                                            Todos planos
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

                                <Select
                                    value={filters.price_interval || 'all'}
                                    onValueChange={(value) =>
                                        handleFilterChange(
                                            'price_interval',
                                            value === 'all' ? '' : value,
                                        )
                                    }
                                >
                                    <SelectTrigger className="w-full sm:w-[180px]">
                                        <SelectValue placeholder="Período" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">
                                            Todos períodos
                                        </SelectItem>
                                        <SelectItem value="month">
                                            Mensal
                                        </SelectItem>
                                        <SelectItem value="year">
                                            Anual
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Tabela */}
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        {table
                                            .getHeaderGroups()
                                            .map((headerGroup) => (
                                                <TableRow key={headerGroup.id}>
                                                    {headerGroup.headers.map(
                                                        (header) => (
                                                            <TableHead
                                                                key={header.id}
                                                            >
                                                                {header.isPlaceholder
                                                                    ? null
                                                                    : flexRender(
                                                                          header
                                                                              .column
                                                                              .columnDef
                                                                              .header,
                                                                          header.getContext(),
                                                                      )}
                                                            </TableHead>
                                                        ),
                                                    )}
                                                </TableRow>
                                            ))}
                                    </TableHeader>
                                    <TableBody>
                                        {table.getRowModel().rows?.length ? (
                                            table
                                                .getRowModel()
                                                .rows.map((row) => (
                                                    <TableRow key={row.id}>
                                                        {row
                                                            .getVisibleCells()
                                                            .map((cell) => (
                                                                <TableCell
                                                                    key={
                                                                        cell.id
                                                                    }
                                                                >
                                                                    {flexRender(
                                                                        cell
                                                                            .column
                                                                            .columnDef
                                                                            .cell,
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
                                                    Nenhuma assinatura
                                                    encontrada.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Paginação */}
                            {subscriptions.last_page > 1 && (
                                <div className="flex items-center justify-between">
                                    <div className="text-sm text-muted-foreground">
                                        Mostrando {subscriptions.from} a{' '}
                                        {subscriptions.to} de{' '}
                                        {subscriptions.total} resultado
                                        {subscriptions.total !== 1 ? 's' : ''}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                handlePageChange(
                                                    subscriptions.current_page -
                                                        1,
                                                )
                                            }
                                            disabled={
                                                subscriptions.current_page === 1
                                            }
                                        >
                                            <ChevronLeft className="h-4 w-4" />
                                            Anterior
                                        </Button>
                                        <div className="text-sm">
                                            Página {subscriptions.current_page}{' '}
                                            de {subscriptions.last_page}
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                handlePageChange(
                                                    subscriptions.current_page +
                                                        1,
                                                )
                                            }
                                            disabled={
                                                subscriptions.current_page ===
                                                subscriptions.last_page
                                            }
                                        >
                                            Próxima
                                            <ChevronRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
