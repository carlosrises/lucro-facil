import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { router } from '@inertiajs/react';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

interface PaymentFee {
    id: number;
    name: string;
    type: 'percentage' | 'fixed';
    value: number;
    provider: string | null;
    payment_type: 'online' | 'offline' | 'all' | null;
    condition_values: string[];
    compatibility?: {
        is_compatible: boolean;
        compatibility_score: number;
        reasons: string[];
        recommendation: string;
    };
}

interface LinkPaymentFeeDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    orderId: number;
    paymentMethod: string;
    paymentMethodName: string;
    provider: string;
    origin?: string;
    availableFees: PaymentFee[];
    onCreateNew: () => void;
}

export function LinkPaymentFeeDialog({
    open,
    onOpenChange,
    orderId,
    paymentMethod,
    paymentMethodName,
    provider,
    origin,
    availableFees,
    onCreateNew,
}: LinkPaymentFeeDialogProps) {
    const [selectedFeeId, setSelectedFeeId] = useState<string>('');
    const [applyToAll, setApplyToAll] = useState(false);
    const [isLinking, setIsLinking] = useState(false);

    const handleLink = () => {
        if (!selectedFeeId) {
            toast.error('Selecione uma taxa de pagamento');
            return;
        }

        setIsLinking(true);

        router.post(
            `/orders/${orderId}/link-payment-fee`,
            {
                payment_method: paymentMethod,
                cost_commission_id: parseInt(selectedFeeId),
                apply_to_all: applyToAll,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    if (applyToAll) {
                        toast.success(
                            'Taxa vinculada a todos os pedidos com sucesso!',
                        );
                    } else {
                        toast.success(
                            'Taxa vinculada manualmente com sucesso!',
                        );
                    }
                    setSelectedFeeId('');
                    setApplyToAll(false);
                    onOpenChange(false);
                },
                onError: (errors) => {
                    const errorMessage = Object.values(errors)
                        .flat()
                        .join(', ');
                    toast.error(`Erro ao vincular taxa: ${errorMessage}`);
                },
                onFinish: () => {
                    setIsLinking(false);
                },
            },
        );
    };

    // VÍNCULO MANUAL: Mostrar TODAS as taxas, ordenadas por compatibilidade
    const allFees = [...availableFees].sort((a, b) => {
        const scoreA = a.compatibility?.compatibility_score ?? 0;
        const scoreB = b.compatibility?.compatibility_score ?? 0;
        return scoreB - scoreA; // Mais compatíveis primeiro
    });

    // Separar em recomendadas e outras
    const recommendedFees = allFees.filter(
        (fee) => fee.compatibility?.is_compatible !== false,
    );
    const otherFees = allFees.filter(
        (fee) => fee.compatibility?.is_compatible === false,
    );

    const formatFeeValue = (fee: PaymentFee) => {
        if (fee.type === 'percentage') {
            return `${fee.value}%`;
        }
        return `R$ ${fee.value.toFixed(2)}`;
    };

    const formatProvider = (providerValue: string | null) => {
        if (!providerValue) return 'Todos';

        const labels: Record<string, string> = {
            ifood: 'iFood',
            takeat: 'Takeat',
            '99food': '99Food',
            neemo: 'Neemo',
            keeta: 'Keeta',
            rappi: 'Rappi',
            uber_eats: 'Uber Eats',
        };

        return labels[providerValue] || providerValue;
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[550px]">
                <DialogHeader>
                    <DialogTitle>
                        Vincular Taxa de Pagamento Existente
                    </DialogTitle>
                    <DialogDescription>
                        Selecione uma taxa já cadastrada para o método de
                        pagamento <strong>{paymentMethodName}</strong>
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4">
                    {allFees.length === 0 ? (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
                            <p className="text-amber-900">
                                Nenhuma taxa de pagamento cadastrada para este
                                tenant.
                            </p>
                            <p className="mt-2 text-amber-700">
                                Crie uma nova taxa para vincular a este pedido.
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm">
                                <p className="font-medium text-blue-900">
                                    💡 Vínculo Manual
                                </p>
                                <p className="mt-1 text-xs text-blue-700">
                                    Você pode vincular qualquer taxa
                                    manualmente. As taxas recomendadas aparecem
                                    primeiro, mas você tem total liberdade de
                                    escolha.
                                </p>
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="fee_select">
                                    Selecionar Taxa ({allFees.length} disponível
                                    {allFees.length > 1 ? 'is' : ''})
                                </Label>
                                <Select
                                    value={selectedFeeId}
                                    onValueChange={setSelectedFeeId}
                                >
                                    <SelectTrigger id="fee_select">
                                        <SelectValue placeholder="Selecione uma taxa..." />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-[400px]">
                                        {recommendedFees.length > 0 && (
                                            <>
                                                <div className="bg-muted/50 px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                                                    ✓ Recomendadas
                                                </div>
                                                {recommendedFees.map((fee) => (
                                                    <SelectItem
                                                        key={fee.id}
                                                        value={fee.id.toString()}
                                                    >
                                                        <div className="flex items-center justify-between gap-4">
                                                            <span className="font-medium">
                                                                {fee.name}
                                                            </span>
                                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                                <span className="font-semibold text-green-600">
                                                                    {formatFeeValue(
                                                                        fee,
                                                                    )}
                                                                </span>
                                                                <span>•</span>
                                                                <span>
                                                                    {formatProvider(
                                                                        fee.provider,
                                                                    )}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </>
                                        )}
                                        {otherFees.length > 0 && (
                                            <>
                                                <div className="bg-muted/50 px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                                                    Outras Taxas
                                                </div>
                                                {otherFees.map((fee) => (
                                                    <SelectItem
                                                        key={fee.id}
                                                        value={fee.id.toString()}
                                                    >
                                                        <div className="flex items-center justify-between gap-4">
                                                            <span className="font-medium">
                                                                {fee.name}
                                                            </span>
                                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                                <span className="font-semibold text-amber-600">
                                                                    {formatFeeValue(
                                                                        fee,
                                                                    )}
                                                                </span>
                                                                <span>•</span>
                                                                <span>
                                                                    {formatProvider(
                                                                        fee.provider,
                                                                    )}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </>
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>

                            {selectedFeeId && (
                                <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                                    {(() => {
                                        const selectedFee = allFees.find(
                                            (f) =>
                                                f.id.toString() ===
                                                selectedFeeId,
                                        );
                                        if (!selectedFee) return null;

                                        const isRecommended =
                                            selectedFee.compatibility
                                                ?.is_compatible !== false;

                                        return (
                                            <>
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-semibold">
                                                            {selectedFee.name}
                                                        </p>
                                                        {isRecommended ? (
                                                            <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700">
                                                                ✓ Recomendada
                                                            </span>
                                                        ) : (
                                                            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">
                                                                ⚠ Verificar
                                                                compatibilidade
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p>
                                                        <strong>Valor:</strong>{' '}
                                                        {formatFeeValue(
                                                            selectedFee,
                                                        )}
                                                    </p>
                                                    <p>
                                                        <strong>
                                                            Provider:
                                                        </strong>{' '}
                                                        {formatProvider(
                                                            selectedFee.provider,
                                                        )}
                                                    </p>
                                                    {selectedFee.condition_values &&
                                                        selectedFee
                                                            .condition_values
                                                            .length > 0 && (
                                                            <p>
                                                                <strong>
                                                                    Métodos:
                                                                </strong>{' '}
                                                                {selectedFee.condition_values.join(
                                                                    ', ',
                                                                )}
                                                            </p>
                                                        )}
                                                </div>

                                                {selectedFee.compatibility
                                                    ?.reasons && (
                                                    <div className="mt-2 border-t pt-2">
                                                        <p className="mb-1 text-xs font-semibold">
                                                            Análise de
                                                            Compatibilidade:
                                                        </p>
                                                        <ul className="list-inside list-disc space-y-0.5 text-xs">
                                                            {selectedFee.compatibility.reasons.map(
                                                                (
                                                                    reason,
                                                                    idx,
                                                                ) => (
                                                                    <li
                                                                        key={
                                                                            idx
                                                                        }
                                                                    >
                                                                        {reason}
                                                                    </li>
                                                                ),
                                                            )}
                                                        </ul>
                                                    </div>
                                                )}
                                            </>
                                        );
                                    })()}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Opção de aplicar a todos os pedidos */}
                <div className="flex items-start space-x-3 rounded-md border p-4">
                    <Checkbox
                        id="apply-to-all"
                        checked={applyToAll}
                        onCheckedChange={(checked) =>
                            setApplyToAll(checked === true)
                        }
                        disabled={isLinking}
                    />
                    <div className="space-y-1 leading-none">
                        <label
                            htmlFor="apply-to-all"
                            className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                            Aplicar a todos os pedidos com este método de
                            pagamento
                        </label>
                        <p className="text-sm text-muted-foreground">
                            Vincula esta taxa automaticamente a todos os pedidos
                            que possuem o método{' '}
                            <strong>{paymentMethodName}</strong>
                        </p>
                    </div>
                </div>

                <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onCreateNew}
                        disabled={isLinking}
                        className="w-full sm:w-auto"
                    >
                        Criar Nova Taxa
                    </Button>
                    <div className="flex gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={isLinking}
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleLink}
                            disabled={!selectedFeeId || isLinking}
                        >
                            {isLinking ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Vinculando...
                                </>
                            ) : (
                                'Vincular Taxa'
                            )}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
