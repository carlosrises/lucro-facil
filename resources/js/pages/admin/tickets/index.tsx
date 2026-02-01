import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import admin from '@/routes/admin';
import { BreadcrumbItem, Ticket } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MessageSquare, Search } from 'lucide-react';
import { useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Administração',
        href: admin.dashboard().url,
    },
    {
        title: 'Chamados',
        href: admin.tickets.index().url,
    },
];

interface AdminTicketsPageProps {
    tickets: {
        data: Ticket[];
        links: any;
        meta: any;
    };
    filters: {
        status?: string;
        priority?: string;
        search?: string;
    };
}

const statusLabels = {
    open: 'Aberto',
    in_progress: 'Em Andamento',
    closed: 'Fechado',
};

const statusColors = {
    open: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    in_progress:
        'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
    closed: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
};

const priorityLabels = {
    low: 'Baixa',
    medium: 'Média',
    high: 'Alta',
};

const priorityColors = {
    low: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
    high: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
};

export default function AdminTicketsIndex({
    tickets,
    filters,
}: AdminTicketsPageProps) {
    const [search, setSearch] = useState(filters.search || '');
    const [status, setStatus] = useState(filters.status || 'all');
    const [priority, setPriority] = useState(filters.priority || 'all');

    const handleFilter = () => {
        router.get(
            '/admin/tickets',
            {
                status: status !== 'all' ? status : undefined,
                priority: priority !== 'all' ? priority : undefined,
                search: search || undefined,
            },
            { preserveState: true },
        );
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Chamados - Admin" />

            <div className="flex flex-1 flex-col">
                <div className="@container/main flex flex-1 flex-col gap-2">
                    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                        <div className="flex w-full flex-col gap-4 px-4 lg:px-6">
                            {/* Header */}
                            <div>
                                <h1 className="text-3xl font-bold">Chamados</h1>
                                <p className="text-muted-foreground">
                                    Gerencie todos os chamados dos clientes
                                </p>
                            </div>

                            {/* Filtros */}
                            <Card>
                                <CardContent className="pt-6">
                                    <div className="flex flex-col gap-4 md:flex-row">
                                        <div className="flex-1">
                                            <div className="relative">
                                                <Search className="absolute top-2.5 left-2 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    placeholder="Buscar por assunto ou cliente..."
                                                    value={search}
                                                    onChange={(e) =>
                                                        setSearch(
                                                            e.target.value,
                                                        )
                                                    }
                                                    onKeyDown={(e) =>
                                                        e.key === 'Enter' &&
                                                        handleFilter()
                                                    }
                                                    className="pl-8"
                                                />
                                            </div>
                                        </div>
                                        <Select
                                            value={status}
                                            onValueChange={setStatus}
                                        >
                                            <SelectTrigger className="w-full md:w-[180px]">
                                                <SelectValue placeholder="Status" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">
                                                    Todos os Status
                                                </SelectItem>
                                                <SelectItem value="open">
                                                    Aberto
                                                </SelectItem>
                                                <SelectItem value="in_progress">
                                                    Em Andamento
                                                </SelectItem>
                                                <SelectItem value="closed">
                                                    Fechado
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <Select
                                            value={priority}
                                            onValueChange={setPriority}
                                        >
                                            <SelectTrigger className="w-full md:w-[180px]">
                                                <SelectValue placeholder="Prioridade" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">
                                                    Todas as Prioridades
                                                </SelectItem>
                                                <SelectItem value="low">
                                                    Baixa
                                                </SelectItem>
                                                <SelectItem value="medium">
                                                    Média
                                                </SelectItem>
                                                <SelectItem value="high">
                                                    Alta
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <Button onClick={handleFilter}>
                                            Filtrar
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Lista de Tickets */}
                            <div className="grid gap-4">
                                {tickets.data.length === 0 ? (
                                    <Card>
                                        <CardContent className="flex flex-col items-center justify-center py-12">
                                            <MessageSquare className="mb-4 h-12 w-12 text-muted-foreground" />
                                            <p className="text-muted-foreground">
                                                Nenhum chamado encontrado
                                            </p>
                                        </CardContent>
                                    </Card>
                                ) : (
                                    tickets.data.map((ticket) => (
                                        <Link
                                            key={ticket.id}
                                            href={`/admin/tickets/${ticket.id}`}
                                        >
                                            <Card className="transition-colors hover:bg-muted/50">
                                                <CardHeader>
                                                    <div className="flex items-start justify-between gap-4">
                                                        <div className="flex-1">
                                                            <CardTitle className="mb-2">
                                                                {ticket.subject}
                                                            </CardTitle>
                                                            <CardDescription>
                                                                #{ticket.id} •
                                                                Cliente:{' '}
                                                                {
                                                                    ticket
                                                                        .tenant
                                                                        ?.name
                                                                }{' '}
                                                                • Criado{' '}
                                                                {formatDistanceToNow(
                                                                    new Date(
                                                                        ticket.created_at,
                                                                    ),
                                                                    {
                                                                        addSuffix: true,
                                                                        locale: ptBR,
                                                                    },
                                                                )}
                                                            </CardDescription>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <Badge
                                                                className={
                                                                    statusColors[
                                                                        ticket.status as keyof typeof statusColors
                                                                    ]
                                                                }
                                                            >
                                                                {
                                                                    statusLabels[
                                                                        ticket.status as keyof typeof statusLabels
                                                                    ]
                                                                }
                                                            </Badge>
                                                            <Badge
                                                                className={
                                                                    priorityColors[
                                                                        ticket.priority as keyof typeof priorityColors
                                                                    ]
                                                                }
                                                            >
                                                                {
                                                                    priorityLabels[
                                                                        ticket.priority as keyof typeof priorityLabels
                                                                    ]
                                                                }
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                </CardHeader>
                                            </Card>
                                        </Link>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
