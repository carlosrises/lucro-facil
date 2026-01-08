import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { MonthYearPicker } from '@/components/ui/month-year-picker';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import {
    DollarSign,
    Download,
    MinusCircle,
    PlusCircle,
    ShoppingCart,
    Store,
    TrendingUp,
    Wallet,
} from 'lucide-react';

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

interface SummaryData {
    // Receitas
    grossRevenue: number;
    revenueByMarketplace: Array<{
        name: string;
        value: number;
        percentage: number;
    }>;

    // Custos
    cmv: number;
    taxes: number;
    commissions: number;
    paymentFees: number;
    orderCosts: number;

    // Operacionais
    extraIncome: number;
    extraExpenses: number;

    // Resultados
    grossProfit: number;
    grossProfitPercent: number;
    resultAfterTaxes: number;
    operationalProfit: number;
    operationalProfitPercent: number;
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
                                            <div className="space-y-4">
                                                {data.revenueByMarketplace.map(
                                                    (marketplace) => (
                                                        <div
                                                            key={
                                                                marketplace.name
                                                            }
                                                            className="flex items-center justify-between"
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <Store className="h-4 w-4 text-muted-foreground" />
                                                                <span className="font-medium">
                                                                    {
                                                                        marketplace.name
                                                                    }
                                                                </span>
                                                                <Badge variant="outline">
                                                                    {
                                                                        marketplace.percentage
                                                                    }
                                                                    %
                                                                </Badge>
                                                            </div>
                                                            <span className="font-semibold">
                                                                {new Intl.NumberFormat(
                                                                    'pt-BR',
                                                                    {
                                                                        style: 'currency',
                                                                        currency:
                                                                            'BRL',
                                                                    },
                                                                ).format(
                                                                    marketplace.value,
                                                                )}
                                                            </span>
                                                        </div>
                                                    ),
                                                )}
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
                                                    ).format(data.paymentFees)}
                                                </Badge>
                                            </div>
                                            <CardDescription>
                                                Taxas de meios de pagamento
                                            </CardDescription>
                                        </CardHeader>
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
                                                    ).format(data.commissions)}
                                                </Badge>
                                            </div>
                                            <CardDescription>
                                                Comissões dos marketplaces
                                            </CardDescription>
                                        </CardHeader>
                                    </Card>

                                    {/* 4. (=) RECEITA PÓS DEDUÇÃO */}
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
                                                        {data.grossProfitPercent.toFixed(
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
                                                            data.grossProfit,
                                                        )}
                                                    </Badge>
                                                </div>
                                            </div>
                                            <CardDescription>
                                                Receita após dedução de taxas e comissões
                                            </CardDescription>
                                        </CardHeader>
                                    </Card>

                                    {/* 5. (-) CMV */}
                                    <Card className="border-l-4 border-l-red-500">
                                        <CardHeader className="px-6">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <MinusCircle className="h-5 w-5 text-red-600" />
                                                    <CardTitle>
                                                        (-) Custos da Mercadoria Vendida
                                                    </CardTitle>
                                                </div>
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
                                            <CardDescription>
                                                Custo dos insumos e produtos
                                            </CardDescription>
                                        </CardHeader>
                                    </Card>

                                    {/* 6. (-) DESPESAS OPERACIONAIS */}
                                    <Card className="border-l-4 border-l-rose-500">
                                        <CardHeader className="px-6">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <MinusCircle className="h-5 w-5 text-rose-600" />
                                                    <CardTitle>
                                                        (-) Despesas Operacionais
                                                    </CardTitle>
                                                </div>
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
                                                    ).format(data.orderCosts)}
                                                </Badge>
                                            </div>
                                            <CardDescription>
                                                Custos fixos atribuídos aos pedidos
                                            </CardDescription>
                                        </CardHeader>
                                    </Card>

                                    {/* 7. (-) IMPOSTOS */}
                                    <Card className="border-l-4 border-l-orange-500">
                                        <CardHeader className="px-6">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <MinusCircle className="h-5 w-5 text-orange-600" />
                                                    <CardTitle>
                                                        (-) Impostos
                                                    </CardTitle>
                                                </div>
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
                                            <CardDescription>
                                                Impostos sobre produtos e adicionais
                                            </CardDescription>
                                        </CardHeader>
                                    </Card>

                                    {/* 8. (=) MARGEM DE CONTRIBUIÇÃO */}
                                    <Card className="border-2 border-blue-500 bg-blue-50/50">
                                        <CardHeader className="px-6">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <DollarSign className="h-5 w-5 text-blue-600" />
                                                    <CardTitle className="text-blue-700">
                                                        (=) Margem de Contribuição
                                                    </CardTitle>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Badge
                                                        variant="outline"
                                                        className="border-blue-600 text-blue-700"
                                                    >
                                                        {data.operationalProfitPercent.toFixed(
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
                                                            data.operationalProfit,
                                                        )}
                                                    </Badge>
                                                </div>
                                            </div>
                                            <CardDescription>
                                                Resultado antes dos custos fixos
                                            </CardDescription>
                                        </CardHeader>
                                    </Card>

                                    {/* 9. (+) RECEITAS EXTRAS (CUSTOS FIXOS) */}
                                    {data.extraIncome > 0 && (
                                        <Card className="border-l-4 border-l-green-500">
                                            <CardHeader className="px-6">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <PlusCircle className="h-5 w-5 text-green-600" />
                                                        <CardTitle>
                                                            (+) Custos Fixos
                                                        </CardTitle>
                                                    </div>
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
                                                <CardDescription>
                                                    Custos fixos operacionais
                                                </CardDescription>
                                            </CardHeader>
                                        </Card>
                                    )}

                                    {/* 10. (-) DESPESAS EXTRAS */}
                                    {data.extraExpenses > 0 && (
                                        <Card className="border-l-4 border-l-red-500">
                                            <CardHeader className="px-6">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <MinusCircle className="h-5 w-5 text-red-600" />
                                                        <CardTitle>
                                                            (-) Despesas Extras
                                                        </CardTitle>
                                                    </div>
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
                                                <CardDescription>
                                                    Despesas operacionais extras
                                                </CardDescription>
                                            </CardHeader>
                                        </Card>
                                    )}

                                    {/* 11. (=) LUCRO LÍQUIDO FINAL */}
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
