import { startRecalculateMonitoring } from '@/components/global-recalculate-progress';
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
import { Switch } from '@/components/ui/switch';
import { useForm, usePage } from '@inertiajs/react';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface CreatePaymentFeeDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    orderId: number;
    paymentMethod: string;
    paymentMethodName: string;
    provider: string;
    origin?: string;
}

export function CreatePaymentFeeDialog({
    open,
    onOpenChange,
    orderId,
    paymentMethod,
    paymentMethodName,
    provider,
    origin,
}: CreatePaymentFeeDialogProps) {
    const [type, setType] = useState<'percentage' | 'fixed'>('percentage');

    // Detectar tipo de pagamento pelo nome
    const detectPaymentMethod = (name: string, method: string): string => {
        const lowerName = name.toLowerCase();

        // Se já tem método específico, usar ele
        if (method && method !== 'others') {
            return method;
        }

        // Detectar pelo nome
        if (lowerName.includes('pix')) return 'PIX';
        if (lowerName.includes('débito') || lowerName.includes('debit'))
            return 'DEBIT_CARD';
        if (lowerName.includes('crédito') || lowerName.includes('credit'))
            return 'CREDIT_CARD';
        if (
            lowerName.includes('dinheiro') ||
            lowerName.includes('cash') ||
            lowerName.includes('money')
        )
            return 'MONEY';
        if (lowerName.includes('vale') || lowerName.includes('voucher'))
            return 'VOUCHER';

        return method; // Fallback para o método original
    };

    // Detectar se é online ou offline pelo método
    const detectPaymentType = (name: string): 'online' | 'offline' => {
        const lowerName = name.toLowerCase();

        // Online: geralmente tem "online" no nome ou é cartão via marketplace
        if (lowerName.includes('online')) return 'online';
        if (lowerName.includes('marketplace')) return 'online';

        // Offline: PIX, dinheiro, cartão na maquininha
        return 'offline';
    };

    const detectedMethod = detectPaymentMethod(
        paymentMethodName,
        paymentMethod,
    );
    const detectedPaymentType = detectPaymentType(paymentMethodName);

    // Para Takeat, salvar apenas "takeat" no provider
    // O origin já está no próprio pedido
    const getProvider = () => {
        // Para providers não-Takeat (ifood direto, rappi, etc), manter o provider original
        if (provider !== 'takeat') {
            return provider;
        }

        // Para Takeat, sempre usar "takeat" independente do origin
        return 'takeat';
    };

    const { data, setData, post, processing, reset } = useForm({
        name: `Taxa ${paymentMethodName}`,
        provider: getProvider(),
        category: 'payment_method',
        type: 'percentage',
        value: '',
        applies_to: 'payment_method',
        // Online: condition_values vazio (aplica a todos), Offline: método específico
        condition_values:
            detectedPaymentType === 'online' ? [] : [detectedMethod],
        payment_type: detectedPaymentType, // Adicionar payment_type
        active: true,
        apply_to_existing_orders: true, // Por padrão, aplicar aos pedidos existentes
    });

    // Monitorar recalculate_cache_key retornado do backend
    const { props } = usePage<{ recalculate_cache_key?: string }>();
    useEffect(() => {
        if (props.recalculate_cache_key) {
            startRecalculateMonitoring(props.recalculate_cache_key);
        }
    }, [props.recalculate_cache_key]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        post('/cost-commissions', {
            preserveScroll: true,
            onSuccess: (page) => {
                toast.success(
                    'Taxa de pagamento criada com sucesso! Recalculando custos dos pedidos...',
                );

                // Extrair o cache key do flash message retornado
                const cacheKey = page.props.recalculate_cache_key as
                    | string
                    | undefined;
                if (cacheKey) {
                    startRecalculateMonitoring(cacheKey);
                }

                reset();
                onOpenChange(false);
            },
            onError: (errors) => {
                const errorMessage = Object.values(errors).flat().join(', ');
                toast.error(`Erro ao criar taxa: ${errorMessage}`);
            },
        });
    };

    const handleTypeChange = (value: string) => {
        const newType = value as 'percentage' | 'fixed';
        setType(newType);
        setData('type', newType);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Criar Taxa de Pagamento</DialogTitle>
                        <DialogDescription>
                            Configure a taxa para o método de pagamento{' '}
                            <strong>{paymentMethodName}</strong>
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name">Nome da taxa</Label>
                            <Input
                                id="name"
                                value={data.name}
                                onChange={(e) =>
                                    setData('name', e.target.value)
                                }
                                placeholder="Ex: Taxa PIX, Taxa Cartão Crédito"
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="type">Tipo</Label>
                                <Select
                                    value={data.type}
                                    onValueChange={handleTypeChange}
                                >
                                    <SelectTrigger id="type">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="percentage">
                                            Percentual (%)
                                        </SelectItem>
                                        <SelectItem value="fixed">
                                            Valor Fixo (R$)
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="value">
                                    {type === 'percentage'
                                        ? 'Percentual'
                                        : 'Valor'}
                                </Label>
                                <Input
                                    id="value"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={data.value}
                                    onChange={(e) =>
                                        setData('value', e.target.value)
                                    }
                                    placeholder={
                                        type === 'percentage' ? '2.5' : '1.50'
                                    }
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="payment_type">
                                Tipo de Pagamento
                            </Label>
                            <Select
                                value={data.payment_type}
                                onValueChange={(value) => {
                                    const newType = value as
                                        | 'online'
                                        | 'offline';
                                    setData('payment_type', newType);
                                    // Se mudar para online, limpar condition_values
                                    if (newType === 'online') {
                                        setData('condition_values', []);
                                    } else if (
                                        data.condition_values.length === 0
                                    ) {
                                        // Se mudar para offline e não tem método, adicionar o detectado
                                        setData('condition_values', [
                                            detectedMethod,
                                        ]);
                                    }
                                }}
                            >
                                <SelectTrigger id="payment_type">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="online">
                                        Online (Pago via Marketplace)
                                    </SelectItem>
                                    <SelectItem value="offline">
                                        Offline (Pago ao Estabelecimento)
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                Online = taxa do marketplace (todos os métodos)
                                | Offline = taxa específica por método
                            </p>
                        </div>

                        {/* Método de Pagamento - apenas para offline */}
                        {data.payment_type === 'offline' && (
                            <div className="grid gap-2">
                                <Label htmlFor="payment_method">
                                    Método de Pagamento
                                </Label>
                                <Select
                                    value={
                                        data.condition_values[0] ||
                                        detectedMethod
                                    }
                                    onValueChange={(value) =>
                                        setData('condition_values', [value])
                                    }
                                >
                                    <SelectTrigger id="payment_method">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="PIX">PIX</SelectItem>
                                        <SelectItem value="CREDIT_CARD">
                                            Cartão de Crédito
                                        </SelectItem>
                                        <SelectItem value="DEBIT_CARD">
                                            Cartão de Débito
                                        </SelectItem>
                                        <SelectItem value="MONEY">
                                            Dinheiro
                                        </SelectItem>
                                        <SelectItem value="VOUCHER">
                                            Vale/Voucher
                                        </SelectItem>
                                        <SelectItem value="others">
                                            Outros
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">
                                    Método detectado automaticamente. Ajuste se
                                    necessário.
                                </p>
                            </div>
                        )}

                        <div className="rounded-lg bg-muted p-3 text-sm">
                            <p className="text-muted-foreground">
                                <strong>Provider:</strong>{' '}
                                {(() => {
                                    const integratedMarketplaces = [
                                        'ifood',
                                        '99food',
                                        'neemo',
                                        'keeta',
                                    ];
                                    const providerLabels: Record<
                                        string,
                                        string
                                    > = {
                                        ifood: 'iFood',
                                        '99food': '99Food',
                                        neemo: 'Neemo',
                                        keeta: 'Keeta',
                                    };

                                    // Se for takeat com origin de marketplace integrado
                                    if (
                                        data.provider === 'takeat' &&
                                        origin &&
                                        integratedMarketplaces.includes(origin)
                                    ) {
                                        return `${providerLabels[origin] || origin} (Takeat)`;
                                    }

                                    // Para outros casos (balcony, totem, pdv, etc): apenas "Takeat"
                                    if (data.provider === 'takeat') {
                                        return 'Takeat';
                                    }

                                    return data.provider;
                                })()}
                            </p>
                        </div>

                        <div className="flex items-center justify-between space-x-2 rounded-md border border-amber-200 bg-amber-50 p-3">
                            <Label
                                htmlFor="apply_to_existing_orders"
                                className="text-sm font-normal"
                            >
                                Aplicar aos pedidos já existentes
                            </Label>
                            <Switch
                                id="apply_to_existing_orders"
                                checked={data.apply_to_existing_orders}
                                onCheckedChange={(checked) =>
                                    setData('apply_to_existing_orders', checked)
                                }
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={processing}
                        >
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={processing}>
                            {processing ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Criando...
                                </>
                            ) : (
                                'Criar e Aplicar'
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
