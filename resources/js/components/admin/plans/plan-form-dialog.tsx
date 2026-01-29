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
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from '@inertiajs/react';
import { Loader2, Plus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plan } from './columns';

interface PlanFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    plan: Plan | null;
}

interface PlanFormData {
    code: string;
    name: string;
    description: string;
    price_month: string;
    price_year: string;
    features: string[];
    active: boolean;
    is_visible: boolean;
    is_contact_plan: boolean;
    contact_url: string;
}

export function PlanFormDialog({
    open,
    onOpenChange,
    plan,
}: PlanFormDialogProps) {
    const [featureInput, setFeatureInput] = useState('');

    const { data, setData, post, patch, processing, errors, reset } =
        useForm<PlanFormData>({
            code: '',
            name: '',
            description: '',
            price_month: '',
            price_year: '',
            features: [],
            active: true,
            is_visible: true,
            is_contact_plan: false,
            contact_url: '',
        });

    useEffect(() => {
        if (plan && open) {
            setData({
                code: plan.code,
                name: plan.name,
                description: plan.description || '',
                price_month:
                    plan.prices
                        ?.find(
                            (price) =>
                                price.interval === 'month' ||
                                price.key === 'monthly',
                        )
                        ?.amount?.toString() || '',
                price_year:
                    plan.prices
                        ?.find(
                            (price) =>
                                price.interval === 'year' ||
                                price.key === 'annual',
                        )
                        ?.amount?.toString() || '',
                features: plan.features || [],
                active: plan.active,
                is_visible: plan.is_visible ?? true,
                is_contact_plan: plan.is_contact_plan ?? false,
                contact_url: plan.contact_url || '',
            });
        } else if (!open) {
            reset();
            setFeatureInput('');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [plan, open]);

    const handleAddFeature = () => {
        if (featureInput.trim()) {
            setData('features', [...data.features, featureInput.trim()]);
            setFeatureInput('');
        }
    };

    const handleRemoveFeature = (index: number) => {
        setData(
            'features',
            data.features.filter((_, i) => i !== index),
        );
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddFeature();
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Validação customizada: contact_url é obrigatório se is_contact_plan=true
        if (data.is_contact_plan && !data.contact_url.trim()) {
            toast.error(
                'URL de contato é obrigatória para planos sob consulta.',
            );
            return;
        }

        if (!data.is_contact_plan) {
            const monthly = Number(data.price_month || 0);
            const annual = Number(data.price_year || 0);

            if (monthly <= 0 && annual <= 0) {
                toast.error('Informe pelo menos um preço mensal ou anual.');
                return;
            }
        }

        const normalizedPrices = data.is_contact_plan
            ? []
            : [
                  data.price_month
                      ? {
                            key: 'monthly',
                            label: 'Mensal',
                            amount: Number(data.price_month),
                            interval: 'month',
                            period_label: 'por mês',
                            is_annual: false,
                        }
                      : null,
                  data.price_year
                      ? {
                            key: 'annual',
                            label: 'Anual',
                            amount: Number(data.price_year),
                            interval: 'year',
                            period_label: 'por ano',
                            is_annual: true,
                        }
                      : null,
              ].filter(Boolean);

        const { price_month, price_year, ...rest } = data;

        const formData = {
            ...rest,
            prices: normalizedPrices,
        };

        if (plan) {
            // Editar plano existente
            patch(`/admin/plans/${plan.id}`, {
                data: formData,
                preserveScroll: true,
                onSuccess: () => {
                    onOpenChange(false);
                    reset();
                    toast.success('Plano atualizado com sucesso!');
                },
                onError: (errors) => {
                    console.log('Validation errors:', errors);
                    if (errors.error) {
                        toast.error(errors.error as string);
                    } else {
                        toast.error('Erro ao atualizar plano.');
                    }
                },
            });
        } else {
            // Criar novo plano
            post('/admin/plans', {
                data: formData,
                preserveScroll: true,
                onSuccess: () => {
                    onOpenChange(false);
                    reset();
                    toast.success('Plano criado com sucesso!');
                },
                onError: (errors) => {
                    console.log('Validation errors:', errors);
                    if (errors.error) {
                        toast.error(errors.error as string);
                    } else {
                        toast.error('Erro ao criar plano.');
                    }
                },
            });
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>
                            {plan ? 'Editar Plano' : 'Novo Plano'}
                        </DialogTitle>
                        <DialogDescription>
                            {plan
                                ? 'Atualize as informações do plano. As alterações serão sincronizadas com o Stripe.'
                                : 'Preencha os dados para criar um novo plano. Um produto e preço serão criados automaticamente no Stripe.'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="code">Código</Label>
                                <Input
                                    id="code"
                                    value={data.code}
                                    onChange={(e) =>
                                        setData('code', e.target.value)
                                    }
                                    placeholder="BASIC, PRO, ENTERPRISE"
                                    required
                                />
                                {errors.code && (
                                    <p className="text-sm text-red-500">
                                        {errors.code}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="name">Nome do Plano</Label>
                            <Input
                                id="name"
                                value={data.name}
                                onChange={(e) =>
                                    setData('name', e.target.value)
                                }
                                placeholder="Plano Básico"
                                required
                            />
                            {errors.name && (
                                <p className="text-sm text-red-500">
                                    {errors.name}
                                </p>
                            )}
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="description">Descrição</Label>
                            <Textarea
                                id="description"
                                value={data.description}
                                onChange={(e) =>
                                    setData('description', e.target.value)
                                }
                                placeholder="Ideal para pequenos negócios..."
                                rows={3}
                            />
                            {errors.description && (
                                <p className="text-sm text-red-500">
                                    {errors.description}
                                </p>
                            )}
                        </div>

                        <div className="grid gap-2">
                            <Label>Preços do Plano</Label>
                            <p className="text-xs text-muted-foreground">
                                Configure apenas preço mensal e anual.
                            </p>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="price_month">
                                        Mensal (R$)
                                    </Label>
                                    <Input
                                        id="price_month"
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={data.price_month}
                                        onChange={(e) =>
                                            setData(
                                                'price_month',
                                                e.target.value,
                                            )
                                        }
                                        placeholder="99.90"
                                        disabled={data.is_contact_plan}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="price_year">
                                        Anual (R$)
                                    </Label>
                                    <Input
                                        id="price_year"
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={data.price_year}
                                        onChange={(e) =>
                                            setData(
                                                'price_year',
                                                e.target.value,
                                            )
                                        }
                                        placeholder="999.90"
                                        disabled={data.is_contact_plan}
                                    />
                                </div>
                            </div>

                            {errors.prices && (
                                <p className="text-sm text-red-500">
                                    {errors.prices}
                                </p>
                            )}
                        </div>

                        <div className="grid gap-2">
                            <Label>Recursos</Label>
                            <div className="flex gap-2">
                                <Input
                                    value={featureInput}
                                    onChange={(e) =>
                                        setFeatureInput(e.target.value)
                                    }
                                    onKeyPress={handleKeyPress}
                                    placeholder="Digite um recurso e pressione Enter"
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    onClick={handleAddFeature}
                                >
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </div>

                            {data.features.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {data.features.map((feature, index) => (
                                        <div
                                            key={index}
                                            className="flex items-center gap-1 rounded-md bg-secondary px-3 py-1 text-sm"
                                        >
                                            <span>{feature}</span>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    handleRemoveFeature(index)
                                                }
                                                className="ml-1 text-muted-foreground hover:text-foreground"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                                <Label htmlFor="active">Plano Ativo</Label>
                                <p className="text-sm text-muted-foreground">
                                    Desabilite para ocultar o plano de novos
                                    clientes
                                </p>
                            </div>
                            <Switch
                                id="active"
                                checked={data.active}
                                onCheckedChange={(checked) =>
                                    setData('active', checked)
                                }
                            />
                        </div>

                        <div className="flex items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                                <Label htmlFor="is_visible">
                                    Visível na Listagem
                                </Label>
                                <p className="text-sm text-muted-foreground">
                                    Controla se o plano aparece na listagem
                                    pública
                                </p>
                            </div>
                            <Switch
                                id="is_visible"
                                checked={data.is_visible}
                                onCheckedChange={(checked) =>
                                    setData('is_visible', checked)
                                }
                            />
                        </div>

                        <div className="flex items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                                <Label htmlFor="is_contact_plan">
                                    Plano Sob Consulta
                                </Label>
                                <p className="text-sm text-muted-foreground">
                                    Planos sob consulta não são sincronizados
                                    com o Stripe
                                </p>
                            </div>
                            <Switch
                                id="is_contact_plan"
                                checked={data.is_contact_plan}
                                onCheckedChange={(checked) => {
                                    setData('is_contact_plan', checked);
                                    if (checked) {
                                        setData('price_month', '');
                                        setData('price_year', '');
                                    }
                                }}
                            />
                        </div>

                        {data.is_contact_plan && (
                            <div className="grid gap-2">
                                <Label htmlFor="contact_url">
                                    URL de Contato *
                                </Label>
                                <Input
                                    id="contact_url"
                                    type="url"
                                    value={data.contact_url}
                                    onChange={(e) =>
                                        setData('contact_url', e.target.value)
                                    }
                                    placeholder="https://wa.me/5511999999999"
                                    required={data.is_contact_plan}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Link do WhatsApp ou formulário de contato
                                    para planos personalizados
                                </p>
                                {errors.contact_url && (
                                    <p className="text-sm text-red-500">
                                        {errors.contact_url}
                                    </p>
                                )}
                            </div>
                        )}
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
                                    Salvando...
                                </>
                            ) : plan ? (
                                'Atualizar'
                            ) : (
                                'Criar Plano'
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
