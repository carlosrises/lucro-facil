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
import { router, useForm, usePage } from '@inertiajs/react';
import { useEffect } from 'react';

interface CategoryFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    type: 'ingredient' | 'product';
    onSuccess?: (categoryId?: number) => void;
}

export function CategoryFormDialog({
    open,
    onOpenChange,
    type,
    onSuccess,
}: CategoryFormDialogProps) {
    const { category: createdCategory } = usePage<{
        category?: { id: number };
    }>().props;

    const { data, setData, post, processing, errors, reset } = useForm({
        name: '',
        type: type,
        color: '#6b7280',
        active: true,
    });

    useEffect(() => {
        if (createdCategory && onSuccess) {
            onSuccess(createdCategory.id);
            // Limpar a categoria da sessão
            router.reload({ only: [] });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [createdCategory]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        post('/api/categories', {
            preserveScroll: true,
            onSuccess: () => {
                reset();
                onOpenChange(false);
            },
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Nova Categoria</DialogTitle>
                    <DialogDescription>
                        Criar uma nova categoria de{' '}
                        {type === 'ingredient' ? 'insumos' : 'produtos'}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name">Nome</Label>
                            <Input
                                id="name"
                                value={data.name}
                                onChange={(e) =>
                                    setData('name', e.target.value)
                                }
                                placeholder="Nome da categoria"
                                autoComplete="off"
                            />
                            {errors.name && (
                                <p className="text-sm text-red-600">
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
                                <p className="text-sm text-red-600">
                                    {errors.color}
                                </p>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                reset();
                                onOpenChange(false);
                            }}
                        >
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={processing}>
                            {processing ? 'Salvando...' : 'Salvar'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
