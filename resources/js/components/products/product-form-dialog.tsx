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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useForm, usePage } from '@inertiajs/react';
import { Calculator, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { type Product } from './columns';

interface Ingredient {
    id: number;
    name: string;
    unit: string;
    unit_price: string;
}

interface TechnicalSheetItem {
    ingredient_id: number;
    ingredient_name: string;
    ingredient_unit: string;
    ingredient_price: number;
    qty: number;
}

interface ProductFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    product: Product | null;
}

export function ProductFormDialog({
    open,
    onOpenChange,
    product,
}: ProductFormDialogProps) {
    const { ingredients } = usePage<{ ingredients?: Ingredient[] }>().props;
    const availableIngredients = ingredients || [];

    const { data, setData, post, put, processing, errors, reset } = useForm({
        name: '',
        sku: '',
        type: 'product',
        unit: 'unit',
        unit_cost: '0',
        sale_price: '',
        active: true,
        recipe: [] as TechnicalSheetItem[],
    });

    const [selectedIngredientId, setSelectedIngredientId] =
        useState<string>('');
    const [ingredientQty, setIngredientQty] = useState<string>('');
    const [loadingProduct, setLoadingProduct] = useState(false);

    useEffect(() => {
        if (product && open) {
            // Carregar dados completos do produto incluindo a ficha técnica
            setLoadingProduct(true);
            fetch(`/products/${product.id}/data`)
                .then((res) => res.json())
                .then((productData) => {
                    interface Cost {
                        ingredient: {
                            id: number;
                            name: string;
                            unit: string;
                            unit_price: string;
                        };
                        qty: string;
                    }

                    const recipe: TechnicalSheetItem[] =
                        productData.costs?.map((cost: Cost) => ({
                            ingredient_id: cost.ingredient.id,
                            ingredient_name: cost.ingredient.name,
                            ingredient_unit: cost.ingredient.unit,
                            ingredient_price: parseFloat(
                                cost.ingredient.unit_price,
                            ),
                            qty: parseFloat(cost.qty),
                        })) || [];

                    setData({
                        name: productData.name,
                        sku: productData.sku || '',
                        type: productData.type,
                        unit: productData.unit,
                        unit_cost: productData.unit_cost,
                        sale_price: productData.sale_price,
                        active: productData.active,
                        recipe,
                    });
                    setLoadingProduct(false);
                })
                .catch((error) => {
                    console.error('Erro ao carregar produto:', error);
                    setLoadingProduct(false);
                });
        } else if (!open) {
            reset();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [product, open]);

    const calculateCMV = () => {
        return data.recipe.reduce((total, item) => {
            return total + item.ingredient_price * item.qty;
        }, 0);
    };

    const addIngredientToRecipe = () => {
        if (
            !selectedIngredientId ||
            !ingredientQty ||
            parseFloat(ingredientQty) <= 0
        ) {
            return;
        }

        const ingredient = availableIngredients.find(
            (i) => i.id.toString() === selectedIngredientId,
        );

        if (!ingredient) return;

        // Verificar se já existe na receita
        const existingIndex = data.recipe.findIndex(
            (item) => item.ingredient_id === ingredient.id,
        );

        if (existingIndex >= 0) {
            // Atualizar quantidade
            const newRecipe = [...data.recipe];
            newRecipe[existingIndex].qty = parseFloat(ingredientQty);
            setData('recipe', newRecipe);
        } else {
            // Adicionar novo
            setData('recipe', [
                ...data.recipe,
                {
                    ingredient_id: ingredient.id,
                    ingredient_name: ingredient.name,
                    ingredient_unit: ingredient.unit,
                    ingredient_price: parseFloat(ingredient.unit_price),
                    qty: parseFloat(ingredientQty),
                },
            ]);
        }

        setSelectedIngredientId('');
        setIngredientQty('');
    };

    const removeIngredientFromRecipe = (ingredientId: number) => {
        setData(
            'recipe',
            data.recipe.filter((item) => item.ingredient_id !== ingredientId),
        );
    };

    useEffect(() => {
        // Atualizar custo automaticamente quando a receita mudar e o dialog estiver aberto
        if (open && data.recipe.length > 0) {
            const cmv = calculateCMV();
            const currentCost = data.unit_cost;
            const newCost = cmv.toFixed(4);
            // Só atualizar se realmente mudou para evitar loops
            if (currentCost !== newCost) {
                setData('unit_cost', newCost);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data.recipe, open]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (product) {
            put(`/products/${product.id}`, {
                onSuccess: () => {
                    onOpenChange(false);
                    reset();
                },
            });
        } else {
            post('/products', {
                onSuccess: () => {
                    onOpenChange(false);
                    reset();
                },
            });
        }
    };

    const margin =
        parseFloat(data.sale_price) > 0 && parseFloat(data.unit_cost) > 0
            ? ((parseFloat(data.sale_price) - parseFloat(data.unit_cost)) /
                  parseFloat(data.unit_cost)) *
              100
            : 0;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
                {loadingProduct ? (
                    <div className="flex items-center justify-center p-8">
                        <div className="text-center">
                            <div className="mb-2 text-sm text-muted-foreground">
                                Carregando produto...
                            </div>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit}>
                        <DialogHeader>
                            <DialogTitle>
                                {product ? 'Editar Produto' : 'Novo Produto'}
                            </DialogTitle>
                            <DialogDescription>
                                {product
                                    ? 'Atualize as informações do produto.'
                                    : 'Preencha os dados para criar um novo produto com sua ficha técnica.'}
                            </DialogDescription>
                        </DialogHeader>

                        <Tabs defaultValue="info" className="mt-4">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="info">
                                    Informações Básicas
                                </TabsTrigger>
                                <TabsTrigger value="recipe">
                                    Ficha Técnica ({data.recipe.length})
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="info" className="space-y-4">
                                {/* Nome e SKU */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="name">
                                            Nome{' '}
                                            <span className="text-red-500">
                                                *
                                            </span>
                                        </Label>
                                        <Input
                                            id="name"
                                            value={data.name}
                                            onChange={(e) =>
                                                setData('name', e.target.value)
                                            }
                                            placeholder="Ex: Pizza Margherita"
                                            required
                                        />
                                        {errors.name && (
                                            <p className="text-sm text-red-500">
                                                {errors.name}
                                            </p>
                                        )}
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="sku">SKU</Label>
                                        <Input
                                            id="sku"
                                            value={data.sku}
                                            onChange={(e) =>
                                                setData('sku', e.target.value)
                                            }
                                            placeholder="Código do produto"
                                        />
                                        {errors.sku && (
                                            <p className="text-sm text-red-500">
                                                {errors.sku}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Tipo e Unidade */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="type">
                                            Tipo{' '}
                                            <span className="text-red-500">
                                                *
                                            </span>
                                        </Label>
                                        <Select
                                            value={data.type}
                                            onValueChange={(value) =>
                                                setData('type', value)
                                            }
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="product">
                                                    Produto
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                        {errors.type && (
                                            <p className="text-sm text-red-500">
                                                {errors.type}
                                            </p>
                                        )}
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="unit">
                                            Unidade{' '}
                                            <span className="text-red-500">
                                                *
                                            </span>
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
                                                <SelectItem value="g">
                                                    Grama
                                                </SelectItem>
                                                <SelectItem value="l">
                                                    Litro
                                                </SelectItem>
                                                <SelectItem value="ml">
                                                    Mililitro
                                                </SelectItem>
                                                <SelectItem value="hour">
                                                    Hora
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                        {errors.unit && (
                                            <p className="text-sm text-red-500">
                                                {errors.unit}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Custo e Preço de Venda */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="unit_cost">
                                            Custo Unitário (CMV)
                                        </Label>
                                        <Input
                                            id="unit_cost"
                                            type="number"
                                            step="0.0001"
                                            value={data.unit_cost}
                                            onChange={(e) =>
                                                setData(
                                                    'unit_cost',
                                                    e.target.value,
                                                )
                                            }
                                            placeholder="0.0000"
                                            disabled={data.recipe.length > 0}
                                        />
                                        {data.recipe.length > 0 && (
                                            <p className="flex items-center gap-1 text-xs text-muted-foreground">
                                                <Calculator className="h-3 w-3" />
                                                Calculado pela ficha técnica
                                            </p>
                                        )}
                                        {errors.unit_cost && (
                                            <p className="text-sm text-red-500">
                                                {errors.unit_cost}
                                            </p>
                                        )}
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="sale_price">
                                            Preço de Venda{' '}
                                            <span className="text-red-500">
                                                *
                                            </span>
                                        </Label>
                                        <Input
                                            id="sale_price"
                                            type="number"
                                            step="0.01"
                                            value={data.sale_price}
                                            onChange={(e) =>
                                                setData(
                                                    'sale_price',
                                                    e.target.value,
                                                )
                                            }
                                            placeholder="0.00"
                                            required
                                        />
                                        {margin > 0 && (
                                            <p className="text-xs text-muted-foreground">
                                                Margem: {margin.toFixed(1)}%
                                            </p>
                                        )}
                                        {errors.sale_price && (
                                            <p className="text-sm text-red-500">
                                                {errors.sale_price}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Status */}
                                {/* Ativo */}
                                <div className="flex items-center justify-between space-x-2">
                                    <Label
                                        htmlFor="active"
                                        className="cursor-pointer"
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
                            </TabsContent>

                            <TabsContent value="recipe" className="space-y-4">
                                {/* Adicionar Ingrediente */}
                                <div className="rounded-lg border p-4">
                                    <h4 className="mb-3 font-medium">
                                        Adicionar Insumo
                                    </h4>
                                    <div className="flex gap-2">
                                        <Combobox
                                            options={availableIngredients.map(
                                                (ing) => ({
                                                    value: ing.id.toString(),
                                                    label: `${ing.name} (${ing.unit}) - R$ ${parseFloat(ing.unit_price).toFixed(4)}`,
                                                }),
                                            )}
                                            value={selectedIngredientId}
                                            onChange={setSelectedIngredientId}
                                            placeholder="Selecione um insumo"
                                            searchPlaceholder="Buscar insumo..."
                                            emptyMessage="Nenhum insumo encontrado."
                                            className="flex-1"
                                        />
                                        <Input
                                            type="number"
                                            step="0.001"
                                            value={ingredientQty}
                                            onChange={(e) =>
                                                setIngredientQty(e.target.value)
                                            }
                                            placeholder="Qtd"
                                            className="w-24"
                                        />
                                        <Button
                                            type="button"
                                            size="sm"
                                            onClick={addIngredientToRecipe}
                                        >
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>

                                {/* Lista de Ingredientes */}
                                {data.recipe.length > 0 ? (
                                    <div className="rounded-md border">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>
                                                        Insumo
                                                    </TableHead>
                                                    <TableHead className="text-right">
                                                        Quantidade
                                                    </TableHead>
                                                    <TableHead className="text-right">
                                                        Custo Unit.
                                                    </TableHead>
                                                    <TableHead className="text-right">
                                                        Custo Total
                                                    </TableHead>
                                                    <TableHead className="w-[50px]"></TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {data.recipe.map((item) => (
                                                    <TableRow
                                                        key={item.ingredient_id}
                                                    >
                                                        <TableCell>
                                                            {
                                                                item.ingredient_name
                                                            }
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            {item.qty.toFixed(
                                                                3,
                                                            )}{' '}
                                                            {
                                                                item.ingredient_unit
                                                            }
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            R${' '}
                                                            {item.ingredient_price.toFixed(
                                                                4,
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-right font-medium">
                                                            R${' '}
                                                            {(
                                                                item.qty *
                                                                item.ingredient_price
                                                            ).toFixed(4)}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() =>
                                                                    removeIngredientFromRecipe(
                                                                        item.ingredient_id,
                                                                    )
                                                                }
                                                            >
                                                                <Trash2 className="h-4 w-4 text-red-600" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                                <TableRow className="bg-muted/50">
                                                    <TableCell
                                                        colSpan={3}
                                                        className="font-semibold"
                                                    >
                                                        CMV Total
                                                    </TableCell>
                                                    <TableCell className="text-right font-semibold">
                                                        R${' '}
                                                        {calculateCMV().toFixed(
                                                            4,
                                                        )}
                                                    </TableCell>
                                                    <TableCell></TableCell>
                                                </TableRow>
                                            </TableBody>
                                        </Table>
                                    </div>
                                ) : (
                                    <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                                        Nenhum insumo adicionado ainda.
                                        <br />
                                        Adicione insumos para calcular o CMV
                                        automaticamente.
                                    </div>
                                )}
                            </TabsContent>
                        </Tabs>

                        <DialogFooter className="mt-6">
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
                                    : product
                                      ? 'Atualizar'
                                      : 'Criar'}
                            </Button>
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
