import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Check, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

type CancelOrderDialogProps = {
    orderId: number;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
};

type CancellationReason = {
    cancelCodeId: string;
    description: string;
};

export function CancelOrderDialog({
    orderId,
    open,
    onOpenChange,
    onSuccess,
}: CancelOrderDialogProps) {
    const [loading, setLoading] = useState(false);
    const [loadingReasons, setLoadingReasons] = useState(false);
    const [reasons, setReasons] = useState<CancellationReason[]>([]);
    const [selectedReason, setSelectedReason] = useState<string>('');

    const loadReasons = useCallback(async () => {
        setLoadingReasons(true);
        try {
            const response = await fetch(
                `/orders/${orderId}/cancellation-reasons`,
            );
            const data = await response.json();

            if (data.success) {
                console.log('Cancellation reasons received:', data.data);
                setReasons(data.data || []);
            } else {
                toast.error('Erro ao carregar motivos de cancelamento', {
                    description: data.message,
                });
            }
        } catch {
            toast.error('Erro ao carregar motivos de cancelamento', {
                description: 'Ocorreu um erro inesperado',
            });
        } finally {
            setLoadingReasons(false);
        }
    }, [orderId]);

    useEffect(() => {
        if (open) {
            loadReasons();
            setSelectedReason('');
        }
    }, [open, loadReasons]);

    const handleCancel = async () => {
        if (!selectedReason) {
            toast.error('Selecione um motivo', {
                description:
                    'É obrigatório selecionar um motivo para cancelar o pedido',
            });
            return;
        }

        setLoading(true);
        try {
            const response = await fetch(`/orders/${orderId}/cancel`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN':
                        document
                            .querySelector('meta[name="csrf-token"]')
                            ?.getAttribute('content') || '',
                },
                body: JSON.stringify({
                    cancellation_code: selectedReason,
                }),
            });

            const data = await response.json();

            if (data.success) {
                toast.success('Pedido cancelado', {
                    description: 'O pedido foi cancelado com sucesso',
                });
                onOpenChange(false);
                onSuccess?.();
            } else {
                toast.error('Erro ao cancelar pedido', {
                    description: data.message,
                });
            }
        } catch {
            toast.error('Erro ao cancelar pedido', {
                description: 'Ocorreu um erro inesperado',
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Cancelar Pedido</DialogTitle>
                    <DialogDescription>
                        Selecione o motivo do cancelamento. Esta ação não pode
                        ser desfeita.
                    </DialogDescription>
                </DialogHeader>

                {loadingReasons ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Motivo do cancelamento *</Label>
                            {selectedReason && (
                                <p className="text-xs text-muted-foreground">
                                    Selecionado: {selectedReason}
                                </p>
                            )}
                            <div className="max-h-[300px] space-y-2 overflow-y-auto rounded-md border p-4">
                                {reasons.map((reason) => {
                                    const isSelected =
                                        selectedReason === reason.cancelCodeId;

                                    return (
                                        <button
                                            key={reason.cancelCodeId}
                                            type="button"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                console.log(
                                                    'Clicked reason:',
                                                    reason.cancelCodeId,
                                                );
                                                console.log(
                                                    'Current selectedReason:',
                                                    selectedReason,
                                                );
                                                setSelectedReason(
                                                    reason.cancelCodeId,
                                                );
                                            }}
                                            disabled={loading}
                                            className={cn(
                                                'w-full rounded-lg border p-3 text-left text-sm transition-all hover:bg-accent',
                                                isSelected
                                                    ? 'border-primary bg-primary/10'
                                                    : 'border-border',
                                                loading &&
                                                    'cursor-not-allowed opacity-50',
                                            )}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div
                                                    className={cn(
                                                        'mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2',
                                                        isSelected
                                                            ? 'border-primary bg-primary'
                                                            : 'border-muted-foreground',
                                                    )}
                                                >
                                                    {isSelected && (
                                                        <Check className="h-3 w-3 text-primary-foreground" />
                                                    )}
                                                </div>
                                                <span className="flex-1">
                                                    {reason.description}
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {reasons.length === 0 && !loadingReasons && (
                            <p className="text-sm text-muted-foreground">
                                Nenhum motivo de cancelamento disponível para
                                este pedido.
                            </p>
                        )}
                    </div>
                )}

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={loading}
                    >
                        Cancelar
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleCancel}
                        disabled={loading || !selectedReason || loadingReasons}
                    >
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Cancelando...
                            </>
                        ) : (
                            'Confirmar Cancelamento'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
