import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Combobox } from '@/components/ui/combobox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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
    const [selectedCategory, setSelectedCategory] = useState<string>('payment');
    const [applyToAll, setApplyToAll] = useState(true);
    const [isLinking, setIsLinking] = useState(false);

    const handleLink = async () => {
        // Se for categoria especial (sem taxa, cashback, subsídio), não precisa selecionar taxa
        const isSpecialCategory = selectedCategory !== 'payment';

        if (!isSpecialCategory && !selectedFeeId) {
            toast.error('Selecione uma taxa de pagamento');
            return;
        }

        setIsLinking(true);

        try {
            const response = await fetch(
                `/api/orders/${orderId}/link-payment-fee`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN':
                            document
                                .querySelector('meta[name="csrf-token"]')
                                ?.getAttribute('content') || '',
                    },
                    body: JSON.stringify({
                        payment_method: paymentMethod,
                        payment_method_name: paymentMethodName,
                        has_no_fee: selectedCategory === 'no_fee',
                        payment_category:
                            selectedCategory === 'no_fee'
                                ? 'payment'
                                : selectedCategory,
                        cost_commission_id: isSpecialCategory
                            ? null
                            : parseInt(selectedFeeId),
                        apply_to_all: applyToAll,
                    }),
                },
            );

            const data = await response.json();

            if (response.ok && data.success) {
                toast.success('Vínculo criado com sucesso!', {
                    description:
                        'Os pedidos estão sendo recalculados. Você receberá uma notificação quando terminar.',
                });
                setSelectedFeeId('');
                setSelectedCategory('payment');
                onOpenChange(false);
            } else {
                toast.error(data.message || 'Erro ao vincular taxa');
            }
        } catch (error) {
            console.error('Erro ao vincular taxa:', error);
            toast.error('Erro ao vincular taxa ao método de pagamento');
        } finally {
            setIsLinking(false);
        }
    };

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
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[550px]">
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
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm">
                        <p className="font-medium text-blue-900">
                            💡 Vínculo Manual
                        </p>
                        <p className="mt-1 text-xs text-blue-700">
                            Você pode vincular qualquer taxa manualmente. As
                            taxas recomendadas aparecem primeiro, mas você tem
                            total liberdade de escolha.
                        </p>
                    </div>

                    {/* Categoria do método de pagamento */}
                    <div className="grid gap-3">
                        <Label>Categoria do método</Label>
                        <RadioGroup
                            value={selectedCategory}
                            onValueChange={setSelectedCategory}
                            className="grid gap-2"
                        >
                            <div className="flex items-center space-x-2 rounded-lg border p-3 hover:bg-muted/50">
                                <RadioGroupItem value="payment" id="payment" />
                                <Label
                                    htmlFor="payment"
                                    className="flex flex-1 cursor-pointer flex-col"
                                >
                                    <span className="font-medium">
                                        Pagamento com Taxa
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        Método de pagamento normal que terá taxa
                                        aplicada
                                    </span>
                                </Label>
                            </div>

                            <div className="flex items-center space-x-2 rounded-lg border p-3 hover:bg-muted/50">
                                <RadioGroupItem value="subsidy" id="subsidy" />
                                <Label
                                    htmlFor="subsidy"
                                    className="flex flex-1 cursor-pointer flex-col"
                                >
                                    <span className="font-medium">
                                        Subsídio (Cupom)
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        Desconto do marketplace, soma ao valor
                                        recebido
                                    </span>
                                </Label>
                            </div>

                            <div className="flex items-center space-x-2 rounded-lg border p-3 hover:bg-muted/50">
                                <RadioGroupItem
                                    value="discount"
                                    id="discount"
                                />
                                <Label
                                    htmlFor="discount"
                                    className="flex flex-1 cursor-pointer flex-col"
                                >
                                    <span className="font-medium">
                                        Desconto
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        Cupom/desconto aplicado, subtrai do
                                        valor recebido
                                    </span>
                                </Label>
                            </div>

                            <div className="flex items-center space-x-2 rounded-lg border p-3 hover:bg-muted/50">
                                <RadioGroupItem value="no_fee" id="no_fee" />
                                <Label
                                    htmlFor="no_fee"
                                    className="flex flex-1 cursor-pointer flex-col"
                                >
                                    <span className="font-medium">
                                        Sem taxa de pagamento
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        Método que não cobra taxa (ex: dinheiro)
                                    </span>
                                </Label>
                            </div>
                        </RadioGroup>
                    </div>

                    {/* Só mostrar seleção de taxa se categoria for 'payment' */}
                    {selectedCategory === 'payment' && (
                        <div className="grid gap-2">
                            <Label htmlFor="fee_select">
                                Selecionar Taxa ({availableFees.length}{' '}
                                disponível
                                {availableFees.length > 1 ? 'is' : ''})
                            </Label>
                            <Combobox
                                value={selectedFeeId}
                                onChange={setSelectedFeeId}
                                options={availableFees.map((fee) => ({
                                    value: fee.id.toString(),
                                    label: `${fee.name} - ${formatFeeValue(fee)} (${formatProvider(fee.provider)})`,
                                }))}
                                placeholder="Buscar taxa..."
                                emptyMessage="Nenhuma taxa encontrada"
                            />
                        </div>
                    )}

                    {/* Checkbox para aplicar a todos - sempre visível */}
                    <div className="flex items-start space-x-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
                        <Checkbox
                            id="apply_to_all"
                            checked={applyToAll}
                            onCheckedChange={(checked) =>
                                setApplyToAll(checked === true)
                            }
                        />
                        <div className="grid gap-1.5 leading-none">
                            <Label
                                htmlFor="apply_to_all"
                                className="cursor-pointer font-medium text-blue-900"
                            >
                                Aplicar a todos os pedidos com este método de
                                pagamento
                            </Label>
                            <p className="text-xs text-blue-700">
                                {selectedCategory === 'payment'
                                    ? `Vincula esta taxa automaticamente a todos os pedidos que possuem o método ${paymentMethodName}`
                                    : 'Classifica todos os pedidos com este método automaticamente'}
                            </p>
                        </div>
                    </div>
                </div>

                <DialogFooter className="gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onCreateNew}
                        disabled={isLinking}
                    >
                        Criar Nova Taxa
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isLinking}
                    >
                        Cancelar
                    </Button>
                    <Button
                        type="button"
                        onClick={handleLink}
                        disabled={
                            isLinking ||
                            (selectedCategory === 'payment' && !selectedFeeId)
                        }
                    >
                        {isLinking && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        {selectedCategory === 'payment'
                            ? 'Vincular Taxa'
                            : 'Classificar Método'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
