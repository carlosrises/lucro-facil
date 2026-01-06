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
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useForm, usePage } from '@inertiajs/react';
import { Calculator, Info, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
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
    size?: string; // Tamanho específico desta ficha (broto, media, grande, familia)
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
    const { ingredients, taxCategories } = usePage<{
        ingredients?: Ingredient[];
        taxCategories?: Array<{
            id: number;
            name: string;
            tax_calculation_type: string;
            total_tax_rate: number;
        }>;
    }>().props;
    const availableIngredients = ingredients || [];
    const availableTaxCategories = taxCategories || [];

    const { data, setData, post, put, processing, errors, reset } = useForm({
        name: '',
        sku: '',
        type: 'product',
        product_category: '',
        max_flavors: 1,
        size: '',
        unit: 'unit',
        unit_cost: '0',
        sale_price: '',
        tax_category_id: '',
        active: true,
        is_ingredient: false,
        recipe: [] as TechnicalSheetItem[],
        update_existing_orders: false,
    });

    const [selectedIngredientId, setSelectedIngredientId] =
        useState<string>('');
    const [ingredientQty, setIngredientQty] = useState<string>('');
    const [selectedSize, setSelectedSize] = useState<string>('');
    const [loadingProduct, setLoadingProduct] = useState(false);

    useEffect(() => {
        if (product && open) {
            // Verificar se é duplicação (tem _recipe pré-carregada)
            const isDuplicate =
                '_isDuplicate' in product &&
                (product as { _isDuplicate?: boolean })._isDuplicate;
            const preloadedRecipe =
                '_recipe' in product
                    ? (product as { _recipe?: TechnicalSheetItem[] })._recipe
                    : undefined;

            if (isDuplicate && preloadedRecipe) {
                // Duplicação: usar dados pré-carregados
                setData({
                    name: (product as { name: string }).name,
                    sku: (product as { sku?: string }).sku || '',
                    type: (product as { type: string }).type,
                    product_category:
                        (product as { product_category?: string })
                            .product_category || '',
                    max_flavors:
                        (product as { max_flavors?: number }).max_flavors || 1,
                    size: (product as { size?: string }).size || '',
                    unit: (product as { unit: string }).unit,
                    unit_cost: (product as { unit_cost: string }).unit_cost,
                    sale_price: (product as { sale_price: string }).sale_price,
                    tax_category_id:
                        (
                            product as { tax_category_id?: number }
                        ).tax_category_id?.toString() || '',
                    active: (product as { active: boolean }).active,
                    is_ingredient:
                        (product as { is_ingredient?: boolean })
                            .is_ingredient || false,
                    recipe: preloadedRecipe,
                });
                setLoadingProduct(false);
            } else if (product.id) {
                // Edição: carregar dados completos do produto incluindo a ficha técnica
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
                            size?: string;
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
                                size: cost.size,
                            })) || [];

                        setData({
                            name: productData.name,
                            sku: productData.sku || '',
                            type: productData.type,
                            product_category:
                                productData.product_category || '',
                            max_flavors: productData.max_flavors || 1,
                            size: productData.size || '',
                            unit: productData.unit,
                            unit_cost: productData.unit_cost,
                            sale_price: productData.sale_price,
                            tax_category_id:
                                productData.tax_category_id?.toString() || '',
                            active: productData.active,
                            is_ingredient: productData.is_ingredient || false,
                            recipe,
                        });
                        setLoadingProduct(false);
                    })
                    .catch((error) => {
                        console.error('Erro ao carregar produto:', error);
                        setLoadingProduct(false);
                    });
            }
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

        // Para sabores de pizza, tamanho é obrigatório
        if (data.product_category === 'sabor_pizza' && !selectedSize) {
            toast.error('Selecione um tamanho para o insumo');
            return;
        }

        const ingredient = availableIngredients.find(
            (i) => i.id.toString() === selectedIngredientId,
        );

        if (!ingredient) return;

        // Para sabores de pizza, verificar se já existe ficha para este tamanho específico
        const isSaborPizza = data.product_category === 'sabor_pizza';
        const existingIndex = data.recipe.findIndex((item) => {
            if (isSaborPizza && selectedSize) {
                // Sabor pizza: verificar ingrediente E tamanho
                return (
                    item.ingredient_id === ingredient.id &&
                    item.size === selectedSize
                );
            }
            // Outros produtos: apenas ingrediente
            return item.ingredient_id === ingredient.id;
        });

        if (existingIndex >= 0) {
            // Atualizar quantidade
            const newRecipe = [...data.recipe];
            newRecipe[existingIndex].qty = parseFloat(ingredientQty);
            setData('recipe', newRecipe);
        } else {
            // Adicionar novo
            const newItem: TechnicalSheetItem = {
                ingredient_id: ingredient.id,
                ingredient_name: ingredient.name,
                ingredient_unit: ingredient.unit,
                ingredient_price: parseFloat(ingredient.unit_price),
                qty: parseFloat(ingredientQty),
            };

            // Adicionar tamanho se for sabor de pizza
            if (isSaborPizza && selectedSize) {
                newItem.size = selectedSize;
            }

            setData('recipe', [...data.recipe, newItem]);
        }

        setSelectedIngredientId('');
        setIngredientQty('');
        setSelectedSize('');
    };

    const removeIngredientFromRecipe = (
        ingredientId: number,
        size?: string,
    ) => {
        setData(
            'recipe',
            data.recipe.filter((item) => {
                if (data.product_category === 'sabor_pizza' && size) {
                    // Sabor pizza: remover apenas a ficha específica do tamanho
                    return !(
                        item.ingredient_id === ingredientId &&
                        item.size === size
                    );
                }
                // Outros produtos: remover todas as ocorrências do ingrediente
                return item.ingredient_id !== ingredientId;
            }),
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

        // Se tem produto E não é duplicação, então é edição
        const isDuplicate =
            product &&
            '_isDuplicate' in product &&
            (product as { _isDuplicate?: boolean })._isDuplicate;

        if (product && !isDuplicate) {
            put(`/products/${product.id}`, {
                onSuccess: () => {
                    toast.success('Produto atualizado com sucesso!');
                    onOpenChange(false);
                    reset();
                },
                onError: () => {
                    toast.error('Erro ao atualizar produto');
                },
            });
        } else {
            // Criar novo produto (tanto para novo quanto para duplicação)
            post('/products', {
                onSuccess: () => {
                    toast.success('Produto criado com sucesso!');
                    onOpenChange(false);
                    reset();
                },
                onError: () => {
                    toast.error('Erro ao criar produto');
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
            <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto sm:max-w-xl">
                {loadingProduct ? (
                    <div className="flex items-center justify-center p-8">
                        <div className="text-center">
                            <div className="mb-2 text-sm text-muted-foreground">
                                Carregando produto...
                            </div>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="px-2">
                        <DialogHeader>
                            <DialogTitle>
                                {product && !('_isDuplicate' in product)
                                    ? 'Editar Produto'
                                    : 'Novo Produto'}
                            </DialogTitle>
                            <DialogDescription>
                                {product && !('_isDuplicate' in product)
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

                                {/* Tipo e Categoria */}
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
                                            <SelectTrigger className="w-full">
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
                                        <Label htmlFor="product_category">
                                            Categoria de Produto
                                        </Label>
                                        <Select
                                            value={
                                                data.product_category || 'none'
                                            }
                                            onValueChange={(value) =>
                                                setData(
                                                    'product_category',
                                                    value === 'none'
                                                        ? ''
                                                        : value,
                                                )
                                            }
                                        >
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder="Selecione a categoria" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">
                                                    Nenhuma
                                                </SelectItem>
                                                <SelectItem value="pizza">
                                                    Pizza
                                                </SelectItem>
                                                <SelectItem value="sabor_pizza">
                                                    Sabor de Pizza
                                                </SelectItem>
                                                <SelectItem value="bebida">
                                                    Bebida
                                                </SelectItem>
                                                <SelectItem value="sobremesa">
                                                    Sobremesa
                                                </SelectItem>
                                                <SelectItem value="entrada">
                                                    Entrada
                                                </SelectItem>
                                                <SelectItem value="outro">
                                                    Outro
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                        {errors.product_category && (
                                            <p className="text-sm text-red-500">
                                                {errors.product_category}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Tamanho e Quantidade de Sabores (apenas para pizzas) */}
                                {data.product_category === 'pizza' && (
                                    <div className="grid grid-cols-2 gap-4">
                                        {/* Tamanho */}
                                        <div className="grid gap-2">
                                            <Label htmlFor="size">
                                                Tamanho
                                            </Label>
                                            <Select
                                                value={data.size || 'none'}
                                                onValueChange={(value) =>
                                                    setData(
                                                        'size',
                                                        value === 'none'
                                                            ? ''
                                                            : value,
                                                    )
                                                }
                                            >
                                                <SelectTrigger
                                                    id="size"
                                                    className="w-full"
                                                >
                                                    <SelectValue placeholder="Selecione o tamanho" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">
                                                        Nenhum
                                                    </SelectItem>
                                                    <SelectItem value="broto">
                                                        Broto
                                                    </SelectItem>
                                                    <SelectItem value="media">
                                                        Média
                                                    </SelectItem>
                                                    <SelectItem value="grande">
                                                        Grande
                                                    </SelectItem>
                                                    <SelectItem value="familia">
                                                        Família
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                            {errors.size && (
                                                <p className="text-sm text-red-500">
                                                    {errors.size}
                                                </p>
                                            )}
                                        </div>

                                        {/* Quantidade de Sabores */}
                                        <div className="grid gap-2">
                                            <div className="flex items-center gap-1.5">
                                                <Label htmlFor="max_flavors">
                                                    Quantidade de Sabores
                                                </Label>
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Info className="h-3.5 w-3.5 cursor-help text-muted-foreground" />
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p>
                                                                Fração
                                                                automática: 1/
                                                                {
                                                                    data.max_flavors
                                                                }{' '}
                                                                ={' '}
                                                                {(
                                                                    (1 /
                                                                        data.max_flavors) *
                                                                    100
                                                                ).toFixed(1)}
                                                                % por sabor
                                                            </p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            </div>
                                            <Input
                                                id="max_flavors"
                                                type="number"
                                                min="1"
                                                max="10"
                                                value={data.max_flavors}
                                                onChange={(e) =>
                                                    setData(
                                                        'max_flavors',
                                                        parseInt(
                                                            e.target.value,
                                                        ) || 1,
                                                    )
                                                }
                                            />
                                            {errors.max_flavors && (
                                                <p className="text-sm text-red-500">
                                                    {errors.max_flavors}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Unidade */}
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
                                        <SelectTrigger className="w-full">
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

                                {/* Categoria Fiscal */}
                                <div className="grid gap-2">
                                    <Label htmlFor="tax_category_id">
                                        Categoria Fiscal
                                    </Label>
                                    <Select
                                        value={data.tax_category_id || 'none'}
                                        onValueChange={(value) =>
                                            setData(
                                                'tax_category_id',
                                                value === 'none' ? '' : value,
                                            )
                                        }
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Selecione uma categoria fiscal" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">
                                                Sem categoria
                                            </SelectItem>
                                            {availableTaxCategories.map(
                                                (category) => (
                                                    <SelectItem
                                                        key={category.id}
                                                        value={category.id.toString()}
                                                    >
                                                        {category.name} (
                                                        {category.total_tax_rate.toFixed(
                                                            2,
                                                        )}
                                                        %)
                                                    </SelectItem>
                                                ),
                                            )}
                                        </SelectContent>
                                    </Select>
                                    {errors.tax_category_id && (
                                        <p className="text-sm text-red-500">
                                            {errors.tax_category_id}
                                        </p>
                                    )}
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

                                {/* Usar como Insumo */}
                                <div className="flex items-center justify-between space-x-2">
                                    <div className="space-y-0.5">
                                        <Label
                                            htmlFor="is_ingredient"
                                            className="cursor-pointer"
                                        >
                                            Usar como Insumo
                                        </Label>
                                        <p className="text-sm text-muted-foreground">
                                            Permite usar este produto na
                                            composição de outros produtos
                                        </p>
                                    </div>
                                    <Switch
                                        id="is_ingredient"
                                        checked={data.is_ingredient}
                                        onCheckedChange={(checked) =>
                                            setData('is_ingredient', checked)
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
                                        {data.product_category ===
                                            'sabor_pizza' && (
                                            <Select
                                                value={selectedSize}
                                                onValueChange={setSelectedSize}
                                            >
                                                <SelectTrigger className="w-32">
                                                    <SelectValue placeholder="Tamanho" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="broto">
                                                        Broto
                                                    </SelectItem>
                                                    <SelectItem value="media">
                                                        Média
                                                    </SelectItem>
                                                    <SelectItem value="grande">
                                                        Grande
                                                    </SelectItem>
                                                    <SelectItem value="familia">
                                                        Família
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                        )}
                                        <Input
                                            type="number"
                                            step="0.001"
                                            value={ingredientQty}
                                            onChange={(e) =>
                                                setIngredientQty(e.target.value)
                                            }
                                            placeholder="Qtd"
                                            className=""
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
                                    data.product_category === 'sabor_pizza' ? (
                                        // Visualização agrupada por tamanho para sabores de pizza
                                        <div className="space-y-4">
                                            {(() => {
                                                // Agrupar ingredientes por tamanho
                                                const grouped =
                                                    data.recipe.reduce(
                                                        (acc, item) => {
                                                            const size =
                                                                item.size ||
                                                                'Sem tamanho';
                                                            if (!acc[size]) {
                                                                acc[size] = [];
                                                            }
                                                            acc[size].push(
                                                                item,
                                                            );
                                                            return acc;
                                                        },
                                                        {} as Record<
                                                            string,
                                                            TechnicalSheetItem[]
                                                        >,
                                                    );

                                                const sizeOrder = [
                                                    'broto',
                                                    'media',
                                                    'grande',
                                                    'familia',
                                                ];
                                                const sortedSizes = Object.keys(
                                                    grouped,
                                                ).sort(
                                                    (a, b) =>
                                                        sizeOrder.indexOf(a) -
                                                        sizeOrder.indexOf(b),
                                                );

                                                return sortedSizes.map(
                                                    (size) => {
                                                        const items =
                                                            grouped[size];
                                                        const subtotal =
                                                            items.reduce(
                                                                (sum, item) =>
                                                                    sum +
                                                                    item.qty *
                                                                        item.ingredient_price,
                                                                0,
                                                            );
                                                        const sizeLabel =
                                                            size
                                                                .charAt(0)
                                                                .toUpperCase() +
                                                            size.slice(1);

                                                        return (
                                                            <div
                                                                key={size}
                                                                className="rounded-md border"
                                                            >
                                                                <div className="flex items-center gap-2 bg-muted/50 px-4 py-2 font-semibold">
                                                                    <span className="inline-flex rounded-md bg-purple-100 px-2 py-1 text-xs font-medium text-purple-700">
                                                                        {
                                                                            sizeLabel
                                                                        }
                                                                    </span>
                                                                    <span className="text-sm text-muted-foreground">
                                                                        {
                                                                            items.length
                                                                        }{' '}
                                                                        {items.length ===
                                                                        1
                                                                            ? 'insumo'
                                                                            : 'insumos'}
                                                                    </span>
                                                                </div>
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
                                                                                Custo
                                                                                Unit.
                                                                            </TableHead>
                                                                            <TableHead className="text-right">
                                                                                Custo
                                                                                Total
                                                                            </TableHead>
                                                                            <TableHead className="w-[50px]"></TableHead>
                                                                        </TableRow>
                                                                    </TableHeader>
                                                                    <TableBody>
                                                                        {items.map(
                                                                            (
                                                                                item,
                                                                                idx,
                                                                            ) => (
                                                                                <TableRow
                                                                                    key={`${item.ingredient_id}-${size}-${idx}`}
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
                                                                                        ).toFixed(
                                                                                            4,
                                                                                        )}
                                                                                    </TableCell>
                                                                                    <TableCell>
                                                                                        <Button
                                                                                            type="button"
                                                                                            variant="ghost"
                                                                                            size="sm"
                                                                                            onClick={() =>
                                                                                                removeIngredientFromRecipe(
                                                                                                    item.ingredient_id,
                                                                                                    item.size,
                                                                                                )
                                                                                            }
                                                                                        >
                                                                                            <Trash2 className="h-4 w-4 text-red-600" />
                                                                                        </Button>
                                                                                    </TableCell>
                                                                                </TableRow>
                                                                            ),
                                                                        )}
                                                                        <TableRow className="bg-muted/30">
                                                                            <TableCell
                                                                                colSpan={
                                                                                    3
                                                                                }
                                                                                className="text-sm font-semibold"
                                                                            >
                                                                                Subtotal{' '}
                                                                                {
                                                                                    sizeLabel
                                                                                }
                                                                            </TableCell>
                                                                            <TableCell className="text-right font-semibold">
                                                                                R${' '}
                                                                                {subtotal.toFixed(
                                                                                    4,
                                                                                )}
                                                                            </TableCell>
                                                                            <TableCell></TableCell>
                                                                        </TableRow>
                                                                    </TableBody>
                                                                </Table>
                                                            </div>
                                                        );
                                                    },
                                                );
                                            })()}
                                            <div className="rounded-md border bg-muted/50 px-4 py-3">
                                                <div className="flex items-center justify-between">
                                                    <span className="font-semibold">
                                                        CMV Total (Todos os
                                                        Tamanhos)
                                                    </span>
                                                    <span className="text-lg font-bold">
                                                        R${' '}
                                                        {calculateCMV().toFixed(
                                                            4,
                                                        )}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        // Visualização padrão para outros produtos
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
                                                    {data.recipe.map(
                                                        (item, idx) => (
                                                            <TableRow
                                                                key={`${item.ingredient_id}-${idx}`}
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
                                                                    ).toFixed(
                                                                        4,
                                                                    )}
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
                                                        ),
                                                    )}
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
                                    )
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

                        {/* Switch para atualizar pedidos existentes - apenas na edição */}
                        {product && !('_isDuplicate' in product) && (
                            <div className="mt-4 flex items-center justify-between space-x-2 rounded-md border border-amber-200 bg-amber-50 p-3">
                                <Label
                                    htmlFor="update_existing_orders"
                                    className="text-sm font-normal"
                                >
                                    Atualizar custos dos pedidos existentes com
                                    este produto
                                </Label>
                                <Switch
                                    id="update_existing_orders"
                                    checked={data.update_existing_orders}
                                    onCheckedChange={(checked) =>
                                        setData(
                                            'update_existing_orders',
                                            checked,
                                        )
                                    }
                                />
                            </div>
                        )}

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
                                    : product && !('_isDuplicate' in product)
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
