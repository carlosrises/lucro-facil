import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { Textarea } from '@/components/ui/textarea';
import { useForm } from '@inertiajs/react';
import { Info } from 'lucide-react';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { type TaxCategory } from './columns';

interface TaxCategoryFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    category?: TaxCategory;
}

const icmsOriginOptions = [
    { value: '0', label: '0 - Nacional' },
    { value: '1', label: '1 - Estrangeira (importação direta)' },
    { value: '2', label: '2 - Estrangeira (mercado interno)' },
    { value: '3', label: '3 - Nacional c/ 40-70% importado' },
    { value: '4', label: '4 - Nacional c/ produção em conformidade' },
    { value: '5', label: '5 - Nacional c/ <40% importado' },
    { value: '6', label: '6 - Estrangeira (importação direta sem similar)' },
    { value: '7', label: '7 - Estrangeira (mercado interno sem similar)' },
    { value: '8', label: '8 - Nacional c/ >70% importado' },
];

const pisCofinsModeOptions = [
    { value: 'normal', label: 'Normal (usar alíquotas acima)' },
    { value: 'monofasico', label: 'Monofásico (alíquota zero na venda)' },
    { value: 'isento', label: 'Isento' },
];

export function TaxCategoryFormDialog({
    open,
    onOpenChange,
    category,
}: TaxCategoryFormDialogProps) {
    const { data, setData, post, put, processing, errors, reset } = useForm({
        name: '',
        sale_cfop: '',
        description: '',
        icms_origin: '0',
        csosn_cst: '',
        ncm: '',
        tax_calculation_type: 'detailed' as 'detailed' | 'fixed' | 'none',
        iss_rate: '',
        icms_rate: '',
        pis_rate: '',
        cofins_rate: '',
        pis_cofins_mode: 'normal' as 'normal' | 'monofasico' | 'isento',
        icms_st: false,
        fixed_tax_rate: '',
        active: true,
    });

    useEffect(() => {
        if (category) {
            setData({
                name: category.name,
                sale_cfop: category.sale_cfop,
                description: category.description || '',
                icms_origin: category.icms_origin,
                csosn_cst: category.csosn_cst,
                ncm: category.ncm || '',
                tax_calculation_type: category.tax_calculation_type,
                iss_rate: category.iss_rate?.toString() || '',
                icms_rate: category.icms_rate?.toString() || '',
                pis_rate: category.pis_rate?.toString() || '',
                cofins_rate: category.cofins_rate?.toString() || '',
                pis_cofins_mode: category.pis_cofins_mode || 'normal',
                icms_st: category.icms_st,
                fixed_tax_rate: category.fixed_tax_rate?.toString() || '',
                active: category.active,
            });
        } else {
            reset();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [category, open]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (category) {
            put(`/tax-categories/${category.id}`, {
                preserveScroll: true,
                onSuccess: () => {
                    onOpenChange(false);
                    reset();
                    toast.success('Categoria fiscal atualizada com sucesso!');
                },
                onError: () => {
                    toast.error('Erro ao atualizar categoria fiscal.');
                },
            });
        } else {
            post('/tax-categories', {
                preserveScroll: true,
                onSuccess: () => {
                    onOpenChange(false);
                    reset();
                    toast.success('Categoria fiscal criada com sucesso!');
                },
                onError: () => {
                    toast.error('Erro ao criar categoria fiscal.');
                },
            });
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[800px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>
                            {category
                                ? 'Editar Categoria Fiscal'
                                : 'Nova Categoria Fiscal'}
                        </DialogTitle>
                        <DialogDescription>
                            {category
                                ? 'Atualize as informações da categoria fiscal.'
                                : 'Preencha os dados para criar uma nova categoria fiscal.'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        {/* Nome e CFOP em linha */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="name">
                                    Nome <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="name"
                                    value={data.name}
                                    onChange={(e) =>
                                        setData('name', e.target.value)
                                    }
                                    placeholder="Ex: Alimentos Industrializados"
                                    required
                                />
                                {errors.name && (
                                    <p className="text-sm text-red-500">
                                        {errors.name}
                                    </p>
                                )}
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="sale_cfop">
                                    CFOP de Venda{' '}
                                    <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="sale_cfop"
                                    value={data.sale_cfop}
                                    onChange={(e) =>
                                        setData('sale_cfop', e.target.value)
                                    }
                                    placeholder="Ex: 5102"
                                    required
                                />
                                {errors.sale_cfop && (
                                    <p className="text-sm text-red-500">
                                        {errors.sale_cfop}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Descrição */}
                        <div className="grid gap-2">
                            <Label htmlFor="description">Descrição</Label>
                            <Textarea
                                id="description"
                                value={data.description}
                                onChange={(
                                    e: React.ChangeEvent<HTMLTextAreaElement>,
                                ) => setData('description', e.target.value)}
                                placeholder="Descrição da categoria fiscal"
                                rows={2}
                            />
                            {errors.description && (
                                <p className="text-sm text-red-500">
                                    {errors.description}
                                </p>
                            )}
                        </div>

                        {/* Origem ICMS, CSOSN/CST e NCM em linha */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="icms_origin">
                                    ICMS Origem{' '}
                                    <span className="text-red-500">*</span>
                                </Label>
                                <Select
                                    value={data.icms_origin}
                                    onValueChange={(value) =>
                                        setData('icms_origin', value)
                                    }
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Selecione" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {icmsOriginOptions.map((option) => (
                                            <SelectItem
                                                key={option.value}
                                                value={option.value}
                                            >
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {errors.icms_origin && (
                                    <p className="text-sm text-red-500">
                                        {errors.icms_origin}
                                    </p>
                                )}
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="csosn_cst">
                                    CSOSN/CST{' '}
                                    <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="csosn_cst"
                                    value={data.csosn_cst}
                                    onChange={(e) =>
                                        setData('csosn_cst', e.target.value)
                                    }
                                    placeholder="Ex: 101"
                                    required
                                />
                                {errors.csosn_cst && (
                                    <p className="text-sm text-red-500">
                                        {errors.csosn_cst}
                                    </p>
                                )}
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="ncm">NCM</Label>
                                <Input
                                    id="ncm"
                                    value={data.ncm}
                                    onChange={(e) =>
                                        setData('ncm', e.target.value)
                                    }
                                    placeholder="Ex: 01012100"
                                />
                                {errors.ncm && (
                                    <p className="text-sm text-red-500">
                                        {errors.ncm}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Cálculo de Imposto */}
                        <div className="space-y-2">
                            <h4 className="font-medium">Cálculo de Imposto</h4>
                            <div className="grid gap-2">
                                <Label htmlFor="tax_calculation_type">
                                    Como calcular o imposto?{' '}
                                    <span className="text-red-500">*</span>
                                </Label>
                                <Select
                                    value={data.tax_calculation_type}
                                    onValueChange={(value) =>
                                        setData(
                                            'tax_calculation_type',
                                            value as
                                                | 'detailed'
                                                | 'fixed'
                                                | 'none',
                                        )
                                    }
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="detailed">
                                            📊 Alíquotas detalhadas (ISS, ICMS,
                                            PIS, COFINS)
                                        </SelectItem>
                                        <SelectItem value="fixed">
                                            💰 Fixo (Porcentagem única)
                                        </SelectItem>
                                        <SelectItem value="none">
                                            🚫 Isento (Sem impostos)
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                                {data.tax_calculation_type === 'detailed' && (
                                    <p className="text-xs text-muted-foreground">
                                        Calcular impostos usando alíquotas
                                        separadas (ISS, ICMS, PIS, COFINS)
                                    </p>
                                )}
                                {errors.tax_calculation_type && (
                                    <p className="text-sm text-red-500">
                                        {errors.tax_calculation_type}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Campos Condicionais - Detalhado */}
                        {data.tax_calculation_type === 'detailed' && (
                            <div className="space-y-4 rounded-md border p-4">
                                <h4 className="font-semibold">
                                    Alíquotas Detalhadas (%)
                                </h4>

                                <div className="grid grid-cols-4 gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="iss_rate">ISS %</Label>
                                        <Input
                                            id="iss_rate"
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            max="100"
                                            value={data.iss_rate}
                                            onChange={(e) =>
                                                setData(
                                                    'iss_rate',
                                                    e.target.value,
                                                )
                                            }
                                            placeholder="0"
                                        />
                                        {errors.iss_rate && (
                                            <p className="text-sm text-red-500">
                                                {errors.iss_rate}
                                            </p>
                                        )}
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="icms_rate">
                                            ICMS %
                                        </Label>
                                        <Input
                                            id="icms_rate"
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            max="100"
                                            value={data.icms_rate}
                                            onChange={(e) =>
                                                setData(
                                                    'icms_rate',
                                                    e.target.value,
                                                )
                                            }
                                            placeholder="0"
                                        />
                                        {errors.icms_rate && (
                                            <p className="text-sm text-red-500">
                                                {errors.icms_rate}
                                            </p>
                                        )}
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="pis_rate">PIS %</Label>
                                        <Input
                                            id="pis_rate"
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            max="100"
                                            value={data.pis_rate}
                                            onChange={(e) =>
                                                setData(
                                                    'pis_rate',
                                                    e.target.value,
                                                )
                                            }
                                            placeholder="0"
                                        />
                                        {errors.pis_rate && (
                                            <p className="text-sm text-red-500">
                                                {errors.pis_rate}
                                            </p>
                                        )}
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="cofins_rate">
                                            COFINS %
                                        </Label>
                                        <Input
                                            id="cofins_rate"
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            max="100"
                                            value={data.cofins_rate}
                                            onChange={(e) =>
                                                setData(
                                                    'cofins_rate',
                                                    e.target.value,
                                                )
                                            }
                                            placeholder="0"
                                        />
                                        {errors.cofins_rate && (
                                            <p className="text-sm text-red-500">
                                                {errors.cofins_rate}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h4 className="font-semibold">
                                        Configurações Especiais
                                    </h4>

                                    <div className="grid gap-2">
                                        <Label htmlFor="pis_cofins_mode">
                                            Modo PIS/COFINS
                                        </Label>
                                        <Select
                                            value={data.pis_cofins_mode}
                                            onValueChange={(value) =>
                                                setData(
                                                    'pis_cofins_mode',
                                                    value as
                                                        | 'normal'
                                                        | 'monofasico'
                                                        | 'isento',
                                                )
                                            }
                                        >
                                            <SelectTrigger className="w-full">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {pisCofinsModeOptions.map(
                                                    (option) => (
                                                        <SelectItem
                                                            key={option.value}
                                                            value={option.value}
                                                        >
                                                            {option.label}
                                                        </SelectItem>
                                                    ),
                                                )}
                                            </SelectContent>
                                        </Select>
                                        {errors.pis_cofins_mode && (
                                            <p className="text-sm text-red-500">
                                                {errors.pis_cofins_mode}
                                            </p>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-between rounded-md border p-3">
                                        <div className="space-y-0.5">
                                            <Label
                                                htmlFor="icms_st"
                                                className="cursor-pointer font-medium"
                                            >
                                                ICMS-ST (Substituição
                                                Tributária)
                                            </Label>
                                            <p className="text-xs text-muted-foreground">
                                                Se ativo, ICMS será zerado na
                                                venda (já foi retido
                                                anteriormente)
                                            </p>
                                        </div>
                                        <Switch
                                            id="icms_st"
                                            checked={data.icms_st}
                                            onCheckedChange={(checked) =>
                                                setData('icms_st', checked)
                                            }
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Campos Condicionais - Fixo */}
                        {data.tax_calculation_type === 'fixed' && (
                            <div className="space-y-4 rounded-md border p-4">
                                <h4 className="font-semibold">Alíquota Fixa</h4>

                                <div className="grid gap-2">
                                    <Label htmlFor="fixed_tax_rate">
                                        Porcentagem Total de Impostos (%){' '}
                                        <span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                        id="fixed_tax_rate"
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        max="100"
                                        value={data.fixed_tax_rate}
                                        onChange={(e) =>
                                            setData(
                                                'fixed_tax_rate',
                                                e.target.value,
                                            )
                                        }
                                        placeholder="0.00"
                                        required={
                                            data.tax_calculation_type ===
                                            'fixed'
                                        }
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Esta porcentagem será aplicada sobre o
                                        valor do produto como carga tributária
                                        total
                                    </p>
                                    {errors.fixed_tax_rate && (
                                        <p className="text-sm text-red-500">
                                            {errors.fixed_tax_rate}
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Campos Condicionais - Isento */}
                        {data.tax_calculation_type === 'none' && (
                            <Alert>
                                <Info className="h-4 w-4" />
                                <AlertDescription>
                                    Produtos com esta categoria fiscal não terão
                                    cálculo de impostos. Indicado para produtos
                                    isentos ou não tributados.
                                </AlertDescription>
                            </Alert>
                        )}

                        {/* Status Ativo */}
                        <div className="flex items-center justify-between rounded-md border p-3">
                            <div className="space-y-0.5">
                                <Label
                                    htmlFor="active"
                                    className="cursor-pointer font-medium"
                                >
                                    Ativo
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                    Categorias inativas não aparecem para
                                    seleção
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
                            {processing
                                ? 'Salvando...'
                                : category
                                  ? 'Atualizar'
                                  : 'Criar'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
