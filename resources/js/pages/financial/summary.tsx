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
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { MonthYearPicker } from '@/components/ui/month-year-picker';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import {
    ChevronDown,
    DollarSign,
    Download,
    MinusCircle,
    PlusCircle,
    ShoppingCart,
    Store,
    TrendingUp,
    Wallet,
} from 'lucide-react';
import { useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Financeiro',
        href: '/financial/summary',
    },
    {
        title: 'Resumo (DRE)',
        href: '/financial/summary',
    },
];

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
});

interface BreakdownItem {
    name: string;
    value: number;
    percentage: number;
    stores?: BreakdownItem[];
    marketplaces?: BreakdownItem[];
}

interface BreakdownToggleProps {
    label: string;
    items: BreakdownItem[];
    className?: string;
}

const BreakdownToggle = ({ label, items, className }: BreakdownToggleProps) => {
    const [isOpen, setIsOpen] = useState(false);

    if (!items || items.length === 0) {
        return null;
    }

    return (
        <div className={className ?? ''}>
            <Collapsible
                open={isOpen}
                onOpenChange={setIsOpen}
                className="w-full"
            >
                <CollapsibleTrigger asChild>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="flex w-full items-center justify-between px-0 text-muted-foreground hover:text-foreground"
                    >
                        <span>{label}</span>
                        <ChevronDown
                            className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                        />
                    </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <div className="space-y-2 pt-3">
                        {items.map((item, index) => (
                            <div
                                key={`${label}-${item.name}-${index}`}
                                className="flex items-center justify-between text-sm"
                            >
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline">
                                        {item.percentage.toFixed(1)}%
                                    </Badge>
                                    <span className="font-medium">
                                        {item.name}
                                    </span>
                                </div>
                                <span className="font-semibold">
                                    {currencyFormatter.format(item.value)}
                                </span>
                            </div>
                        ))}
                    </div>
                </CollapsibleContent>
            </Collapsible>
        </div>
    );
};

interface SummaryData {
    // Receitas
    grossRevenue: number;
    revenueByMarketplace: BreakdownItem[];
    revenueByStore: BreakdownItem[];

    // Deduções
    paymentFees: number;
    paymentFeesPercent: number;
    paymentFeesBreakdown: BreakdownItem[];
    commissions: number;
    commissionsPercent: number;
    commissionsBreakdown: BreakdownItem[];
    discounts: number;
    discountsPercent: number;
    discountsBreakdown: BreakdownItem[];
    subsidies: number;
    subsidiesPercent: number;
    subsidiesBreakdown: BreakdownItem[];

    // Resultado Intermediário
    revenueAfterDeductions: number;
    revenueAfterDeductionsPercent: number;

    // Custos
    cmv: number;
    cmvPercent: number;
    orderCosts: number; // Despesas Operacionais
    orderCostsPercent: number;
    orderCostsBreakdown: BreakdownItem[];
    taxes: number;
    taxesPercent: number;
    taxesBreakdown: BreakdownItem[];

    // Margem
    contributionMargin: number;
    contributionMarginPercent: number;

    // Movimentações Financeiras
    extraIncome: number;
    extraIncomePercent: number;
    extraIncomeBreakdown: BreakdownItem[];
    extraExpenses: number;
    extraExpensesPercent: number;
    extraExpensesBreakdown: BreakdownItem[];

    // Resultado Final
    netProfit: number;
    netProfitPercent: number;
}

interface SummaryProps {
    data: SummaryData;
    filters: {
        month: string;
    };
    [key: string]: unknown;
}

export default function FinancialSummary() {
    const { data, filters } = usePage<SummaryProps>().props;

    const handleMonthChange = (month: string) => {
        router.get(
            '/financial/summary',
            { month },
            {
                preserveState: true,
                preserveScroll: true,
            },
        );
    };

    const handleExportPDF = () => {
        window.print();
    };

    return (
        <>
            <style>{`
                @media print {
                    @page {
                        size: A4;
                        margin: 2cm;
                    }
                    body {
                        print-color-adjust: exact;
                        -webkit-print-color-adjust: exact;
                    }
                    .no-print {
                        display: none !important;
                    }
                }
            `}</style>
            <AppLayout breadcrumbs={breadcrumbs}>
                <Head title="Resumo (DRE)" />

                <div className="flex flex-1 flex-col">
                    <div className="@container/main flex flex-1 flex-col gap-2">
                        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                            <div className="flex w-full flex-col gap-6 px-6 lg:px-8">
                                {/* Filtro de Mês e Botão PDF */}
                                <div className="no-print flex items-center justify-between gap-4">
                                    <MonthYearPicker
                                        value={filters.month}
                                        onChange={handleMonthChange}
                                        placeholder="Selecione o mês"
                                        className="w-[240px]"
                                    />
                                    <Button
                                        onClick={handleExportPDF}
                                        variant="outline"
                                        className="gap-2"
                                    >
                                        <Download className="h-4 w-4" />
                                        Salvar em PDF
                                    </Button>
                                </div>

                                {/* Container dos Cards com largura máxima */}
                                <div className="mx-auto w-full max-w-4xl space-y-6">
                                    {/* 1. FATURAMENTO */}
                                    <Card>
                                        <CardHeader className="px-6">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <ShoppingCart className="h-5 w-5 text-blue-600" />
                                                    <CardTitle>
                                                        Faturamento
                                                    </CardTitle>
                                                </div>
                                                <Badge
                                                    variant="secondary"
                                                    className="text-lg font-semibold"
                                                >
                                                    {new Intl.NumberFormat(
                                                        'pt-BR',
                                                        {
                                                            style: 'currency',
                                                            currency: 'BRL',
                                                        },
                                                    ).format(data.grossRevenue)}
                                                </Badge>
                                            </div>
                                            <CardDescription>
                                                Faturamento total dos pedidos
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="px-6">
                                            <div className="space-y-3">
                                                {data.revenueByStore.map(
                                                    (store) => {
                                                        const hasMarketplaces =
                                                            (store.marketplaces
                                                                ?.length ?? 0) >
                                                            0;

                                                        return (
                                                            <Collapsible
                                                                key={store.name}
                                                                className="rounded-md border border-transparent px-3 py-2 transition data-[state=open]:bg-muted/40"
                                                            >
                                                                <div className="flex items-start justify-between gap-3">
                                                                    <div className="flex flex-1 items-center gap-3">
                                                                        <Store className="mt-0.5 h-4 w-4 text-muted-foreground" />
                                                                        <div className="flex flex-col">
                                                                            <div className="flex flex-wrap items-center gap-2">
                                                                                <span className="font-medium">
                                                                                    {
                                                                                        store.name
                                                                                    }
                                                                                </span>
                                                                                <Badge variant="outline">
                                                                                    {store.percentage.toFixed(
                                                                                        1,
                                                                                    )}

                                                                                    %
                                                                                </Badge>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="font-semibold">
                                                                            {currencyFormatter.format(
                                                                                store.value,
                                                                            )}
                                                                        </span>
                                                                        {hasMarketplaces && (
                                                                            <CollapsibleTrigger className="ml-1 inline-flex h-7 w-7 items-center justify-center rounded-md border text-muted-foreground transition hover:text-foreground data-[state=open]:bg-muted data-[state=open]:[&>svg]:rotate-180">
                                                                                <ChevronDown className="h-4 w-4 transition-transform" />
                                                                            </CollapsibleTrigger>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                {hasMarketplaces && (
                                                                    <CollapsibleContent>
                                                                        <div className="mt-3 space-y-2 pl-7">
                                                                            {store.marketplaces?.map(
                                                                                (
                                                                                    marketplace,
                                                                                ) => (
                                                                                    <div
                                                                                        key={`${store.name}-${marketplace.name}`}
                                                                                        className="flex items-center justify-between text-sm text-muted-foreground"
                                                                                    >
                                                                                        <div className="flex items-center gap-2">
                                                                                            <Badge variant="outline">
                                                                                                {marketplace.percentage.toFixed(
                                                                                                    1,
                                                                                                )}

                                                                                                %
                                                                                            </Badge>
                                                                                            <span>
                                                                                                {
                                                                                                    marketplace.name
                                                                                                }
                                                                                            </span>
                                                                                        </div>
                                                                                        <span className="font-semibold text-foreground">
                                                                                            {currencyFormatter.format(
                                                                                                marketplace.value,
                                                                                            )}
                                                                                        </span>
                                                                                    </div>
                                                                                ),
                                                                            )}
                                                                        </div>
                                                                    </CollapsibleContent>
                                                                )}
                                                            </Collapsible>
                                                        );
                                                    },
                                                )}

                                                {/* Informação de Subsídio */}
                                                {data.subsidies > 0 && (
                                                    <div className="mt-4 border-t pt-4">
                                                        <div className="flex items-center justify-between text-sm">
                                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                                <PlusCircle className="h-4 w-4" />
                                                                <span>
                                                                    Subsídio
                                                                    incluso
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <Badge
                                                                    variant="outline"
                                                                    className="text-green-700"
                                                                >
                                                                    {data.subsidiesPercent.toFixed(
                                                                        1,
                                                                    )}
                                                                    %
                                                                </Badge>
                                                                <span className="font-semibold text-green-700">
                                                                    {new Intl.NumberFormat(
                                                                        'pt-BR',
                                                                        {
                                                                            style: 'currency',
                                                                            currency:
                                                                                'BRL',
                                                                        },
                                                                    ).format(
                                                                        data.subsidies,
                                                                    )}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                <BreakdownToggle
                                                    className="pt-4"
                                                    label="Subsídio por marketplace"
                                                    items={
                                                        data.subsidiesBreakdown
                                                    }
                                                />
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* 2. (-) TAXAS DE PAGAMENTO */}
                                    <Card className="border-l-4 border-l-amber-500">
                                        <CardHeader className="px-6">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <MinusCircle className="h-5 w-5 text-amber-600" />
                                                    <CardTitle>
                                                        (-) Taxas de Pagamento
                                                    </CardTitle>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Badge
                                                        variant="outline"
                                                        className="text-amber-700"
                                                    >
                                                        {data.paymentFeesPercent.toFixed(
                                                            1,
                                                        )}
                                                        %
                                                    </Badge>
                                                    <Badge
                                                        variant="secondary"
                                                        className="text-lg font-semibold text-amber-700"
                                                    >
                                                        {new Intl.NumberFormat(
                                                            'pt-BR',
                                                            {
                                                                style: 'currency',
                                                                currency: 'BRL',
                                                            },
                                                        ).format(
                                                            data.paymentFees,
                                                        )}
                                                    </Badge>
                                                </div>
                                            </div>
                                            <CardDescription>
                                                Taxas de meios de pagamento
                                            </CardDescription>
                                        </CardHeader>
                                        {data.paymentFeesBreakdown.length >
                                            0 && (
                                            <CardContent className="px-6 pt-0 pb-6">
                                                <BreakdownToggle
                                                    label="Detalhar taxas por meio de pagamento"
                                                    items={
                                                        data.paymentFeesBreakdown
                                                    }
                                                />
                                            </CardContent>
                                        )}
                                    </Card>

                                    {/* 3. (-) COMISSÃO MARKETPLACE */}
                                    <Card className="border-l-4 border-l-purple-500">
                                        <CardHeader className="px-6">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <MinusCircle className="h-5 w-5 text-purple-600" />
                                                    <CardTitle>
                                                        (-) Comissão Marketplace
                                                    </CardTitle>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Badge
                                                        variant="outline"
                                                        className="text-purple-700"
                                                    >
                                                        {data.commissionsPercent.toFixed(
                                                            1,
                                                        )}
                                                        %
                                                    </Badge>
                                                    <Badge
                                                        variant="secondary"
                                                        className="text-lg font-semibold text-purple-700"
                                                    >
                                                        {new Intl.NumberFormat(
                                                            'pt-BR',
                                                            {
                                                                style: 'currency',
                                                                currency: 'BRL',
                                                            },
                                                        ).format(
                                                            data.commissions,
                                                        )}
                                                    </Badge>
                                                </div>
                                            </div>
                                            <CardDescription>
                                                Comissões dos marketplaces
                                            </CardDescription>
                                        </CardHeader>
                                        {data.commissionsBreakdown.length >
                                            0 && (
                                            <CardContent className="px-6 pt-0 pb-6">
                                                <BreakdownToggle
                                                    label="Detalhar comissão por marketplace"
                                                    items={
                                                        data.commissionsBreakdown
                                                    }
                                                />
                                            </CardContent>
                                        )}
                                    </Card>

                                    {/* 4. (-) DESCONTOS */}
                                    <Card className="border-l-4 border-l-yellow-500">
                                        <CardHeader className="px-6">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <MinusCircle className="h-5 w-5 text-yellow-600" />
                                                    <CardTitle>
                                                        (-) Descontos
                                                    </CardTitle>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Badge
                                                        variant="outline"
                                                        className="text-yellow-700"
                                                    >
                                                        {data.discountsPercent.toFixed(
                                                            1,
                                                        )}
                                                        %
                                                    </Badge>
                                                    <Badge
                                                        variant="secondary"
                                                        className="text-lg font-semibold text-yellow-700"
                                                    >
                                                        {new Intl.NumberFormat(
                                                            'pt-BR',
                                                            {
                                                                style: 'currency',
                                                                currency: 'BRL',
                                                            },
                                                        ).format(
                                                            data.discounts,
                                                        )}
                                                    </Badge>
                                                </div>
                                            </div>
                                            <CardDescription>
                                                Descontos concedidos
                                            </CardDescription>
                                        </CardHeader>
                                        {data.discountsBreakdown.length > 0 && (
                                            <CardContent className="px-6 pt-0 pb-6">
                                                <BreakdownToggle
                                                    label="Detalhar descontos por marketplace"
                                                    items={
                                                        data.discountsBreakdown
                                                    }
                                                />
                                            </CardContent>
                                        )}
                                    </Card>

                                    {/* 5. (=) RECEITA PÓS DEDUÇÃO */}
                                    <Card className="border-2 border-emerald-500 bg-emerald-50/50">
                                        <CardHeader className="px-6">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <TrendingUp className="h-5 w-5 text-emerald-600" />
                                                    <CardTitle className="text-emerald-700">
                                                        (=) Receita pós Dedução
                                                    </CardTitle>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Badge
                                                        variant="outline"
                                                        className="border-emerald-600 text-emerald-700"
                                                    >
                                                        {data.revenueAfterDeductionsPercent.toFixed(
                                                            1,
                                                        )}
                                                        %
                                                    </Badge>
                                                    <Badge className="bg-emerald-600 text-lg font-bold">
                                                        {new Intl.NumberFormat(
                                                            'pt-BR',
                                                            {
                                                                style: 'currency',
                                                                currency: 'BRL',
                                                            },
                                                        ).format(
                                                            data.revenueAfterDeductions,
                                                        )}
                                                    </Badge>
                                                </div>
                                            </div>
                                            <CardDescription>
                                                Faturamento após dedução de
                                                taxas, comissões e descontos
                                            </CardDescription>
                                        </CardHeader>
                                    </Card>

                                    {/* 7. (-) CMV */}
                                    <Card className="border-l-4 border-l-red-500">
                                        <CardHeader className="px-6">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <MinusCircle className="h-5 w-5 text-red-600" />
                                                    <CardTitle>
                                                        (-) Custos da Mercadoria
                                                        Vendida
                                                    </CardTitle>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Badge
                                                        variant="outline"
                                                        className="text-red-700"
                                                    >
                                                        {data.cmvPercent.toFixed(
                                                            1,
                                                        )}
                                                        %
                                                    </Badge>
                                                    <Badge
                                                        variant="secondary"
                                                        className="text-lg font-semibold text-red-700"
                                                    >
                                                        {new Intl.NumberFormat(
                                                            'pt-BR',
                                                            {
                                                                style: 'currency',
                                                                currency: 'BRL',
                                                            },
                                                        ).format(data.cmv)}
                                                    </Badge>
                                                </div>
                                            </div>
                                            <CardDescription>
                                                Custo dos insumos e produtos
                                            </CardDescription>
                                        </CardHeader>
                                    </Card>

                                    {/* 8. (-) CUSTOS VARIÁVEIS */}
                                    <Card className="border-l-4 border-l-rose-500">
                                        <CardHeader className="px-6">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <MinusCircle className="h-5 w-5 text-rose-600" />
                                                    <CardTitle>
                                                        (-) Custos Variáveis
                                                    </CardTitle>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Badge
                                                        variant="outline"
                                                        className="text-rose-700"
                                                    >
                                                        {data.orderCostsPercent.toFixed(
                                                            1,
                                                        )}
                                                        %
                                                    </Badge>
                                                    <Badge
                                                        variant="secondary"
                                                        className="text-lg font-semibold text-rose-700"
                                                    >
                                                        {new Intl.NumberFormat(
                                                            'pt-BR',
                                                            {
                                                                style: 'currency',
                                                                currency: 'BRL',
                                                            },
                                                        ).format(
                                                            data.orderCosts,
                                                        )}
                                                    </Badge>
                                                </div>
                                            </div>
                                            <CardDescription>
                                                Custos variáveis dos pedidos
                                                (entrega, embalagens, etc)
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="px-6 pt-0 pb-6">
                                            <BreakdownToggle
                                                label="Detalhar custos variáveis"
                                                items={
                                                    (data as any)
                                                        .orderCostsBreakdown ||
                                                    []
                                                }
                                            />
                                        </CardContent>
                                    </Card>

                                    {/* 9. (-) IMPOSTOS */}
                                    <Card className="border-l-4 border-l-orange-500">
                                        <CardHeader className="px-6">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <MinusCircle className="h-5 w-5 text-orange-600" />
                                                    <CardTitle>
                                                        (-) Impostos
                                                    </CardTitle>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Badge
                                                        variant="outline"
                                                        className="text-orange-700"
                                                    >
                                                        {data.taxesPercent.toFixed(
                                                            1,
                                                        )}
                                                        %
                                                    </Badge>
                                                    <Badge
                                                        variant="secondary"
                                                        className="text-lg font-semibold text-orange-700"
                                                    >
                                                        {new Intl.NumberFormat(
                                                            'pt-BR',
                                                            {
                                                                style: 'currency',
                                                                currency: 'BRL',
                                                            },
                                                        ).format(data.taxes)}
                                                    </Badge>
                                                </div>
                                            </div>
                                            <CardDescription>
                                                Impostos sobre produtos e
                                                adicionais
                                            </CardDescription>
                                        </CardHeader>
                                        {data.taxesBreakdown.length > 0 && (
                                            <CardContent className="px-6 pt-0 pb-6">
                                                <BreakdownToggle
                                                    label="Detalhar impostos"
                                                    items={data.taxesBreakdown}
                                                />
                                            </CardContent>
                                        )}
                                    </Card>

                                    {/* 10. (=) MARGEM DE CONTRIBUIÇÃO */}
                                    <Card className="border-2 border-blue-500 bg-blue-50/50">
                                        <CardHeader className="px-6">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <DollarSign className="h-5 w-5 text-blue-600" />
                                                    <CardTitle className="text-blue-700">
                                                        (=) Margem de
                                                        Contribuição
                                                    </CardTitle>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Badge
                                                        variant="outline"
                                                        className="border-blue-600 text-blue-700"
                                                    >
                                                        {data.contributionMarginPercent.toFixed(
                                                            1,
                                                        )}
                                                        %
                                                    </Badge>
                                                    <Badge className="bg-blue-600 text-lg font-bold">
                                                        {new Intl.NumberFormat(
                                                            'pt-BR',
                                                            {
                                                                style: 'currency',
                                                                currency: 'BRL',
                                                            },
                                                        ).format(
                                                            data.contributionMargin,
                                                        )}
                                                    </Badge>
                                                </div>
                                            </div>
                                            <CardDescription>
                                                Resultado após dedução de custos
                                                variáveis
                                            </CardDescription>
                                        </CardHeader>
                                    </Card>

                                    {/* 11. (-) DESPESAS OPERACIONAIS */}
                                    <Card className="border-l-4 border-l-red-600">
                                        <CardHeader className="px-6">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <MinusCircle className="h-5 w-5 text-red-600" />
                                                    <CardTitle>
                                                        (-) Despesas
                                                        Operacionais
                                                    </CardTitle>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Badge
                                                        variant="outline"
                                                        className="text-red-700"
                                                    >
                                                        {data.extraExpensesPercent.toFixed(
                                                            1,
                                                        )}
                                                        %
                                                    </Badge>
                                                    <Badge
                                                        variant="secondary"
                                                        className="text-lg font-semibold text-red-700"
                                                    >
                                                        {new Intl.NumberFormat(
                                                            'pt-BR',
                                                            {
                                                                style: 'currency',
                                                                currency: 'BRL',
                                                            },
                                                        ).format(
                                                            data.extraExpenses,
                                                        )}
                                                    </Badge>
                                                </div>
                                            </div>
                                            <CardDescription>
                                                Despesas das movimentações
                                                operacionais
                                            </CardDescription>
                                        </CardHeader>
                                        {(data.extraExpensesBreakdown?.length ??
                                            0) > 0 && (
                                            <CardContent className="px-6 pt-0 pb-6">
                                                <BreakdownToggle
                                                    label="Detalhar despesas operacionais"
                                                    items={
                                                        data.extraExpensesBreakdown ||
                                                        []
                                                    }
                                                />
                                            </CardContent>
                                        )}
                                    </Card>

                                    {/* 12. (+) RECEITAS OPERACIONAIS */}
                                    <Card className="border-l-4 border-l-green-600">
                                        <CardHeader className="px-6">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <PlusCircle className="h-5 w-5 text-green-600" />
                                                    <CardTitle>
                                                        (+) Receitas
                                                        Operacionais
                                                    </CardTitle>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Badge
                                                        variant="outline"
                                                        className="text-green-700"
                                                    >
                                                        {data.extraIncomePercent.toFixed(
                                                            1,
                                                        )}
                                                        %
                                                    </Badge>
                                                    <Badge
                                                        variant="secondary"
                                                        className="text-lg font-semibold text-green-700"
                                                    >
                                                        {new Intl.NumberFormat(
                                                            'pt-BR',
                                                            {
                                                                style: 'currency',
                                                                currency: 'BRL',
                                                            },
                                                        ).format(
                                                            data.extraIncome,
                                                        )}
                                                    </Badge>
                                                </div>
                                            </div>
                                            <CardDescription>
                                                Receitas das movimentações
                                                operacionais
                                            </CardDescription>
                                        </CardHeader>
                                        {(data.extraIncomeBreakdown?.length ??
                                            0) > 0 && (
                                            <CardContent className="px-6 pt-0 pb-6">
                                                <BreakdownToggle
                                                    label="Detalhar receitas operacionais"
                                                    items={
                                                        data.extraIncomeBreakdown ||
                                                        []
                                                    }
                                                />
                                            </CardContent>
                                        )}
                                    </Card>

                                    {/* 13. (=) LUCRO LÍQUIDO FINAL */}
                                    <Card className="border-4 border-primary bg-primary/5">
                                        <CardHeader className="px-6">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Wallet className="h-6 w-6 text-primary" />
                                                    <CardTitle className="text-xl text-primary">
                                                        (=) Lucro Líquido
                                                    </CardTitle>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <Badge
                                                        variant="outline"
                                                        className="border-primary text-lg font-bold text-primary"
                                                    >
                                                        {data.netProfitPercent.toFixed(
                                                            1,
                                                        )}
                                                        %
                                                    </Badge>
                                                    <Badge className="bg-primary text-xl font-bold">
                                                        {new Intl.NumberFormat(
                                                            'pt-BR',
                                                            {
                                                                style: 'currency',
                                                                currency: 'BRL',
                                                            },
                                                        ).format(
                                                            data.netProfit,
                                                        )}
                                                    </Badge>
                                                </div>
                                            </div>
                                            <CardDescription className="text-base">
                                                Resultado final após todas as
                                                receitas e despesas
                                            </CardDescription>
                                        </CardHeader>
                                    </Card>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </AppLayout>
        </>
    );
}
