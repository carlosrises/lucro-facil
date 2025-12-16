import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
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
import * as React from 'react';
import { CostCommission } from './columns';

type Provider = {
    value: string;
    label: string;
};

type PaymentMethod = {
    value: string;
    label: string;
};

type PageProps = {
    providers: Provider[];
    integratedProviders: string[];
    paymentMethods: {
        [key: string]: PaymentMethod[];
    };
};

type CostCommissionFormDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    item?: CostCommission | null;
};

export function CostCommissionFormDialog({
    open,
    onOpenChange,
    item,
}: CostCommissionFormDialogProps) {
    const isEditing = !!item;
    const { providers, integratedProviders, paymentMethods } =
        usePage<PageProps>().props;

    // Filtra apenas os providers integrados
    const availableProviders = providers.filter((provider) =>
        integratedProviders.includes(provider.value),
    );

    const { data, setData, post, put, processing, errors, reset } = useForm({
        name: item?.name || '',
        category: item?.category || 'cost',
        provider: item?.provider || '',
        type: item?.type || 'percentage',
        value: item?.value || '',
        applies_to: item?.applies_to || 'all_orders',
        payment_type: item?.payment_type || 'all',
        condition_value: item?.condition_value || '',
        condition_values: item?.condition_values || [],
        reduces_revenue_base: item?.reduces_revenue_base || false,
        active: item?.active ?? true,
        apply_to_existing_orders: false,
        apply_retroactively: false,
    });

    React.useEffect(() => {
        if (item) {
            setData({
                name: item.name,
                category: item.category || 'cost',
                provider: item.provider || '',
                type: item.type,
                value: item.value,
                applies_to: item.applies_to,
                payment_type: item.payment_type || 'all',
                condition_value: item.condition_value || '',
                condition_values: item.condition_values || [],
                reduces_revenue_base: item.reduces_revenue_base,
                active: item.active,
            });
        } else {
            reset();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [item]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        console.log('Form submit triggered');
        console.log('Data before submit:', data);
        console.log('Processing state:', processing);
        console.log('Is editing:', isEditing);
        console.log('Item:', item);

        if (isEditing && item) {
            console.log('Attempting UPDATE...');
            put(`/cost-commissions/${item.id}`, {
                onSuccess: () => {
                    console.log('Update successful');
                    onOpenChange(false);
                    reset();
                },
                onError: (errors) => {
                    console.error('Update errors:', errors);
                },
            });
        } else {
            console.log('Attempting CREATE...');
            post('/cost-commissions', {
                onSuccess: () => {
                    console.log('Create successful');
                    onOpenChange(false);
                    reset();
                },
                onError: (errors) => {
                    console.error('Create errors:', errors);
                },
            });
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="max-h-[90vh] max-w-lg overflow-y-auto"
                onOpenAutoFocus={(e) => e.preventDefault()}
            >
                <DialogHeader>
                    <DialogTitle>
                        {isEditing
                            ? 'Editar Custo/Comissão'
                            : 'Novo Custo/Comissão'}
                    </DialogTitle>
                    <DialogDescription>
                        {isEditing
                            ? 'Edite as informações do custo ou comissão.'
                            : 'Adicione um novo custo ou comissão para ser aplicado nas vendas.'}
                    </DialogDescription>
                </DialogHeader>

                <form
                    onSubmit={handleSubmit}
                    className="space-y-4"
                    id="cost-commission-form"
                >
                    {/* Nome */}
                    <div className="space-y-2">
                        <Label htmlFor="name">
                            Nome <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="name"
                            value={data.name}
                            onChange={(e) => setData('name', e.target.value)}
                            placeholder="Ex: Taxa de entrega, Comissão iFood"
                            required
                        />
                        {errors.name && (
                            <p className="text-sm text-destructive">
                                {errors.name}
                            </p>
                        )}
                    </div>

                    {/* Categoria */}
                    <div className="space-y-2">
                        <Label htmlFor="category">
                            Categoria{' '}
                            <span className="text-destructive">*</span>
                        </Label>
                        <Select
                            value={data.category}
                            onValueChange={(value) =>
                                setData(
                                    'category',
                                    value as 'cost' | 'commission',
                                )
                            }
                        >
                            <SelectTrigger id="category">
                                <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="cost">Custo</SelectItem>
                                <SelectItem value="commission">
                                    Comissão
                                </SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                            Custos são despesas operacionais, comissões são
                            repasses
                        </p>
                        {errors.category && (
                            <p className="text-sm text-destructive">
                                {errors.category}
                            </p>
                        )}
                    </div>

                    {/* Marketplace/Provider */}
                    <div className="space-y-2">
                        <Label htmlFor="provider">Marketplace</Label>
                        <Combobox
                            options={[
                                { value: '', label: 'Todos os marketplaces' },
                                ...availableProviders.map((provider) => ({
                                    value: provider.value,
                                    label: provider.label,
                                })),
                            ]}
                            value={data.provider || ''}
                            onChange={(value) => setData('provider', value)}
                            placeholder="Selecione um marketplace..."
                            searchPlaceholder="Buscar marketplace..."
                            emptyMessage="Nenhum marketplace integrado"
                        />
                        <p className="text-xs text-muted-foreground">
                            Apenas marketplaces integrados estão disponíveis
                        </p>
                        {errors.provider && (
                            <p className="text-sm text-destructive">
                                {errors.provider}
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
                                value={data.type}
                                onValueChange={(value) =>
                                    setData(
                                        'type',
                                        value as 'percentage' | 'fixed',
                                    )
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
                                value={data.value}
                                onChange={(e) =>
                                    setData('value', e.target.value)
                                }
                                placeholder={
                                    data.type === 'percentage'
                                        ? '15.00'
                                        : '5.00'
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

                    {/* Aplica-se a */}
                    <div className="space-y-2">
                        <Label htmlFor="applies_to">
                            Aplica-se a{' '}
                            <span className="text-destructive">*</span>
                        </Label>
                        <Select
                            value={data.applies_to}
                            onValueChange={(value) =>
                                setData(
                                    'applies_to',
                                    value as typeof data.applies_to,
                                )
                            }
                        >
                            <SelectTrigger id="applies_to">
                                <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all_orders">
                                    Todos os pedidos
                                </SelectItem>
                                <SelectItem value="delivery_only">
                                    Apenas Delivery
                                </SelectItem>
                                <SelectItem value="pickup_only">
                                    Apenas Retirada
                                </SelectItem>
                                <SelectItem value="payment_method">
                                    Método de pagamento
                                </SelectItem>
                                <SelectItem value="custom">
                                    Personalizado
                                </SelectItem>
                            </SelectContent>
                        </Select>
                        {errors.applies_to && (
                            <p className="text-sm text-destructive">
                                {errors.applies_to}
                            </p>
                        )}
                    </div>

                    {/* Condição (condicional) */}
                    {data.applies_to === 'payment_method' && (
                        <>
                            {/* Tipo de Pagamento */}
                            <div className="space-y-2">
                                <Label htmlFor="payment_type">
                                    Tipo de Pagamento{' '}
                                    <span className="text-destructive">*</span>
                                </Label>
                                <Select
                                    value={data.payment_type || 'all'}
                                    onValueChange={(value) =>
                                        setData(
                                            'payment_type',
                                            value as
                                                | 'all'
                                                | 'online'
                                                | 'offline',
                                        )
                                    }
                                >
                                    <SelectTrigger id="payment_type">
                                        <SelectValue placeholder="Selecione" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">
                                            Todos
                                        </SelectItem>
                                        <SelectItem value="online">
                                            Online (Pago via Marketplace)
                                        </SelectItem>
                                        <SelectItem value="offline">
                                            Offline (Pago ao Estabelecimento)
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">
                                    Online = pago via marketplace | Offline =
                                    pago direto ao estabelecimento
                                </p>
                                {errors.payment_type && (
                                    <p className="text-sm text-destructive">
                                        {errors.payment_type}
                                    </p>
                                )}
                            </div>

                            {/* Métodos de Pagamento (seleção múltipla) */}
                            <div className="space-y-2">
                                <Label htmlFor="condition_values">
                                    Métodos de Pagamento{' '}
                                    <span className="text-destructive">*</span>
                                </Label>
                                {data.provider &&
                                paymentMethods[data.provider] ? (
                                    <div className="space-y-2 rounded-md border p-3">
                                        {paymentMethods[data.provider].map(
                                            (method) => (
                                                <div
                                                    key={method.value}
                                                    className="flex items-center space-x-2"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        id={`method-${method.value}`}
                                                        checked={(
                                                            data.condition_values ||
                                                            []
                                                        ).includes(
                                                            method.value,
                                                        )}
                                                        onChange={(e) => {
                                                            const currentValues =
                                                                data.condition_values ||
                                                                [];
                                                            if (
                                                                e.target.checked
                                                            ) {
                                                                setData(
                                                                    'condition_values',
                                                                    [
                                                                        ...currentValues,
                                                                        method.value,
                                                                    ],
                                                                );
                                                            } else {
                                                                setData(
                                                                    'condition_values',
                                                                    currentValues.filter(
                                                                        (
                                                                            v: string,
                                                                        ) =>
                                                                            v !==
                                                                            method.value,
                                                                    ),
                                                                );
                                                            }
                                                        }}
                                                        className="h-4 w-4"
                                                    />
                                                    <Label
                                                        htmlFor={`method-${method.value}`}
                                                        className="cursor-pointer text-sm font-normal"
                                                    >
                                                        {method.label}
                                                    </Label>
                                                </div>
                                            ),
                                        )}
                                        {(data.condition_values || []).length >
                                            0 && (
                                            <p className="mt-2 text-xs text-muted-foreground">
                                                {
                                                    (
                                                        data.condition_values ||
                                                        []
                                                    ).length
                                                }{' '}
                                                método(s) selecionado(s)
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <div className="rounded-md border border-dashed p-4 text-center">
                                        <p className="text-sm text-muted-foreground">
                                            {!data.provider
                                                ? 'Selecione um marketplace primeiro'
                                                : 'Nenhum método de pagamento disponível'}
                                        </p>
                                    </div>
                                )}
                                {errors.condition_values && (
                                    <p className="text-sm text-destructive">
                                        {errors.condition_values}
                                    </p>
                                )}
                            </div>
                        </>
                    )}

                    {data.applies_to === 'custom' && (
                        <div className="space-y-2">
                            <Label htmlFor="condition_value">
                                Condição Personalizada
                            </Label>
                            <Input
                                id="condition_value"
                                value={data.condition_value}
                                onChange={(e) =>
                                    setData('condition_value', e.target.value)
                                }
                                placeholder="Digite a condição"
                            />
                            {errors.condition_value && (
                                <p className="text-sm text-destructive">
                                    {errors.condition_value}
                                </p>
                            )}
                        </div>
                    )}

                    {data.applies_to === 'custom' && (
                        <div className="space-y-2">
                            <Label htmlFor="condition_value">
                                Condição Personalizada
                            </Label>
                            <Input
                                id="condition_value"
                                value={data.condition_value}
                                onChange={(e) =>
                                    setData('condition_value', e.target.value)
                                }
                                placeholder="Descreva a condição"
                            />
                            {errors.condition_value && (
                                <p className="text-sm text-destructive">
                                    {errors.condition_value}
                                </p>
                            )}
                        </div>
                    )}

                    {/* Switches */}
                    <div className="space-y-3 rounded-md border p-4">
                        <h4 className="text-sm font-medium">
                            Configurações de Aplicação
                        </h4>

                        <div className="flex items-center justify-between space-x-2">
                            <Label
                                htmlFor="reduces_revenue_base"
                                className="text-sm font-normal"
                            >
                                Reduz base de receita
                            </Label>
                            <Switch
                                id="reduces_revenue_base"
                                checked={data.reduces_revenue_base}
                                onCheckedChange={(checked) =>
                                    setData('reduces_revenue_base', checked)
                                }
                            />
                        </div>

                        <div className="flex items-center justify-between space-x-2">
                            <Label
                                htmlFor="active"
                                className="text-sm font-normal"
                            >
                                Ativo
                            </Label>
                            <Switch
                                id="active"
                                checked={data.active}
                                onCheckedChange={(checked) =>
                                    setData('active', checked)
                                }
                            />
                        </div>

                        {!isEditing && (
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
                                        setData(
                                            'apply_to_existing_orders',
                                            checked,
                                        )
                                    }
                                />
                            </div>
                        )}

                        {isEditing && (
                            <div className="flex items-center justify-between space-x-2 rounded-md border border-amber-200 bg-amber-50 p-3">
                                <Label
                                    htmlFor="apply_retroactively"
                                    className="text-sm font-normal"
                                >
                                    Aplicar alterações aos pedidos existentes
                                </Label>
                                <Switch
                                    id="apply_retroactively"
                                    checked={data.apply_retroactively}
                                    onCheckedChange={(checked) =>
                                        setData('apply_retroactively', checked)
                                    }
                                />
                            </div>
                        )}
                    </div>
                </form>

                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        form="cost-commission-form"
                        disabled={processing}
                    >
                        {processing
                            ? 'Salvando...'
                            : isEditing
                              ? 'Atualizar'
                              : 'Criar'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
