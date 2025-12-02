import { CancelOrderDialog } from '@/components/orders/cancel-order-dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    CheckCircle2,
    MoreVertical,
    Send,
    ThumbsDown,
    ThumbsUp,
    Truck,
    XCircle,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

type OrderActionsCellProps = {
    orderId: number;
    orderStatus: string;
    orderType: string;
    provider: string;
    handshakeDispute?: Record<string, unknown> | null;
};

export function OrderActionsCell({
    orderId,
    orderStatus,
    orderType,
    provider,
    handshakeDispute,
}: OrderActionsCellProps) {
    const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
    const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [loading, setLoading] = useState(false);

    // Só mostra ações para pedidos do iFood que não estão concluídos/cancelados (full ou código)
    const finishedStatuses = ['CANCELLED', 'CONCLUDED', 'CAN', 'CON'];
    if (provider !== 'ifood' || finishedStatuses.includes(orderStatus)) {
        return null;
    }

    // Verifica se há alguma ação permitida para o status atual
    const hasDisputeActions =
        (orderStatus === 'HANDSHAKE_DISPUTE' || orderStatus === 'HSD') &&
        handshakeDispute;
    const hasConfirmAction = ['PLACED', 'PLC'].includes(orderStatus);
    const hasDispatchAction =
        [
            'CONFIRMED',
            'CFM',
            'SEPARATION_STARTED',
            'SPS',
            'SEPARATION_ENDED',
            'SPE',
            'READY_TO_PICKUP',
            'RTP',
            'DELIVERY_DROP_CODE_REQUESTED',
            'DDCR',
            'DELIVERY_PICKUP_CODE_REQUESTED',
            'DPCR',
            'CANCELLATION_REQUEST_FAILED',
            'CARF',
        ].includes(orderStatus) && orderType === 'DELIVERY';
    const hasReadyAction =
        [
            'CONFIRMED',
            'CFM',
            'SEPARATION_STARTED',
            'SPS',
            'SEPARATION_ENDED',
            'SPE',
            'CANCELLATION_REQUEST_FAILED',
            'CARF',
        ].includes(orderStatus) && orderType === 'TAKEOUT';
    if (
        !hasDisputeActions &&
        !hasConfirmAction &&
        !hasDispatchAction &&
        !hasReadyAction
    ) {
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

    const handleAcceptDispute = async () => {
        if (loading || !handshakeDispute) return;

        setLoading(true);
        try {
            const response = await fetch(
                `/orders/${orderId}/dispute/${handshakeDispute.disputeId}/accept`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN':
                            document
                                .querySelector('meta[name="csrf-token"]')
                                ?.getAttribute('content') || '',
                    },
                },
            );

            const data = await response.json();

            if (data.success) {
                toast.success('Disputa aceita', {
                    description:
                        'O pedido será cancelado conforme solicitado pelo cliente',
                });
                window.location.reload();
            } else {
                toast.error('Erro ao aceitar disputa', {
                    description: data.message || 'Ocorreu um erro inesperado',
                });
            }
        } catch {
            toast.error('Erro ao aceitar disputa', {
                description: 'Ocorreu um erro inesperado',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleRejectDispute = async () => {
        if (loading) return;

        if (!handshakeDispute) {
            toast.error('Dados da disputa não encontrados', {
                description: 'Não foi possível identificar a disputa',
            });
            return;
        }

        if (!rejectReason.trim()) {
            toast.error('Motivo obrigatório', {
                description:
                    'Informe o motivo da rejeição (máx 250 caracteres)',
            });
            return;
        }

        if (rejectReason.length > 250) {
            toast.error('Motivo muito longo', {
                description: 'O motivo deve ter no máximo 250 caracteres',
            });
            return;
        }

        setLoading(true);
        try {
            const response = await fetch(
                `/orders/${orderId}/dispute/${handshakeDispute.disputeId}/reject`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN':
                            document
                                .querySelector('meta[name="csrf-token"]')
                                ?.getAttribute('content') || '',
                    },
                    body: JSON.stringify({ reason: rejectReason }),
                },
            );

            const data = await response.json();

            if (data.success) {
                toast.success('Disputa rejeitada', {
                    description: 'O cancelamento foi negado',
                });
                setRejectDialogOpen(false);
                setRejectReason('');
                window.location.reload();
            } else {
                toast.error('Erro ao rejeitar disputa', {
                    description: data.message || 'Ocorreu um erro inesperado',
                });
            }
        } catch {
            toast.error('Erro ao rejeitar disputa', {
                description: 'Ocorreu um erro inesperado',
            });
        } finally {
            setLoading(false);
        }
    };

    // Determina quais ações estão disponíveis baseado no status
    // Aceita tanto fullCode (completo) quanto code (abreviado) conforme API iFood
    // PLC = PLACED, CFM = CONFIRMED, CAN = CANCELLED, etc
    const canConfirm = ['PLACED', 'PLC'].includes(orderStatus);

    // Pode despachar quando confirmado ou durante eventos de entrega pré-despacho
    const canDispatch =
        [
            'CONFIRMED',
            'CFM',
            'SEPARATION_STARTED',
            'SPS',
            'SEPARATION_ENDED',
            'SPE',
            'READY_TO_PICKUP',
            'RTP',
            'DELIVERY_DROP_CODE_REQUESTED',
            'DDCR',
            'DELIVERY_PICKUP_CODE_REQUESTED',
            'DPCR',
            'CANCELLATION_REQUEST_FAILED', // Permite despachar se falha no cancelamento
            'CARF',
        ].includes(orderStatus) && orderType === 'DELIVERY';

    // Pode marcar como pronto quando confirmado ou durante separação
    const canReady =
        [
            'CONFIRMED',
            'CFM',
            'SEPARATION_STARTED',
            'SPS',
            'SEPARATION_ENDED',
            'SPE',
            'CANCELLATION_REQUEST_FAILED', // Permite marcar pronto se falha no cancelamento
            'CARF',
        ].includes(orderStatus) && orderType === 'TAKEOUT';

    const canCancel = ['PLACED', 'PLC', 'CONFIRMED', 'CFM'].includes(
        orderStatus,
    );

    // Mostra o menu de ações apenas para pedidos com status de disputa aberta

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

                    {/* Ações de disputa: só aparecem se status for HANDSHAKE_DISPUTE e handshakeDispute existir */}
                    {orderStatus === 'HANDSHAKE_DISPUTE' &&
                        handshakeDispute && (
                            <>
                                <DropdownMenuItem onClick={handleAcceptDispute}>
                                    <ThumbsUp className="mr-2 h-4 w-4 text-green-600" />
                                    Aceitar Cancelamento
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => setRejectDialogOpen(true)}
                                >
                                    <ThumbsDown className="mr-2 h-4 w-4 text-red-600" />
                                    Rejeitar Cancelamento
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                            </>
                        )}

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

            <AlertDialog
                open={rejectDialogOpen}
                onOpenChange={setRejectDialogOpen}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Rejeitar Disputa de Cancelamento
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Informe o motivo para rejeitar a solicitação de
                            cancelamento do cliente (máximo 250 caracteres).
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <div className="space-y-2 py-4">
                        <Label htmlFor="reject-reason">
                            Motivo da rejeição *
                        </Label>
                        <Textarea
                            id="reject-reason"
                            placeholder="Ex: Pedido já foi preparado e está pronto para entrega..."
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            className="min-h-[100px]"
                            maxLength={250}
                        />
                        <p className="text-xs text-muted-foreground">
                            {rejectReason.length}/250 caracteres
                        </p>
                    </div>

                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={loading}>
                            Cancelar
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                handleRejectDispute();
                            }}
                            disabled={loading || !rejectReason.trim()}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            {loading
                                ? 'Rejeitando...'
                                : 'Rejeitar Cancelamento'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
