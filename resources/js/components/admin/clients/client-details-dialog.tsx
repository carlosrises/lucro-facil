import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Client } from './columns';

interface ClientDetailsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    client: Client | null;
}

export function ClientDetailsDialog({
    open,
    onOpenChange,
    client,
}: ClientDetailsDialogProps) {
    if (!client) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-[650px]">
                <DialogHeader>
                    <DialogTitle>Detalhes do Cliente</DialogTitle>
                    <DialogDescription>
                        Informações completas sobre {client.name}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-6 overflow-y-auto pr-2">
                    {/* Informações básicas */}
                    <div className="grid gap-4">
                        <div className="grid gap-2">
                            <Label className="text-muted-foreground">
                                Nome
                            </Label>
                            <p className="text-lg font-medium">{client.name}</p>
                        </div>

                        <div className="grid gap-2">
                            <Label className="text-muted-foreground">
                                E-mail
                            </Label>
                            <p>{client.email}</p>
                        </div>

                        <div className="grid gap-2">
                            <Label className="text-muted-foreground">
                                Status
                            </Label>
                            <div>
                                <Badge
                                    variant={
                                        client.status === 'active'
                                            ? 'default'
                                            : 'secondary'
                                    }
                                >
                                    {client.status === 'active'
                                        ? 'Ativo'
                                        : 'Inativo'}
                                </Badge>
                            </div>
                        </div>
                    </div>

                    {/* Usuário principal */}
                    {client.primary_user && (
                        <div className="grid gap-4 rounded-lg border p-4">
                            <h3 className="font-semibold">Usuário Principal</h3>
                            <div className="grid gap-2">
                                <Label className="text-muted-foreground">
                                    Nome
                                </Label>
                                <p>{client.primary_user.name}</p>
                            </div>
                            <div className="grid gap-2">
                                <Label className="text-muted-foreground">
                                    E-mail
                                </Label>
                                <p>{client.primary_user.email}</p>
                            </div>
                        </div>
                    )}

                    {/* Assinatura */}
                    {client.subscription && (
                        <div className="grid gap-4 rounded-lg border p-4">
                            <h3 className="font-semibold">Assinatura</h3>
                            <div className="grid gap-2">
                                <Label className="text-muted-foreground">
                                    Plano
                                </Label>
                                <p className="font-medium">
                                    {client.subscription.plan_name}
                                </p>
                            </div>
                            <div className="grid gap-2">
                                <Label className="text-muted-foreground">
                                    Valor Mensal
                                </Label>
                                <p>
                                    R${' '}
                                    {client.subscription.price.toLocaleString(
                                        'pt-BR',
                                        {
                                            minimumFractionDigits: 2,
                                        },
                                    )}
                                </p>
                            </div>
                            {client.subscription.started_on && (
                                <div className="grid gap-2">
                                    <Label className="text-muted-foreground">
                                        Iniciado em
                                    </Label>
                                    <p>{client.subscription.started_on}</p>
                                </div>
                            )}
                            {client.subscription.ends_on && (
                                <div className="grid gap-2">
                                    <Label className="text-muted-foreground">
                                        Termina em
                                    </Label>
                                    <p>{client.subscription.ends_on}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Estatísticas */}
                    <div className="grid gap-4 rounded-lg border p-4">
                        <h3 className="font-semibold">Estatísticas</h3>
                        <div className="grid gap-2">
                            <Label className="text-muted-foreground">
                                Lojas cadastradas
                            </Label>
                            <p className="text-2xl font-bold">
                                {client.stores_count}
                            </p>
                        </div>
                        <div className="grid gap-2">
                            <Label className="text-muted-foreground">
                                Cadastrado em
                            </Label>
                            <p>{client.created_at}</p>
                            <p className="text-sm text-muted-foreground">
                                {client.created_at_human}
                            </p>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
