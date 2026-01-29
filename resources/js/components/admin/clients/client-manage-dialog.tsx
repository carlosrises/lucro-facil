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
        tenant_name: '',
        user_name: '',
        user_email: '',
        plan_id: '',
        user_id: '',
    });

    useEffect(() => {
        if (client && open) {
            setData({
                tenant_name: client.tenant?.name || client.name,
                user_name: client.primary_user?.name || client.name,
                user_email: client.primary_user?.email || client.email,
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
                                ? 'Configure os dados da empresa e do usuário responsável.'
                                : 'Crie uma nova empresa com usuário administrador. A senha será gerada automaticamente.'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-6 py-4">
                        {/* Seção 1: Dados da Empresa */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300">
                                    📦
                                </div>
                                <h3 className="font-semibold">
                                    Dados da Empresa
                                </h3>
                            </div>

                            <div className="ml-10 space-y-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="tenant_name">
                                        Nome da Empresa
                                    </Label>
                                    <Input
                                        id="tenant_name"
                                        value={data.tenant_name}
                                        onChange={(e) =>
                                            setData(
                                                'tenant_name',
                                                e.target.value,
                                            )
                                        }
                                        placeholder="Pizzaria do João LTDA"
                                        required
                                    />
                                    {errors.tenant_name && (
                                        <p className="text-sm text-red-500">
                                            {errors.tenant_name}
                                        </p>
                                    )}
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="plan_id">
                                        Plano {!client && '(opcional)'}
                                    </Label>
                                    <Select
                                        value={data.plan_id || undefined}
                                        onValueChange={(value) =>
                                            setData('plan_id', value)
                                        }
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Selecione um plano" />
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
                            </div>
                        </div>

                        {/* Seção 2: Contato Principal */}
                        <div className="space-y-4 border-t pt-4">
                            <div className="flex items-center gap-2">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-300">
                                    👤
                                </div>
                                <h3 className="font-semibold">
                                    Contato Principal
                                </h3>
                            </div>

                            <div className="ml-10 space-y-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="user_name">
                                        Nome do Usuário
                                    </Label>
                                    <Input
                                        id="user_name"
                                        value={data.user_name}
                                        onChange={(e) =>
                                            setData('user_name', e.target.value)
                                        }
                                        placeholder="João Silva"
                                        required
                                    />
                                    {errors.user_name && (
                                        <p className="text-sm text-red-500">
                                            {errors.user_name}
                                        </p>
                                    )}
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="user_email">
                                        E-mail do Usuário
                                    </Label>
                                    <Input
                                        id="user_email"
                                        type="email"
                                        value={data.user_email}
                                        onChange={(e) =>
                                            setData(
                                                'user_email',
                                                e.target.value,
                                            )
                                        }
                                        placeholder="joao@pizzaria.com"
                                        required
                                    />
                                    {errors.user_email && (
                                        <p className="text-sm text-red-500">
                                            {errors.user_email}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
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
