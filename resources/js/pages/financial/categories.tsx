import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
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
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { Edit, FolderTree, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Financeiro',
        href: '/financial/summary',
    },
    {
        title: 'Categorias Operacionais',
        href: '/financial/categories',
    },
];

type Category = {
    id: number;
    name: string;
    type: 'expense' | 'income';
    parent_id: number | null;
    children: Category[];
};

type Props = {
    categories: Category[];
};

export default function FinancialCategories({ categories }: Props) {
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<Category | null>(
        null,
    );
    const [parentId, setParentId] = useState<number | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        type: 'expense' as 'expense' | 'income',
        parent_id: null as number | null,
    });

    const handleCreate = () => {
        router.post(
            '/financial/categories',
            {
                ...formData,
                parent_id: parentId,
            },
            {
                onSuccess: () => {
                    toast.success('Categoria criada com sucesso!');
                    setIsCreateDialogOpen(false);
                    setFormData({
                        name: '',
                        type: 'expense',
                        parent_id: null,
                    });
                    setParentId(null);
                },
                onError: () => {
                    toast.error('Erro ao criar categoria');
                },
            },
        );
    };

    const handleEdit = () => {
        if (!selectedCategory) return;

        router.put(`/financial/categories/${selectedCategory.id}`, formData, {
            onSuccess: () => {
                toast.success('Categoria atualizada com sucesso!');
                setIsEditDialogOpen(false);
                setSelectedCategory(null);
            },
            onError: () => {
                toast.error('Erro ao atualizar categoria');
            },
        });
    };

    const handleDelete = () => {
        if (!selectedCategory) return;

        router.delete(`/financial/categories/${selectedCategory.id}`, {
            onSuccess: () => {
                toast.success('Categoria excluída com sucesso!');
                setIsDeleteDialogOpen(false);
                setSelectedCategory(null);
            },
            onError: () => {
                toast.error('Erro ao excluir categoria');
            },
        });
    };

    const openCreateDialog = (parent: Category | null = null) => {
        setParentId(parent?.id ?? null);
        setFormData({
            name: '',
            type: parent?.type ?? 'expense',
            parent_id: parent?.id ?? null,
        });
        setIsCreateDialogOpen(true);
    };

    const openEditDialog = (category: Category) => {
        setSelectedCategory(category);
        setFormData({
            name: category.name,
            type: category.type,
            parent_id: category.parent_id,
        });
        setIsEditDialogOpen(true);
    };

    const openDeleteDialog = (category: Category) => {
        setSelectedCategory(category);
        setIsDeleteDialogOpen(true);
    };

    const renderCategoryTree = (items: Category[], level: number = 0) => {
        return (
            <div
                className={`${level > 0 ? 'ml-6 border-l-2 border-gray-200 pl-4' : ''}`}
            >
                {items.map((category) => (
                    <div key={category.id} className="mb-2">
                        <div className="flex items-center justify-between rounded-lg border bg-card p-3 hover:bg-accent">
                            <div className="flex items-center gap-3">
                                {category.children.length > 0 && (
                                    <FolderTree className="h-4 w-4 text-muted-foreground" />
                                )}
                                <span className="font-medium">
                                    {category.name}
                                </span>
                                <Badge
                                    variant={
                                        category.type === 'expense'
                                            ? 'destructive'
                                            : 'default'
                                    }
                                >
                                    {category.type === 'expense'
                                        ? 'Despesa'
                                        : 'Receita'}
                                </Badge>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => openCreateDialog(category)}
                                >
                                    <Plus className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => openEditDialog(category)}
                                >
                                    <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => openDeleteDialog(category)}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                        {category.children.length > 0 &&
                            renderCategoryTree(category.children, level + 1)}
                    </div>
                ))}
            </div>
        );
    };

    const expenseCategories = categories.filter((c) => c.type === 'expense');
    const incomeCategories = categories.filter((c) => c.type === 'income');

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Categorias Operacionais" />

            <div className="flex flex-1 flex-col">
                <div className="@container/main flex flex-1 flex-col gap-2">
                    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                        <div className="flex w-full flex-col gap-4 px-4 lg:px-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-2xl font-bold tracking-tight">
                                        Categorias Operacionais
                                    </h2>
                                    <p className="text-muted-foreground">
                                        Gerencie as categorias de receitas e
                                        despesas em cascata
                                    </p>
                                </div>
                                <Button onClick={() => openCreateDialog()}>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Nova Categoria
                                </Button>
                            </div>

                            {/* Grid com 2 colunas */}
                            <div className="grid gap-4 md:grid-cols-2">
                                {/* Despesas */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-red-600">
                                            Despesas
                                        </CardTitle>
                                        <CardDescription>
                                            Categorias de despesas operacionais
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        {expenseCategories.length > 0 ? (
                                            renderCategoryTree(
                                                expenseCategories,
                                            )
                                        ) : (
                                            <div className="flex h-32 items-center justify-center text-muted-foreground">
                                                Nenhuma categoria de despesa
                                                cadastrada
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>

                                {/* Receitas */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-green-600">
                                            Receitas
                                        </CardTitle>
                                        <CardDescription>
                                            Categorias de receitas operacionais
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        {incomeCategories.length > 0 ? (
                                            renderCategoryTree(incomeCategories)
                                        ) : (
                                            <div className="flex h-32 items-center justify-center text-muted-foreground">
                                                Nenhuma categoria de receita
                                                cadastrada
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Create/Edit Dialog */}
            <Dialog
                open={isCreateDialogOpen || isEditDialogOpen}
                onOpenChange={(open) => {
                    setIsCreateDialogOpen(open);
                    setIsEditDialogOpen(open);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {isEditDialogOpen
                                ? 'Editar Categoria'
                                : 'Nova Categoria'}
                        </DialogTitle>
                        <DialogDescription>
                            {isEditDialogOpen
                                ? 'Atualize as informações da categoria'
                                : parentId
                                  ? 'Criar subcategoria'
                                  : 'Criar nova categoria raiz'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="name">Nome</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        name: e.target.value,
                                    })
                                }
                                placeholder="Ex: Custos com Pessoas"
                            />
                        </div>
                        {!parentId && (
                            <div>
                                <Label htmlFor="type">Tipo</Label>
                                <Select
                                    value={formData.type}
                                    onValueChange={(
                                        value: 'expense' | 'income',
                                    ) =>
                                        setFormData({
                                            ...formData,
                                            type: value,
                                        })
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="expense">
                                            Despesa
                                        </SelectItem>
                                        <SelectItem value="income">
                                            Receita
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setIsCreateDialogOpen(false);
                                setIsEditDialogOpen(false);
                            }}
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={
                                isEditDialogOpen ? handleEdit : handleCreate
                            }
                        >
                            {isEditDialogOpen ? 'Salvar' : 'Criar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Dialog */}
            <AlertDialog
                open={isDeleteDialogOpen}
                onOpenChange={setIsDeleteDialogOpen}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja excluir a categoria{' '}
                            <strong>{selectedCategory?.name}</strong>? Esta ação
                            não pode ser desfeita.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            Excluir
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </AppLayout>
    );
}
