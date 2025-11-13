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
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { ArrowLeft, Calculator } from 'lucide-react';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Cadastros',
        href: '#',
    },
    {
        title: 'Produtos',
        href: '/products',
    },
    {
        title: 'Ficha Técnica',
        href: '#',
    },
];

interface ProductCost {
    id: number;
    qty: number;
    ingredient: {
        id: number;
        name: string;
        unit: string;
        unit_price: string;
    };
}

interface Product {
    id: number;
    name: string;
    sku: string | null;
    type: string;
    unit: string;
    unit_cost: string;
    sale_price: string;
    active: boolean;
    costs: ProductCost[];
}

interface ShowProductProps {
    product: Product;
    marginSettings: {
        margin_excellent: number;
        margin_good_min: number;
        margin_good_max: number;
        margin_poor: number;
    };
}

const typeLabels: Record<string, string> = {
    product: 'Produto',
    service: 'Serviço',
};

const unitLabels: Record<string, string> = {
    unit: 'Unidade',
    kg: 'Quilograma',
    g: 'Grama',
    l: 'Litro',
    ml: 'Mililitro',
    hour: 'Hora',
};

export default function ShowProduct({
    product,
    marginSettings,
}: ShowProductProps) {
    const calculateCMV = () => {
        return product.costs.reduce((total, cost) => {
            return total + parseFloat(cost.ingredient.unit_price) * cost.qty;
        }, 0);
    };

    const cmv = calculateCMV();
    const salePrice = parseFloat(product.sale_price);
    const margin = cmv > 0 ? ((salePrice - cmv) / cmv) * 100 : 0;

    // Determina a variante do badge baseado nas configurações
    let marginVariant: 'default' | 'warning' | 'destructive' = 'default';
    if (margin <= marginSettings.margin_poor) {
        marginVariant = 'destructive'; // Vermelho - margem ruim
    } else if (margin >= marginSettings.margin_excellent) {
        marginVariant = 'default'; // Verde - margem excelente
    } else {
        marginVariant = 'warning'; // Laranja - margem boa
    }

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Ficha Técnica - ${product.name}`} />

            <div className="flex flex-1 flex-col">
                <div className="@container/main flex flex-1 flex-col gap-2">
                    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                        <div className="flex w-full flex-col gap-4 px-4 lg:px-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={() => router.get('/products')}
                                    >
                                        <ArrowLeft className="h-4 w-4" />
                                    </Button>
                                    <div>
                                        <h1 className="text-2xl font-bold">
                                            Ficha Técnica
                                        </h1>
                                        <p className="text-muted-foreground">
                                            {product.name}
                                        </p>
                                    </div>
                                </div>
                                <Badge
                                    variant={
                                        product.active ? 'default' : 'secondary'
                                    }
                                >
                                    {product.active ? 'Ativo' : 'Inativo'}
                                </Badge>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>
                                            Informações do Produto
                                        </CardTitle>
                                        <CardDescription>
                                            Dados cadastrais do produto
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-sm font-medium text-muted-foreground">
                                                    Nome
                                                </p>
                                                <p className="text-sm">
                                                    {product.name}
                                                </p>
                                            </div>
                                            {product.sku && (
                                                <div>
                                                    <p className="text-sm font-medium text-muted-foreground">
                                                        SKU
                                                    </p>
                                                    <p className="text-sm">
                                                        {product.sku}
                                                    </p>
                                                </div>
                                            )}
                                            <div>
                                                <p className="text-sm font-medium text-muted-foreground">
                                                    Tipo
                                                </p>
                                                <p className="text-sm">
                                                    {typeLabels[product.type]}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-muted-foreground">
                                                    Unidade
                                                </p>
                                                <p className="text-sm">
                                                    {unitLabels[product.unit]}
                                                </p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Calculator className="h-5 w-5" />
                                            Custos e Preços
                                        </CardTitle>
                                        <CardDescription>
                                            Análise financeira do produto
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-sm font-medium text-muted-foreground">
                                                    CMV (Custo)
                                                </p>
                                                <p className="text-lg font-semibold">
                                                    {new Intl.NumberFormat(
                                                        'pt-BR',
                                                        {
                                                            style: 'currency',
                                                            currency: 'BRL',
                                                        },
                                                    ).format(cmv)}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-muted-foreground">
                                                    Preço de Venda
                                                </p>
                                                <p className="text-lg font-semibold">
                                                    {new Intl.NumberFormat(
                                                        'pt-BR',
                                                        {
                                                            style: 'currency',
                                                            currency: 'BRL',
                                                        },
                                                    ).format(salePrice)}
                                                </p>
                                            </div>
                                            <div className="col-span-2">
                                                <p className="text-sm font-medium text-muted-foreground">
                                                    Margem de Lucro
                                                </p>
                                                <Badge
                                                    variant={marginVariant}
                                                    className="text-base font-semibold"
                                                >
                                                    {margin.toFixed(1)}%
                                                </Badge>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Insumos da Receita</CardTitle>
                                    <CardDescription>
                                        Ingredientes e quantidades utilizadas
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {product.costs.length > 0 ? (
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
                                                            Preço Unitário
                                                        </TableHead>
                                                        <TableHead className="text-right">
                                                            Subtotal
                                                        </TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {product.costs.map(
                                                        (cost) => {
                                                            const unitPrice =
                                                                parseFloat(
                                                                    cost
                                                                        .ingredient
                                                                        .unit_price,
                                                                );
                                                            const subtotal =
                                                                unitPrice *
                                                                cost.qty;
                                                            return (
                                                                <TableRow
                                                                    key={
                                                                        cost.id
                                                                    }
                                                                >
                                                                    <TableCell className="font-medium">
                                                                        {
                                                                            cost
                                                                                .ingredient
                                                                                .name
                                                                        }
                                                                    </TableCell>
                                                                    <TableCell className="text-right">
                                                                        {
                                                                            cost.qty
                                                                        }{' '}
                                                                        {
                                                                            unitLabels[
                                                                                cost
                                                                                    .ingredient
                                                                                    .unit
                                                                            ]
                                                                        }
                                                                    </TableCell>
                                                                    <TableCell className="text-right">
                                                                        {new Intl.NumberFormat(
                                                                            'pt-BR',
                                                                            {
                                                                                style: 'currency',
                                                                                currency:
                                                                                    'BRL',
                                                                            },
                                                                        ).format(
                                                                            unitPrice,
                                                                        )}
                                                                    </TableCell>
                                                                    <TableCell className="text-right">
                                                                        {new Intl.NumberFormat(
                                                                            'pt-BR',
                                                                            {
                                                                                style: 'currency',
                                                                                currency:
                                                                                    'BRL',
                                                                            },
                                                                        ).format(
                                                                            subtotal,
                                                                        )}
                                                                    </TableCell>
                                                                </TableRow>
                                                            );
                                                        },
                                                    )}
                                                    <TableRow className="bg-muted/50 font-medium">
                                                        <TableCell
                                                            colSpan={3}
                                                            className="text-right"
                                                        >
                                                            Total CMV
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            {new Intl.NumberFormat(
                                                                'pt-BR',
                                                                {
                                                                    style: 'currency',
                                                                    currency:
                                                                        'BRL',
                                                                },
                                                            ).format(cmv)}
                                                        </TableCell>
                                                    </TableRow>
                                                </TableBody>
                                            </Table>
                                        </div>
                                    ) : (
                                        <div className="flex h-40 items-center justify-center rounded-md border border-dashed">
                                            <p className="text-sm text-muted-foreground">
                                                Nenhum insumo cadastrado na
                                                receita
                                            </p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
