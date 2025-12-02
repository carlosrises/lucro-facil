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
    revenue: {
        total: number;
        byMarketplace: Array<{
            name: string;
            value: number;
            percentage: number;
        }>;
    };
    netMarketplace: number;
    grossProfit: number;
    extraRevenue: number;
    operationalExpenses: number;
    netOperationalProfit: number;
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
                                    {/* Faturamento */}
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
                                                    ).format(
                                                        data.revenue.total,
                                                    )}
                                                </Badge>
                                            </div>
                                            <CardDescription>
                                                Faturamento total por
                                                marketplace
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="px-6">
                                            <div className="space-y-4">
                                                {data.revenue.byMarketplace.map(
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

                                    {/* Líquido Marketplace */}
                                    <Card>
                                        <CardHeader className="px-6">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <DollarSign className="h-5 w-5 text-green-600" />
                                                    <CardTitle>
                                                        Líquido Marketplace
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
                                                        data.netMarketplace,
                                                    )}
                                                </Badge>
                                            </div>
                                            <CardDescription>
                                                Valor líquido após taxas dos
                                                marketplaces
                                            </CardDescription>
                                        </CardHeader>
                                    </Card>

                                    {/* Lucro Bruto */}
                                    <Card>
                                        <CardHeader className="px-6">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <TrendingUp className="h-5 w-5 text-emerald-600" />
                                                    <CardTitle>
                                                        Lucro Bruto
                                                    </CardTitle>
                                                </div>
                                                <Badge
                                                    variant="secondary"
                                                    className="text-lg font-semibold text-emerald-700"
                                                >
                                                    {new Intl.NumberFormat(
                                                        'pt-BR',
                                                        {
                                                            style: 'currency',
                                                            currency: 'BRL',
                                                        },
                                                    ).format(data.grossProfit)}
                                                </Badge>
                                            </div>
                                            <CardDescription>
                                                Lucro após custos diretos
                                            </CardDescription>
                                        </CardHeader>
                                    </Card>

                                    {/* Receita Extra */}
                                    <Card>
                                        <CardHeader className="px-6">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <PlusCircle className="h-5 w-5 text-blue-600" />
                                                    <CardTitle>
                                                        Receita Extra
                                                    </CardTitle>
                                                </div>
                                                <Badge
                                                    variant="secondary"
                                                    className="text-lg font-semibold text-blue-700"
                                                >
                                                    {new Intl.NumberFormat(
                                                        'pt-BR',
                                                        {
                                                            style: 'currency',
                                                            currency: 'BRL',
                                                        },
                                                    ).format(data.extraRevenue)}
                                                </Badge>
                                            </div>
                                            <CardDescription>
                                                Receitas operacionais adicionais
                                            </CardDescription>
                                        </CardHeader>
                                    </Card>

                                    {/* Despesas Operacionais */}
                                    <Card>
                                        <CardHeader className="px-6">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <MinusCircle className="h-5 w-5 text-red-600" />
                                                    <CardTitle>
                                                        Despesas Operacionais
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
                                                        data.operationalExpenses,
                                                    )}
                                                </Badge>
                                            </div>
                                            <CardDescription>
                                                Despesas operacionais do período
                                            </CardDescription>
                                        </CardHeader>
                                    </Card>

                                    {/* Lucro Líquido Operacional */}
                                    <Card className="border-2 border-primary">
                                        <CardHeader className="px-6">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Wallet className="h-5 w-5 text-primary" />
                                                    <CardTitle className="text-primary">
                                                        Lucro Líquido
                                                        Operacional
                                                    </CardTitle>
                                                </div>
                                                <Badge className="text-lg font-bold">
                                                    {new Intl.NumberFormat(
                                                        'pt-BR',
                                                        {
                                                            style: 'currency',
                                                            currency: 'BRL',
                                                        },
                                                    ).format(
                                                        data.netOperationalProfit,
                                                    )}
                                                </Badge>
                                            </div>
                                            <CardDescription>
                                                Resultado final após todas as
                                                operações
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
