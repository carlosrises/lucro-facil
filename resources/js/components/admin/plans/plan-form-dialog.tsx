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

export function PlanFormDialog({
    open,
    onOpenChange,
    plan,
}: PlanFormDialogProps) {
    const [featureInput, setFeatureInput] = useState('');

    const { data, setData, post, patch, processing, errors, reset } = useForm({
        code: '',
        name: '',
        description: '',
        price: '',
        features: [] as string[],
        active: true,
    });

    useEffect(() => {
        if (plan && open) {
            setData({
                code: plan.code,
                name: plan.name,
                description: plan.description || '',
                price: plan.price.toString(),
                features: plan.features || [],
                active: plan.active,
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

        const formData = {
            ...data,
            price: parseFloat(data.price) || 0,
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
            <DialogContent className="sm:max-w-[600px]">
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

                            <div className="grid gap-2">
                                <Label htmlFor="price">Preço (R$)</Label>
                                <Input
                                    id="price"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={data.price}
                                    onChange={(e) =>
                                        setData('price', e.target.value)
                                    }
                                    placeholder="99.90"
                                    required
                                />
                                {errors.price && (
                                    <p className="text-sm text-red-500">
                                        {errors.price}
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
