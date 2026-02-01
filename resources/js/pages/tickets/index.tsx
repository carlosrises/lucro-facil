import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem, Ticket } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MessageSquare, Plus } from 'lucide-react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Suporte', href: '#' },
    { title: 'Chamados', href: '/tickets' },
];

interface TicketsPageProps {
    tickets: {
        data: Ticket[];
        links: any;
        meta: any;
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

export default function TicketsIndex({ tickets }: TicketsPageProps) {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Chamados" />

            <div className="flex flex-1 flex-col">
                <div className="@container/main flex flex-1 flex-col gap-2">
                    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                        <div className="flex w-full flex-col gap-4 px-4 lg:px-6">
                            {/* Header */}
                            <div className="flex items-center justify-between">
                                <div>
                                    <h1 className="text-3xl font-bold">
                                        Chamados
                                    </h1>
                                    <p className="text-muted-foreground">
                                        Gerencie seus chamados de suporte
                                    </p>
                                </div>
                                <Link href="/tickets/create">
                                    <Button>
                                        <Plus className="mr-2 h-4 w-4" />
                                        Novo Chamado
                                    </Button>
                                </Link>
                            </div>

                            {/* Lista de Tickets */}
                            <div className="grid gap-4">
                                {tickets.data.length === 0 ? (
                                    <Card>
                                        <CardContent className="flex flex-col items-center justify-center py-12">
                                            <MessageSquare className="mb-4 h-12 w-12 text-muted-foreground" />
                                            <p className="text-muted-foreground">
                                                Nenhum chamado encontrado
                                            </p>
                                            <Link href="/tickets/create">
                                                <Button
                                                    className="mt-4"
                                                    variant="outline"
                                                >
                                                    Criar Primeiro Chamado
                                                </Button>
                                            </Link>
                                        </CardContent>
                                    </Card>
                                ) : (
                                    tickets.data.map((ticket) => (
                                        <Link
                                            key={ticket.id}
                                            href={`/tickets/${ticket.id}`}
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
                                                                Criado{' '}
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
