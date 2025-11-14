import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useForm } from '@inertiajs/react';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { Client } from './columns';

interface Plan {
    id: number;
    name: string;
}

interface ClientManageDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    client: Client | null;
    plans: Plan[];
}

export function ClientManageDialog({
    open,
    onOpenChange,
    client,
    plans,
}: ClientManageDialogProps) {
    const { data, setData, post, patch, processing, errors, reset } = useForm({
        name: '',
        email: '',
        plan_id: '',
        user_id: '',
    });

    useEffect(() => {
        if (client && open) {
            setData({
                name: client.name,
                email: client.email,
                plan_id: client.subscription?.plan_id.toString() || '',
                user_id: client.primary_user?.id.toString() || '',
            });
        } else if (!open) {
            reset();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [client, open]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (client) {
            // Editar cliente existente
            patch(`/admin/clients/${client.id}`, {
                preserveScroll: true,
                onSuccess: () => {
                    onOpenChange(false);
                    reset();
                    toast.success('Cliente atualizado com sucesso!');
                },
                onError: (errors) => {
                    console.log('Validation errors:', errors);
                    toast.error('Erro ao atualizar cliente.');
                },
            });
        } else {
            // Criar novo cliente
            post('/admin/clients', {
                preserveScroll: true,
                onSuccess: () => {
                    onOpenChange(false);
                    reset();
                    toast.success('Cliente criado com sucesso!');
                },
                onError: () => {
                    toast.error('Erro ao criar cliente.');
                },
            });
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>
                            {client ? 'Editar Cliente' : 'Novo Cliente'}
                        </DialogTitle>
                        <DialogDescription>
                            {client
                                ? 'Atualize as informações do cliente (tenant).'
                                : 'Preencha os dados para criar um novo cliente. Um usuário será criado automaticamente com senha aleatória.'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name">Nome do cliente</Label>
                            <Input
                                id="name"
                                value={data.name}
                                onChange={(e) =>
                                    setData('name', e.target.value)
                                }
                                placeholder="Empresa LTDA"
                                required
                            />
                            {errors.name && (
                                <p className="text-sm text-red-500">
                                    {errors.name}
                                </p>
                            )}
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="email">E-mail</Label>
                            <Input
                                id="email"
                                type="email"
                                value={data.email}
                                onChange={(e) =>
                                    setData('email', e.target.value)
                                }
                                placeholder="contato@empresa.com"
                                required
                            />
                            {errors.email && (
                                <p className="text-sm text-red-500">
                                    {errors.email}
                                </p>
                            )}
                        </div>

                        {!client && (
                            <div className="grid gap-2">
                                <Label htmlFor="plan_id">
                                    Plano (opcional)
                                </Label>
                                <Select
                                    value={data.plan_id || undefined}
                                    onValueChange={(value) =>
                                        setData('plan_id', value)
                                    }
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Sem plano" />
                                    </SelectTrigger>
                                    <SelectContent>
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
                                {errors.plan_id && (
                                    <p className="text-sm text-red-500">
                                        {errors.plan_id}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={processing}>
                            {processing
                                ? 'Salvando...'
                                : client
                                  ? 'Atualizar'
                                  : 'Criar'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
