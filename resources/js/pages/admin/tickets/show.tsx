import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import admin from '@/routes/admin';
import { BreadcrumbItem, Tenant, Ticket, TicketMessage, User } from '@/types';
import { Head, router, useForm } from '@inertiajs/react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Send } from 'lucide-react';
import { FormEventHandler } from 'react';
import { toast } from 'sonner';

interface AdminTicketShowProps {
    ticket: Ticket & {
        messages: (TicketMessage & { user: User })[];
        user: User;
        tenant: Tenant;
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

export default function AdminTicketShow({ ticket }: AdminTicketShowProps) {
    const breadcrumbs: BreadcrumbItem[] = [
        {
            title: 'Administração',
            href: admin.dashboard().url,
        },
        {
            title: 'Chamados',
            href: admin.tickets.index().url,
        },
        {
            title: `#${ticket.id}`,
            href: `/admin/tickets/${ticket.id}`,
        },
    ];

    const { data, setData, post, processing, reset } = useForm({
        message: '',
    });

    const handleSubmit: FormEventHandler = (e) => {
        e.preventDefault();

        post(`/admin/tickets/${ticket.id}/reply`, {
            onSuccess: () => {
                toast.success('Resposta enviada!');
                reset();
            },
            onError: () => {
                toast.error('Erro ao enviar resposta.');
            },
        });
    };

    const handleStatusChange = (newStatus: string) => {
        router.patch(
            `/admin/tickets/${ticket.id}/status`,
            { status: newStatus },
            {
                onSuccess: () => {
                    toast.success('Status atualizado!');
                },
            },
        );
    };

    const handlePriorityChange = (newPriority: string) => {
        router.patch(
            `/admin/tickets/${ticket.id}/priority`,
            { priority: newPriority },
            {
                onSuccess: () => {
                    toast.success('Prioridade atualizada!');
                },
            },
        );
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Chamado #${ticket.id} - Admin`} />

            <div className="flex flex-1 flex-col">
                <div className="@container/main flex flex-1 flex-col gap-2">
                    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                        <div className="flex w-full flex-col gap-4 px-4 lg:px-6">
                            {/* Header */}
                            <Card>
                                <CardHeader>
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1">
                                            <CardTitle className="mb-2">
                                                {ticket.subject}
                                            </CardTitle>
                                            <CardDescription>
                                                Chamado #{ticket.id} • Cliente:{' '}
                                                {ticket.tenant?.name} • Criado
                                                em{' '}
                                                {format(
                                                    new Date(ticket.created_at),
                                                    "dd 'de' MMMM 'de' yyyy 'às' HH:mm",
                                                    { locale: ptBR },
                                                )}
                                            </CardDescription>
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <div className="flex gap-2">
                                                <Select
                                                    value={ticket.status}
                                                    onValueChange={
                                                        handleStatusChange
                                                    }
                                                >
                                                    <SelectTrigger className="w-[150px]">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
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
                                                    value={ticket.priority}
                                                    onValueChange={
                                                        handlePriorityChange
                                                    }
                                                >
                                                    <SelectTrigger className="w-[120px]">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
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
                                            </div>
                                        </div>
                                    </div>
                                </CardHeader>
                            </Card>

                            {/* Messages */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Mensagens</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {ticket.messages.map((message) => {
                                        const isAdmin =
                                            message.user &&
                                            message.user.email !==
                                                ticket.user?.email;

                                        return (
                                            <div
                                                key={message.id}
                                                className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}
                                            >
                                                <div
                                                    className={`max-w-[80%] rounded-lg p-4 ${
                                                        isAdmin
                                                            ? 'bg-primary text-primary-foreground'
                                                            : 'bg-muted'
                                                    }`}
                                                >
                                                    <div className="mb-1 flex items-center gap-2 text-sm font-medium">
                                                        {message.user?.name ||
                                                            'Cliente'}
                                                        {isAdmin && (
                                                            <Badge
                                                                variant="outline"
                                                                className="text-xs"
                                                            >
                                                                Admin
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <p className="whitespace-pre-wrap">
                                                        {message.message}
                                                    </p>
                                                    <p className="mt-2 text-xs opacity-70">
                                                        {format(
                                                            new Date(
                                                                message.created_at,
                                                            ),
                                                            "dd/MM/yyyy 'às' HH:mm",
                                                            { locale: ptBR },
                                                        )}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </CardContent>
                            </Card>

                            {/* Reply Form */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Responder ao Cliente</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <form
                                        onSubmit={handleSubmit}
                                        className="space-y-4"
                                    >
                                        <Textarea
                                            placeholder="Digite sua resposta..."
                                            rows={4}
                                            value={data.message}
                                            onChange={(e) =>
                                                setData(
                                                    'message',
                                                    e.target.value,
                                                )
                                            }
                                            required
                                        />
                                        <div className="flex justify-end">
                                            <Button
                                                type="submit"
                                                disabled={processing}
                                            >
                                                <Send className="mr-2 h-4 w-4" />
                                                Enviar Resposta
                                            </Button>
                                        </div>
                                    </form>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
