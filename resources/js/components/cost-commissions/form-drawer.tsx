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
import { useForm } from '@inertiajs/react';
import * as React from 'react';
import { CostCommission } from './columns';

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

    const { data, setData, post, put, processing, errors, reset } = useForm({
        name: item?.name || '',
        type: item?.type || 'percentage',
        value: item?.value || '',
        affects_revenue_base: item?.affects_revenue_base || false,
        enters_tax_base: item?.enters_tax_base || false,
        reduces_revenue_base: item?.reduces_revenue_base || false,
        active: item?.active ?? true,
    });

    React.useEffect(() => {
        if (item) {
            setData({
                name: item.name,
                type: item.type,
                value: item.value,
                affects_revenue_base: item.affects_revenue_base,
                enters_tax_base: item.enters_tax_base,
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

                    {/* Switches */}
                    <div className="space-y-3 rounded-md border p-4">
                        <h4 className="text-sm font-medium">
                            Configurações de Aplicação
                        </h4>

                        <div className="flex items-center justify-between space-x-2">
                            <Label
                                htmlFor="affects_revenue_base"
                                className="text-sm font-normal"
                            >
                                Afeta base de receita
                            </Label>
                            <Switch
                                id="affects_revenue_base"
                                checked={data.affects_revenue_base}
                                onCheckedChange={(checked) =>
                                    setData('affects_revenue_base', checked)
                                }
                            />
                        </div>

                        <div className="flex items-center justify-between space-x-2">
                            <Label
                                htmlFor="enters_tax_base"
                                className="text-sm font-normal"
                            >
                                Entra na base do imposto
                            </Label>
                            <Switch
                                id="enters_tax_base"
                                checked={data.enters_tax_base}
                                onCheckedChange={(checked) =>
                                    setData('enters_tax_base', checked)
                                }
                            />
                        </div>

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
