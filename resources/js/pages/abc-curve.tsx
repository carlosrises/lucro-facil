import { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import { IconSearch } from '@tabler/icons-react';

import AppLayout from '@/layouts/app-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { DateRangePicker } from '@/components/date-range-picker';
import { type BreadcrumbItem, type DateRange } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Curva ABC',
        href: '/abc-curve',
    },
];

type Product = {
    id: number;
    name: string;
    sku: string | null;
    quantity: number;
    revenue: number;
    profit: number;
    cost: number;
    order_count: number;
    percentage: number;
    curve: 'A' | 'B' | 'C';
};

type CurveMetrics = {
    quantity: number;
    revenue: number;
    count: number;
};

type AbcCurveProps = {
    products: Product[];
    metrics: {
        curveA: CurveMetrics;
        curveB: CurveMetrics;
        curveC: CurveMetrics;
        total: CurveMetrics;
    };
    filters: {
        start_date: string;
        end_date: string;
    };
};

export default function AbcCurve({ products, metrics, filters }: AbcCurveProps) {
    const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
        if (filters.start_date && filters.end_date) {
            return {
                from: new Date(filters.start_date + 'T12:00:00'),
                to: new Date(filters.end_date + 'T12:00:00'),
            };
        }
        return undefined;
    });

    const [search, setSearch] = useState('');
    const [curveFilter, setCurveFilter] = useState<string>('all');

    const handleDateRangeChange = (range: DateRange | undefined) => {
        setDateRange(range);
        router.get(
            '/abc-curve',
            {
                start_date: range?.from
                    ? range.from.toISOString().split('T')[0]
                    : undefined,
                end_date: range?.to
                    ? range.to.toISOString().split('T')[0]
                    : undefined,
            },
            {
                preserveState: true,
                preserveScroll: true,
            },
        );
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
        }).format(value);
    };

    const formatNumber = (value: number) => {
        return new Intl.NumberFormat('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(value);
    };

    // Filtrar produtos
    const filteredProducts = products.filter((product) => {
        const matchesSearch =
            product.name.toLowerCase().includes(search.toLowerCase()) ||
            product.sku?.toLowerCase().includes(search.toLowerCase());
        const matchesCurve =
            curveFilter === 'all' || product.curve === curveFilter;
        return matchesSearch && matchesCurve;
    });

    const getCurveBadgeColor = (curve: string) => {
        switch (curve) {
            case 'A':
                return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            case 'B':
                return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'C':
                return 'bg-orange-100 text-orange-700 border-orange-200';
            default:
                return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Curva ABC" />

            <div className="flex flex-1 flex-col">
                <div className="@container/main flex flex-1 flex-col gap-2">
                    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                        {/* Filtros de Período */}
                        <div className="flex items-center justify-between gap-4 px-4 lg:px-6">
                            <h1 className="text-2xl font-semibold">Curva ABC</h1>
                            <DateRangePicker
                                value={dateRange}
                                onChange={handleDateRangeChange}
                            />
                        </div>

                        {/* Cards de Curvas */}
                        <div className="grid grid-cols-1 gap-4 px-4 md:grid-cols-2 lg:grid-cols-4 lg:px-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">
                                        Curva A
                                    </CardTitle>
                                    <CardDescription>
                                        {metrics.curveA.count} produtos (
                                        {(
                                            (metrics.curveA.count /
                                                metrics.total.count) *
                                            100
                                        ).toFixed(1)}
                                        %)
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                            Unidades vendidas
                                        </span>
                                        <span className="font-medium">
                                            {formatNumber(
                                                metrics.curveA.quantity,
                                            )}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                            Faturamento
                                        </span>
                                        <span className="font-medium">
                                            {formatCurrency(
                                                metrics.curveA.revenue,
                                            )}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-xs text-muted-foreground">
                                        <span>% do total</span>
                                        <span>
                                            {(
                                                (metrics.curveA.revenue /
                                                    metrics.total.revenue) *
                                                100
                                            ).toFixed(1)}
                                            %
                                        </span>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">
                                        Curva B
                                    </CardTitle>
                                    <CardDescription>
                                        {metrics.curveB.count} produtos (
                                        {(
                                            (metrics.curveB.count /
                                                metrics.total.count) *
                                            100
                                        ).toFixed(1)}
                                        %)
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                            Unidades vendidas
                                        </span>
                                        <span className="font-medium">
                                            {formatNumber(
                                                metrics.curveB.quantity,
                                            )}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                            Faturamento
                                        </span>
                                        <span className="font-medium">
                                            {formatCurrency(
                                                metrics.curveB.revenue,
                                            )}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-xs text-muted-foreground">
                                        <span>% do total</span>
                                        <span>
                                            {(
                                                (metrics.curveB.revenue /
                                                    metrics.total.revenue) *
                                                100
                                            ).toFixed(1)}
                                            %
                                        </span>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">
                                        Curva C
                                    </CardTitle>
                                    <CardDescription>
                                        {metrics.curveC.count} produtos (
                                        {(
                                            (metrics.curveC.count /
                                                metrics.total.count) *
                                            100
                                        ).toFixed(1)}
                                        %)
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                            Unidades vendidas
                                        </span>
                                        <span className="font-medium">
                                            {formatNumber(
                                                metrics.curveC.quantity,
                                            )}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                            Faturamento
                                        </span>
                                        <span className="font-medium">
                                            {formatCurrency(
                                                metrics.curveC.revenue,
                                            )}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-xs text-muted-foreground">
                                        <span>% do total</span>
                                        <span>
                                            {(
                                                (metrics.curveC.revenue /
                                                    metrics.total.revenue) *
                                                100
                                            ).toFixed(1)}
                                            %
                                        </span>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">
                                        Total
                                    </CardTitle>
                                    <CardDescription>
                                        {metrics.total.count} produtos
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                            Unidades vendidas
                                        </span>
                                        <span className="font-medium">
                                            {formatNumber(
                                                metrics.total.quantity,
                                            )}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                            Faturamento
                                        </span>
                                        <span className="font-medium">
                                            {formatCurrency(
                                                metrics.total.revenue,
                                            )}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-xs text-muted-foreground">
                                        <span>Ticket médio</span>
                                        <span>
                                            {formatCurrency(
                                                metrics.total.revenue /
                                                    metrics.total.quantity,
                                            )}
                                        </span>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Filtros da Tabela */}
                        <div className="flex flex-col gap-4 px-4 lg:px-6 md:flex-row md:items-center md:justify-between">
                            <div className="relative flex-1 max-w-sm">
                                <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    placeholder="Pesquisar produto..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                            <div className="flex gap-2">
                                <Select
                                    value={curveFilter}
                                    onValueChange={setCurveFilter}
                                >
                                    <SelectTrigger className="w-[140px]">
                                        <SelectValue placeholder="Todas curvas" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">
                                            Todas
                                        </SelectItem>
                                        <SelectItem value="A">
                                            Curva A
                                        </SelectItem>
                                        <SelectItem value="B">
                                            Curva B
                                        </SelectItem>
                                        <SelectItem value="C">
                                            Curva C
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Tabela de Produtos */}
                        <div className="px-4 lg:px-6">
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Item</TableHead>
                                            <TableHead className="text-right">
                                                Unid
                                            </TableHead>
                                            <TableHead className="text-right">
                                                Total
                                            </TableHead>
                                            <TableHead className="text-right">
                                                Lucro
                                            </TableHead>
                                            <TableHead className="text-right">
                                                % Faturamento
                                            </TableHead>
                                            <TableHead className="text-right">
                                                Pedidos
                                            </TableHead>
                                            <TableHead className="text-center">
                                                Curva
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredProducts.length === 0 ? (
                                            <TableRow>
                                                <TableCell
                                                    colSpan={7}
                                                    className="text-center text-muted-foreground"
                                                >
                                                    Nenhum produto encontrado
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            filteredProducts.map((product) => (
                                                <TableRow key={product.id}>
                                                    <TableCell>
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex h-10 w-10 items-center justify-center rounded bg-muted text-xs font-medium">
                                                                {product.name
                                                                    .charAt(0)
                                                                    .toUpperCase()}
                                                            </div>
                                                            <div>
                                                                <div className="font-medium">
                                                                    {
                                                                        product.name
                                                                    }
                                                                </div>
                                                                {product.sku && (
                                                                    <div className="text-xs text-muted-foreground">
                                                                        SKU:{' '}
                                                                        {
                                                                            product.sku
                                                                        }
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {formatNumber(
                                                            product.quantity,
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right font-medium">
                                                        {formatCurrency(
                                                            product.revenue,
                                                        )}
                                                    </TableCell>
                                                    <TableCell
                                                        className={`text-right font-medium ${
                                                            product.profit >= 0
                                                                ? 'text-emerald-600'
                                                                : 'text-red-600'
                                                        }`}
                                                    >
                                                        {formatCurrency(
                                                            product.profit,
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {product.percentage.toFixed(
                                                            2,
                                                        )}
                                                        %
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {product.order_count}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <Badge
                                                            variant="outline"
                                                            className={getCurveBadgeColor(
                                                                product.curve,
                                                            )}
                                                        >
                                                            {product.curve}
                                                        </Badge>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
