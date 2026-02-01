import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem, Ticket, TicketMessage, User } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Send, X } from 'lucide-react';
import { FormEventHandler } from 'react';
import { toast } from 'sonner';

interface TicketShowProps {
    ticket: Ticket & {
        messages: (TicketMessage & { user: User })[];
        user: User;
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

export default function TicketShow({ ticket }: TicketShowProps) {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Suporte', href: '#' },
        { title: 'Chamados', href: '/tickets' },
        { title: `#${ticket.id}`, href: `/tickets/${ticket.id}` },
    ];

    const { data, setData, post, processing, reset } = useForm({
        message: '',
    });

    const handleSubmit: FormEventHandler = (e) => {
        e.preventDefault();

        post(`/tickets/${ticket.id}/messages`, {
            onSuccess: () => {
                toast.success('Mensagem enviada!');
                reset();
            },
            onError: () => {
                toast.error('Erro ao enviar mensagem.');
            },
        });
    };

    const handleClose = () => {
        if (confirm('Deseja realmente fechar este chamado?')) {
            useForm().patch(`/tickets/${ticket.id}/close`, {
                onSuccess: () => {
                    toast.success('Chamado fechado!');
                },
            });
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Chamado #${ticket.id}`} />

            <div className="flex flex-1 flex-col">
                <div className="@container/main flex flex-1 flex-col gap-2">
                    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                        <div className="flex w-full flex-col gap-4 px-4 lg:px-6">
                            {/* Header */}
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <h1 className="text-3xl font-bold">
                                        {ticket.subject}
                                    </h1>
                                    <p className="text-muted-foreground">
                                        Chamado #{ticket.id} • Criado em{' '}
                                        {format(
                                            new Date(ticket.created_at),
                                            "dd 'de' MMMM 'de' yyyy 'às' HH:mm",
                                            { locale: ptBR },
                                        )}
                                    </p>
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
                                                ticket.user.email;

                                        return (
                                            <div
                                                key={message.id}
                                                className={`flex ${isAdmin ? 'justify-start' : 'justify-end'}`}
                                            >
                                                <div
                                                    className={`max-w-[80%] rounded-lg p-4 ${
                                                        isAdmin
                                                            ? 'bg-muted'
                                                            : 'bg-primary text-primary-foreground'
                                                    }`}
                                                >
                                                    <div className="mb-1 flex items-center gap-2 text-sm font-medium">
                                                        {message.user?.name ||
                                                            'Usuário'}
                                                        {isAdmin && (
                                                            <Badge
                                                                variant="outline"
                                                                className="text-xs"
                                                            >
                                                                Suporte
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
                            {ticket.status !== 'closed' && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Responder</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <form
                                            onSubmit={handleSubmit}
                                            className="space-y-4"
                                        >
                                            <Textarea
                                                placeholder="Digite sua mensagem..."
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
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={handleClose}
                                                >
                                                    <X className="mr-2 h-4 w-4" />
                                                    Fechar Chamado
                                                </Button>
                                                <Button
                                                    type="submit"
                                                    disabled={processing}
                                                >
                                                    <Send className="mr-2 h-4 w-4" />
                                                    Enviar
                                                </Button>
                                            </div>
                                        </form>
                                    </CardContent>
                                </Card>
                            )}

                            {ticket.status === 'closed' && (
                                <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950">
                                    <CardContent className="pt-6">
                                        <p className="text-center text-muted-foreground">
                                            Este chamado está fechado. Se
                                            precisar de ajuda adicional, crie um
                                            novo chamado.
                                        </p>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
