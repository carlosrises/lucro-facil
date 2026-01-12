import { CategoryCombobox } from '@/components/categories/category-combobox';
import { CategoryFormDialog } from '@/components/categories/category-form-dialog';
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
import { router, useForm } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { type Ingredient } from './columns';

interface Category {
    id: number;
    name: string;
}

interface IngredientFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    ingredient: Ingredient | null;
    categories: Category[];
}

export function IngredientFormDialog({
    open,
    onOpenChange,
    ingredient,
    categories,
}: IngredientFormDialogProps) {
    const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);

    const { data, setData, post, put, processing, errors, reset } = useForm({
        name: '',
        category_id: '',
        unit: 'unit',
        unit_price: '',
        current_stock: '',
        ideal_stock: '',
        active: true,
    });

    const handleCategoryCreated = (categoryId?: number) => {
        if (categoryId) {
            setData('category_id', categoryId.toString());
        }
        router.reload({ only: ['categories'] });
    };

    useEffect(() => {
        if (ingredient) {
            setData({
                name: ingredient.name,
                category_id: ingredient.category_id?.toString() || '',
                unit: ingredient.unit,
                unit_price: ingredient.unit_price,
                current_stock: ingredient.current_stock,
                ideal_stock: ingredient.ideal_stock,
                active: ingredient.active,
            });
        } else {
            reset();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ingredient, open]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Verificar se é duplicação
        const isDuplicate = ingredient && '_isDuplicate' in ingredient;

        if (ingredient && !isDuplicate) {
            // Edição de ingrediente existente
            put(`/ingredients/${ingredient.id}`, {
                onSuccess: () => {
                    toast.success('Insumo atualizado com sucesso!');
                    onOpenChange(false);
                    reset();
                },
                onError: () => {
                    toast.error('Erro ao atualizar insumo');
                },
            });
        } else {
            // Criar novo ingrediente (tanto para novo quanto para duplicação)
            post('/ingredients', {
                onSuccess: () => {
                    toast.success('Insumo criado com sucesso!');
                    onOpenChange(false);
                    reset();
                },
                onError: () => {
                    toast.error('Erro ao criar insumo');
                },
            });
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>
                            {ingredient && !('_isDuplicate' in ingredient)
                                ? 'Editar Insumo'
                                : 'Novo Insumo'}
                        </DialogTitle>
                        <DialogDescription>
                            {ingredient && !('_isDuplicate' in ingredient)
                                ? 'Atualize as informações do insumo.'
                                : 'Preencha os dados para criar um novo insumo.'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        {/* Nome */}
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
                                placeholder="Ex: Farinha de trigo"
                                required
                            />
                            {errors.name && (
                                <p className="text-sm text-red-500">
                                    {errors.name}
                                </p>
                            )}
                        </div>

                        {/* Categoria */}
                        <div className="grid gap-2">
                            <Label htmlFor="category_id">Categoria</Label>
                            <CategoryCombobox
                                categories={categories}
                                value={data.category_id}
                                onChange={(value) =>
                                    setData('category_id', value)
                                }
                                onCreateNew={() =>
                                    setIsCategoryDialogOpen(true)
                                }
                            />
                            {errors.category_id && (
                                <p className="text-sm text-red-500">
                                    {errors.category_id}
                                </p>
                            )}
                        </div>

                        {/* Unidade e Preço */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="unit">
                                    Unidade{' '}
                                    <span className="text-red-500">*</span>
                                </Label>
                                <Select
                                    value={data.unit}
                                    onValueChange={(value) =>
                                        setData('unit', value)
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="unit">
                                            Unidade
                                        </SelectItem>
                                        <SelectItem value="kg">
                                            Quilograma
                                        </SelectItem>
                                        <SelectItem value="g">Grama</SelectItem>
                                        <SelectItem value="l">Litro</SelectItem>
                                        <SelectItem value="ml">
                                            Mililitro
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                                {errors.unit && (
                                    <p className="text-sm text-red-500">
                                        {errors.unit}
                                    </p>
                                )}
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="unit_price">
                                    Preço Unitário{' '}
                                    <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="unit_price"
                                    type="number"
                                    step="0.0001"
                                    value={data.unit_price}
                                    onChange={(e) =>
                                        setData('unit_price', e.target.value)
                                    }
                                    placeholder="0.00"
                                    required
                                />
                                {errors.unit_price && (
                                    <p className="text-sm text-red-500">
                                        {errors.unit_price}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Estoque Atual e Ideal */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="current_stock">
                                    Estoque Atual{' '}
                                    <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="current_stock"
                                    type="number"
                                    step="0.001"
                                    value={data.current_stock}
                                    onChange={(e) =>
                                        setData('current_stock', e.target.value)
                                    }
                                    placeholder="0.000"
                                    required
                                />
                                {errors.current_stock && (
                                    <p className="text-sm text-red-500">
                                        {errors.current_stock}
                                    </p>
                                )}
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="ideal_stock">
                                    Estoque Ideal{' '}
                                    <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="ideal_stock"
                                    type="number"
                                    step="0.001"
                                    value={data.ideal_stock}
                                    onChange={(e) =>
                                        setData('ideal_stock', e.target.value)
                                    }
                                    placeholder="0.000"
                                    required
                                />
                                {errors.ideal_stock && (
                                    <p className="text-sm text-red-500">
                                        {errors.ideal_stock}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Ativo */}
                        <div className="flex items-center justify-between space-x-2">
                            <Label htmlFor="active" className="cursor-pointer">
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
                                : ingredient && !('_isDuplicate' in ingredient)
                                  ? 'Atualizar'
                                  : 'Criar'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>

            {/* Dialog para criar nova categoria */}
            <CategoryFormDialog
                open={isCategoryDialogOpen}
                onOpenChange={setIsCategoryDialogOpen}
                type="ingredient"
                onSuccess={handleCategoryCreated}
            />
        </Dialog>
    );
}
