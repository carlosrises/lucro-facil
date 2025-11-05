import { CancelOrderDialog } from '@/components/orders/cancel-order-dialog';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CheckCircle2, MoreVertical, Send, Truck, XCircle } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

type OrderActionsCellProps = {
    orderId: number;
    orderStatus: string;
    orderType: string;
    provider: string;
};

export function OrderActionsCell({
    orderId,
    orderStatus,
    orderType,
    provider,
}: OrderActionsCellProps) {
    const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    // Apenas pedidos iFood podem usar estas ações
    if (provider !== 'ifood') {
        return null;
    }

    const handleConfirm = async () => {
        if (loading) return;

        setLoading(true);
        try {
            const response = await fetch(`/orders/${orderId}/confirm`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN':
                        document
                            .querySelector('meta[name="csrf-token"]')
                            ?.getAttribute('content') || '',
                },
            });

            const data = await response.json();

            if (data.success) {
                toast.success('Pedido confirmado', {
                    description: 'O pedido foi confirmado com sucesso',
                });
                window.location.reload(); // Recarrega para atualizar status
            } else {
                toast.error('Erro ao confirmar pedido', {
                    description: data.message || 'Ocorreu um erro inesperado',
                });
            }
        } catch {
            toast.error('Erro ao confirmar pedido', {
                description: 'Ocorreu um erro inesperado',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleDispatch = async () => {
        if (loading) return;

        setLoading(true);
        try {
            const response = await fetch(`/orders/${orderId}/dispatch`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN':
                        document
                            .querySelector('meta[name="csrf-token"]')
                            ?.getAttribute('content') || '',
                },
            });

            const data = await response.json();

            if (data.success) {
                toast.success('Pedido despachado', {
                    description: 'O pedido foi despachado com sucesso',
                });
                window.location.reload();
            } else {
                toast.error('Erro ao despachar pedido', {
                    description: data.message || 'Ocorreu um erro inesperado',
                });
            }
        } catch {
            toast.error('Erro ao despachar pedido', {
                description: 'Ocorreu um erro inesperado',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleReady = async () => {
        if (loading) return;

        setLoading(true);
        try {
            const response = await fetch(`/orders/${orderId}/ready`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN':
                        document
                            .querySelector('meta[name="csrf-token"]')
                            ?.getAttribute('content') || '',
                },
            });

            const data = await response.json();

            if (data.success) {
                toast.success('Pedido pronto', {
                    description:
                        'O pedido foi marcado como pronto para retirada',
                });
                window.location.reload();
            } else {
                toast.error('Erro ao marcar pedido como pronto', {
                    description: data.message || 'Ocorreu um erro inesperado',
                });
            }
        } catch {
            toast.error('Erro ao marcar pedido como pronto', {
                description: 'Ocorreu um erro inesperado',
            });
        } finally {
            setLoading(false);
        }
    };

    // Determina quais ações estão disponíveis baseado no status
    const canConfirm = orderStatus === 'PLACED' || orderStatus === 'CONFIRMED';
    const canDispatch = orderStatus === 'CONFIRMED' && orderType === 'DELIVERY';
    const canReady = orderStatus === 'CONFIRMED' && orderType === 'TAKEOUT';
    const canCancel = ['PLACED', 'CONFIRMED'].includes(orderStatus);

    // Se não há ações disponíveis, não mostra o dropdown
    if (!canConfirm && !canDispatch && !canReady && !canCancel) {
        return null;
    }

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        disabled={loading}
                    >
                        <span className="sr-only">Abrir menu</span>
                        <MoreVertical className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Ações</DropdownMenuLabel>
                    <DropdownMenuSeparator />

                    {canConfirm && (
                        <DropdownMenuItem onClick={handleConfirm}>
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Confirmar
                        </DropdownMenuItem>
                    )}

                    {canDispatch && (
                        <DropdownMenuItem onClick={handleDispatch}>
                            <Truck className="mr-2 h-4 w-4" />
                            Despachar
                        </DropdownMenuItem>
                    )}

                    {canReady && (
                        <DropdownMenuItem onClick={handleReady}>
                            <Send className="mr-2 h-4 w-4" />
                            Pronto para Retirada
                        </DropdownMenuItem>
                    )}

                    {canCancel && (
                        <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                onClick={() => setCancelDialogOpen(true)}
                                className="text-red-600"
                            >
                                <XCircle className="mr-2 h-4 w-4" />
                                Cancelar
                            </DropdownMenuItem>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>

            <CancelOrderDialog
                orderId={orderId}
                open={cancelDialogOpen}
                onOpenChange={setCancelDialogOpen}
                onSuccess={() => {
                    setCancelDialogOpen(false);
                    window.location.reload();
                }}
            />
        </>
    );
}
