import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    AlertCircle,
    AlertTriangle,
    CheckCircle2,
    Clock,
    Loader2,
    RefreshCw,
    XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

type StatusDialogProps = {
    storeId: number;
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

type StatusValidation = {
    id: string;
    code: string;
    state: 'OK' | 'ERROR' | 'WARNING';
    message?: {
        title: string;
        subtitle?: string;
        description?: string;
    };
};

type Reopenable = {
    identifier: string;
    type: string;
    reopenable: boolean;
};

type OperationStatus = {
    operation: string;
    salesChannel: string;
    available: boolean;
    state: 'OK' | 'ERROR' | 'WARNING';
    reopenable?: Reopenable;
    validations?: StatusValidation[];
    message?: {
        title: string;
        subtitle?: string;
        description?: string;
    };
};

export function StatusDialog({
    storeId,
    open,
    onOpenChange,
}: StatusDialogProps) {
    const [loading, setLoading] = useState(false);
    const [statuses, setStatuses] = useState<OperationStatus[]>([]);

    const loadStatus = useCallback(async () => {
        setLoading(true);
        try {
            const response = await fetch(`/stores/${storeId}/status`);
            const data = await response.json();

            if (data.success) {
                // A API retorna um array de status
                setStatuses(Array.isArray(data.data) ? data.data : []);
            } else {
                toast.error('Erro ao carregar status', {
                    description: data.message,
                });
            }
        } catch {
            toast.error('Erro ao carregar status', {
                description: 'Ocorreu um erro inesperado',
            });
        } finally {
            setLoading(false);
        }
    }, [storeId]);

    useEffect(() => {
        if (open) {
            loadStatus();
        }
    }, [open, loadStatus]);

    const getStateBadgeColor = (state: string) => {
        const colors: Record<string, string> = {
            OK: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400',
            OPEN: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400',
            AVAILABLE:
                'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400',
            WARNING:
                'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-400',
            CLOSED: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400',
            ERROR: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400',
            UNAVAILABLE:
                'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400',
        };
        return colors[state] || 'bg-gray-100 text-gray-800';
    };

    const getStateLabel = (state: string) => {
        const labels: Record<string, string> = {
            OK: 'Online',
            OPEN: 'Aberta',
            AVAILABLE: 'Disponível',
            WARNING: 'Online com Restrições',
            CLOSED: 'Fechada',
            ERROR: 'Fechada Inesperadamente',
            UNAVAILABLE: 'Indisponível',
        };
        return labels[state] || state;
    };

    const getValidationLabel = (code: string) => {
        const labels: Record<string, string> = {
            'is-connected': 'Polling Ativo',
            'opening-hours': 'Horário de Funcionamento',
            unavailabilities: 'Interrupção Ativa',
            'radius-restriction': 'Sem Entregadores na Área',
            'payout-blocked': 'Pendências Financeiras',
            'logistics-blocked': 'Problemas Logísticos',
            'terms-service-violation': 'Violação dos Termos de Serviço',
            'status-availability': 'Loja Desativada ou em Teste',
        };
        return labels[code] || code;
    };

    const getStateIcon = (state: string) => {
        const iconClass = 'h-5 w-5';
        switch (state) {
            case 'OK':
            case 'OPEN':
            case 'AVAILABLE':
                return (
                    <CheckCircle2 className={`${iconClass} text-green-600`} />
                );
            case 'WARNING':
                return (
                    <AlertTriangle className={`${iconClass} text-yellow-600`} />
                );
            case 'CLOSED':
                return <Clock className={`${iconClass} text-gray-600`} />;
            case 'ERROR':
            case 'UNAVAILABLE':
                return <XCircle className={`${iconClass} text-red-600`} />;
            default:
                return <AlertCircle className={`${iconClass} text-gray-600`} />;
        }
    };

    const getOperationLabel = (operation: string) => {
        const labels: Record<string, string> = {
            DELIVERY: 'Entrega',
            TAKEOUT: 'Retirada',
            INDOOR: 'Consumo Local',
        };
        return labels[operation] || operation;
    };

    const getSalesChannelLabel = (channel: string) => {
        const labels: Record<string, string> = {
            IFOOD: 'iFood',
            DEFAULT: 'Padrão',
        };
        return labels[channel] || channel;
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Status da Loja</DialogTitle>
                    <DialogDescription>
                        Visualize o status atual de cada operação da loja no
                        iFood
                    </DialogDescription>
                </DialogHeader>

                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : statuses.length > 0 ? (
                    <div className="space-y-4">
                        {statuses.map((status, index) => (
                            <div
                                key={index}
                                className="space-y-3 rounded-lg border p-4"
                            >
                                {/* Header do Status */}
                                <div className="flex items-start justify-between">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-semibold">
                                                {getOperationLabel(
                                                    status.operation,
                                                )}
                                            </h3>
                                            <Badge
                                                variant="outline"
                                                className="text-xs"
                                            >
                                                {getSalesChannelLabel(
                                                    status.salesChannel,
                                                )}
                                            </Badge>
                                        </div>
                                        {status.message && (
                                            <div className="text-sm">
                                                <p className="font-medium">
                                                    {status.message.title}
                                                </p>
                                                {status.message.subtitle && (
                                                    <p className="text-muted-foreground">
                                                        {
                                                            status.message
                                                                .subtitle
                                                        }
                                                    </p>
                                                )}
                                                {status.message.description && (
                                                    <p className="mt-1 text-xs text-muted-foreground">
                                                        {
                                                            status.message
                                                                .description
                                                        }
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex flex-col items-end gap-3">
                                        <div className="flex items-center gap-2">
                                            {getStateIcon(status.state)}
                                            <Badge
                                                className={getStateBadgeColor(
                                                    status.state,
                                                )}
                                            >
                                                {getStateLabel(status.state)}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            {status.available ? (
                                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                            ) : (
                                                <AlertCircle className="h-4 w-4 text-red-600" />
                                            )}
                                            <span className="text-xs font-medium">
                                                {status.available
                                                    ? 'Disponível'
                                                    : 'Indisponível'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Validations */}
                                {status.validations &&
                                    status.validations.length > 0 && (
                                        <div className="mt-3 space-y-2 border-t pt-3">
                                            <p className="text-xs font-semibold text-muted-foreground">
                                                Validações:
                                            </p>
                                            {status.validations.map(
                                                (validation, vIndex) => (
                                                    <div
                                                        key={vIndex}
                                                        className="flex items-start gap-2 rounded bg-muted/50 p-2 text-xs"
                                                    >
                                                        <Badge
                                                            className={getStateBadgeColor(
                                                                validation.state,
                                                            )}
                                                        >
                                                            {getStateLabel(
                                                                validation.state,
                                                            )}
                                                        </Badge>
                                                        <div className="flex-1 space-y-1">
                                                            <p className="font-semibold">
                                                                {getValidationLabel(
                                                                    validation.code,
                                                                )}
                                                            </p>
                                                            <p className="font-mono text-[10px] text-muted-foreground">
                                                                {
                                                                    validation.code
                                                                }
                                                            </p>
                                                            {validation.message && (
                                                                <div className="mt-1 space-y-0.5">
                                                                    <p className="font-medium">
                                                                        {
                                                                            validation
                                                                                .message
                                                                                .title
                                                                        }
                                                                    </p>
                                                                    {validation
                                                                        .message
                                                                        .subtitle && (
                                                                        <p className="text-muted-foreground">
                                                                            {
                                                                                validation
                                                                                    .message
                                                                                    .subtitle
                                                                            }
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ),
                                            )}
                                        </div>
                                    )}

                                {/* Reopenable */}
                                {status.reopenable && (
                                    <div className="mt-2 rounded bg-blue-50 p-2 text-xs dark:bg-blue-950">
                                        <span className="font-semibold">
                                            Pode reabrir:{' '}
                                        </span>
                                        <span>
                                            {status.reopenable.reopenable
                                                ? 'Sim'
                                                : 'Não'}
                                        </span>
                                        <span className="ml-2 text-muted-foreground">
                                            {status.reopenable.type
                                                ? `(${status.reopenable.type})`
                                                : ''}
                                        </span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="py-8 text-center text-muted-foreground">
                        Nenhum status disponível
                    </div>
                )}

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={loadStatus}
                        disabled={loading}
                    >
                        {loading ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <RefreshCw className="mr-2 h-4 w-4" />
                        )}
                        Atualizar
                    </Button>
                    <Button onClick={() => onOpenChange(false)}>Fechar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
