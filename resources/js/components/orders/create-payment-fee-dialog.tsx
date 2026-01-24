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
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface CreatePaymentFeeDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
}

export function CreatePaymentFeeDialog({
    open,
    onOpenChange,
    onSuccess,
}: CreatePaymentFeeDialogProps) {
    const [formData, setFormData] = useState({
        name: '',
        type: 'percentage' as 'percentage' | 'fixed',
        value: '',
    });
    const [processing, setProcessing] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        if (open) {
            setFormData({
                name: '',
                type: 'percentage',
                value: '',
            });
            setErrors({});
        }
    }, [open]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setProcessing(true);
        setErrors({});

        try {
            const response = await fetch('/api/cost-commissions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN':
                        document.querySelector<HTMLMetaElement>(
                            'meta[name="csrf-token"]',
                        )?.content || '',
                    Accept: 'application/json',
                },
                body: JSON.stringify({
                    name: formData.name,
                    category: 'payment_method',
                    type: formData.type,
                    value: formData.value,
                    provider: '',
                    applies_to: 'payment_method',
                    active: true,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                if (data.errors) {
                    setErrors(data.errors);
                    const errorMessages = Object.values(data.errors)
                        .flat()
                        .join(', ');
                    toast.error(errorMessages);
                } else {
                    toast.error(data.message || 'Erro ao criar taxa');
                }
                setProcessing(false);
                return;
            }

            toast.success('Taxa criada com sucesso!');

            onOpenChange(false);

            // Chamar callback de sucesso
            if (onSuccess) {
                onSuccess();
            }
        } catch (error) {
            console.error('Erro ao criar taxa:', error);
            toast.error('Erro ao criar taxa');
        } finally {
            setProcessing(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Criar Nova Taxa de Pagamento</DialogTitle>
                    <DialogDescription>
                        Adicione uma nova taxa de meio de pagamento para ser
                        aplicada nas vendas.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Nome */}
                    <div className="space-y-2">
                        <Label htmlFor="name">
                            Nome <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="name"
                            value={formData.name}
                            onChange={(e) =>
                                setFormData((prev) => ({
                                    ...prev,
                                    name: e.target.value,
                                }))
                            }
                            placeholder="Ex: Taxa Pix, Taxa Crédito"
                            required
                        />
                        {errors.name && (
                            <p className="text-sm text-destructive">
                                {errors.name}
                            </p>
                        )}
                    </div>

                    {/* Tipo e Valor */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="type">
                                Tipo <span className="text-destructive">*</span>
                            </Label>
                            <Select
                                value={formData.type}
                                onValueChange={(value) =>
                                    setFormData((prev) => ({
                                        ...prev,
                                        type: value as typeof formData.type,
                                    }))
                                }
                            >
                                <SelectTrigger id="type">
                                    <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="percentage">
                                        Percentual %
                                    </SelectItem>
                                    <SelectItem value="fixed">
                                        Fixo R$
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                            {errors.type && (
                                <p className="text-sm text-destructive">
                                    {errors.type}
                                </p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="value">
                                Valor{' '}
                                <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="value"
                                type="number"
                                step="0.01"
                                min="0"
                                value={formData.value}
                                onChange={(e) =>
                                    setFormData((prev) => ({
                                        ...prev,
                                        value: e.target.value,
                                    }))
                                }
                                placeholder={
                                    formData.type === 'percentage'
                                        ? '3.50'
                                        : '2.00'
                                }
                                required
                            />
                            {errors.value && (
                                <p className="text-sm text-destructive">
                                    {errors.value}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Info sobre marketplace */}
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                        <p className="text-sm text-blue-900">
                            💡 Esta taxa será aplicável a{' '}
                            <strong>todos os marketplaces</strong>
                        </p>
                        <p className="mt-1 text-xs text-blue-700">
                            Para vincular a taxa ao método de pagamento, use a
                            Triagem de Pagamentos após criar.
                        </p>
                    </div>
                </form>

                <DialogFooter className="gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={processing}
                    >
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        onClick={handleSubmit}
                        disabled={processing}
                    >
                        {processing && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Criar Taxa
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
