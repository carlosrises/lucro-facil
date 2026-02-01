import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { FormEventHandler } from 'react';
import { toast } from 'sonner';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Suporte', href: '#' },
    { title: 'Chamados', href: '/tickets' },
    { title: 'Novo Chamado', href: '/tickets/create' },
];

export default function CreateTicket() {
    const { data, setData, post, processing, errors } = useForm({
        subject: '',
        message: '',
        priority: 'medium' as 'low' | 'medium' | 'high',
    });

    const handleSubmit: FormEventHandler = (e) => {
        e.preventDefault();

        post('/tickets', {
            onSuccess: () => {
                toast.success('Chamado criado com sucesso!');
            },
            onError: () => {
                toast.error('Erro ao criar chamado. Verifique os dados.');
            },
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Novo Chamado" />

            <div className="flex flex-1 flex-col">
                <div className="@container/main flex flex-1 flex-col gap-2">
                    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                        <div className="flex w-full flex-col gap-4 px-4 lg:px-6">
                            {/* Header */}
                            <div>
                                <h1 className="text-3xl font-bold">
                                    Novo Chamado
                                </h1>
                                <p className="text-muted-foreground">
                                    Descreva seu problema ou dúvida e nossa
                                    equipe responderá em breve
                                </p>
                            </div>

                            <Card>
                                <CardContent className="pt-6">
                                    <form
                                        onSubmit={handleSubmit}
                                        className="space-y-4"
                                    >
                                        <div className="space-y-2">
                                            <Label htmlFor="subject">
                                                Assunto
                                            </Label>
                                            <Input
                                                id="subject"
                                                placeholder="Ex: Problema com integração do iFood"
                                                value={data.subject}
                                                onChange={(e) =>
                                                    setData(
                                                        'subject',
                                                        e.target.value,
                                                    )
                                                }
                                                required
                                            />
                                            {errors.subject && (
                                                <p className="text-sm text-red-500">
                                                    {errors.subject}
                                                </p>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="priority">
                                                Prioridade
                                            </Label>
                                            <Select
                                                value={data.priority}
                                                onValueChange={(value) =>
                                                    setData(
                                                        'priority',
                                                        value as
                                                            | 'low'
                                                            | 'medium'
                                                            | 'high',
                                                    )
                                                }
                                            >
                                                <SelectTrigger>
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
                                            {errors.priority && (
                                                <p className="text-sm text-red-500">
                                                    {errors.priority}
                                                </p>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="message">
                                                Mensagem
                                            </Label>
                                            <Textarea
                                                id="message"
                                                placeholder="Descreva detalhadamente seu problema ou dúvida..."
                                                rows={8}
                                                value={data.message}
                                                onChange={(e) =>
                                                    setData(
                                                        'message',
                                                        e.target.value,
                                                    )
                                                }
                                                required
                                            />
                                            {errors.message && (
                                                <p className="text-sm text-red-500">
                                                    {errors.message}
                                                </p>
                                            )}
                                        </div>

                                        <div className="flex justify-end gap-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={() =>
                                                    window.history.back()
                                                }
                                            >
                                                Cancelar
                                            </Button>
                                            <Button
                                                type="submit"
                                                disabled={processing}
                                            >
                                                Criar Chamado
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
