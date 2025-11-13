import { Button } from '@/components/ui/button';
import { ColorPicker } from '@/components/ui/color-picker';
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
import { useForm } from '@inertiajs/react';
import { useEffect } from 'react';
import { type Category } from './columns';

interface CategoryManageDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    category: Category | null;
}

export function CategoryManageDialog({
    open,
    onOpenChange,
    category,
}: CategoryManageDialogProps) {
    const { data, setData, post, put, processing, errors, reset } = useForm({
        name: '',
        type: 'ingredient' as 'ingredient' | 'product',
        color: '#6b7280',
        active: true,
    });

    useEffect(() => {
        if (category) {
            setData({
                name: category.name,
                type: category.type as 'ingredient' | 'product',
                color: category.color,
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
            put(`/api/categories/${category.id}`, {
                preserveScroll: true,
                onSuccess: () => {
                    onOpenChange(false);
                    reset();
                },
            });
        } else {
            post('/api/categories', {
                preserveScroll: true,
                onSuccess: () => {
                    onOpenChange(false);
                    reset();
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
                            {category ? 'Editar Categoria' : 'Nova Categoria'}
                        </DialogTitle>
                        <DialogDescription>
                            {category
                                ? 'Atualize as informações da categoria.'
                                : 'Preencha os dados para criar uma nova categoria.'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
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
                                placeholder="Ex: Bebidas, Carnes, Vegetais"
                                required
                                autoComplete="off"
                            />
                            {errors.name && (
                                <p className="text-sm text-red-500">
                                    {errors.name}
                                </p>
                            )}
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="color">Cor</Label>
                            <ColorPicker
                                value={data.color}
                                onChange={(color) => setData('color', color)}
                            />
                            {errors.color && (
                                <p className="text-sm text-red-500">
                                    {errors.color}
                                </p>
                            )}
                        </div>

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
