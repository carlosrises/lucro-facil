import { IconTrendingDown, IconTrendingUp } from '@tabler/icons-react';

import { Badge } from '@/components/ui/badge';
import {
    Card,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';

interface DashboardData {
    revenue: number;
    revenueChange: number;
    revenueAfterDeductions: number; // Líquido Pós Venda
    revenueAfterDeductionsChange: number;
    cmv: number;
    cmvChange: number;
    deliveryFee: number;
    deliveryChange: number;
    taxes: number;
    taxesChange: number;
    fixedCosts: number; // Custos Fixos (movimentações)
    fixedCostsChange: number;
    contributionMargin: number; // Lucro Bruto (MC)
    contributionMarginChange: number;
    netProfit: number; // Lucro Líquido
    netProfitChange: number;
    orderCount: number;
}

interface DashboardSectionCardsProps {
    data: DashboardData;
}

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(value);
};

const getTrendIcon = (value: number) => {
    return value >= 0 ? IconTrendingUp : IconTrendingDown;
};

const getTrendVariant = (value: number): 'outline' | 'default' => {
    return 'outline';
};

const formatPercentage = (value: number, base: number): string => {
    if (base === 0) return '0,0%';
    const percentage = (value / base) * 100;
    return percentage.toFixed(1).replace('.', ',') + '%';
};

export function DashboardSectionCards({ data }: DashboardSectionCardsProps) {
    const RevenueIcon = getTrendIcon(data.revenueChange);
    const RevenueAfterDeductionsIcon = getTrendIcon(
        data.revenueAfterDeductionsChange,
    );
    const CmvIcon = getTrendIcon(data.cmvChange);
    const DeliveryIcon = getTrendIcon(data.deliveryChange);
    const TaxesIcon = getTrendIcon(data.taxesChange);
    const FixedCostsIcon = getTrendIcon(data.fixedCostsChange);
    const ContributionMarginIcon = getTrendIcon(data.contributionMarginChange);
    const NetProfitIcon = getTrendIcon(data.netProfitChange);

    return (
        <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
            <Card className="@container/card">
                <CardHeader>
                    <CardDescription>Faturamento</CardDescription>
                    <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                        {formatCurrency(data.revenue)}
                    </CardTitle>
                    <div className="flex items-center justify-between gap-2">
                        <CardDescription className="text-sm">
                            100,0%
                        </CardDescription>
                        <Badge
                            variant={getTrendVariant(data.revenueChange)}
                            className={
                                data.revenueChange >= 0
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                    : 'border-red-200 bg-red-50 text-red-700'
                            }
                        >
                            <RevenueIcon className="h-3 w-3" />
                            {data.revenueChange >= 0 ? '+' : ''}
                            {data.revenueChange.toFixed(1)}%
                        </Badge>
                    </div>
                </CardHeader>
            </Card>
            <Card className="@container/card">
                <CardHeader>
                    <CardDescription>Receita pós Dedução</CardDescription>
                    <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                        {formatCurrency(data.revenueAfterDeductions)}
                    </CardTitle>
                    <div className="flex items-center justify-between gap-2">
                        <CardDescription className="text-sm">
                            {formatPercentage(
                                data.revenueAfterDeductions,
                                data.revenue,
                            )}
                        </CardDescription>
                        <Badge
                            variant={getTrendVariant(
                                data.revenueAfterDeductionsChange,
                            )}
                            className={
                                data.revenueAfterDeductionsChange >= 0
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                    : 'border-red-200 bg-red-50 text-red-700'
                            }
                        >
                            <RevenueAfterDeductionsIcon className="h-3 w-3" />
                            {data.revenueAfterDeductionsChange >= 0 ? '+' : ''}
                            {data.revenueAfterDeductionsChange.toFixed(1)}%
                        </Badge>
                    </div>
                </CardHeader>
            </Card>
            <Card className="@container/card">
                <CardHeader>
                    <CardDescription>CMV</CardDescription>
                    <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                        {formatCurrency(data.cmv)}
                    </CardTitle>
                    <div className="flex items-center justify-between gap-2">
                        <CardDescription className="text-sm">
                            {formatPercentage(data.cmv, data.revenue)}
                        </CardDescription>
                        <Badge
                            variant={getTrendVariant(data.cmvChange)}
                            className={
                                data.cmvChange >= 0
                                    ? 'border-red-200 bg-red-50 text-red-700'
                                    : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            }
                        >
                            <CmvIcon className="h-3 w-3" />
                            {data.cmvChange >= 0 ? '+' : ''}
                            {data.cmvChange.toFixed(1)}%
                        </Badge>
                    </div>
                </CardHeader>
            </Card>
            <Card className="@container/card">
                <CardHeader>
                    <CardDescription>Taxa de Entrega</CardDescription>
                    <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                        {formatCurrency(data.deliveryFee)}
                    </CardTitle>
                    <div className="flex items-center justify-between gap-2">
                        <CardDescription className="text-sm">
                            {formatPercentage(data.deliveryFee, data.revenue)}
                        </CardDescription>
                        <Badge
                            variant={getTrendVariant(data.deliveryChange)}
                            className={
                                data.deliveryChange >= 0
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                    : 'border-red-200 bg-red-50 text-red-700'
                            }
                        >
                            <DeliveryIcon className="h-3 w-3" />
                            {data.deliveryChange >= 0 ? '+' : ''}
                            {data.deliveryChange.toFixed(1)}%
                        </Badge>
                    </div>
                </CardHeader>
            </Card>
            <Card className="@container/card">
                <CardHeader>
                    <CardDescription>Impostos</CardDescription>
                    <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                        {formatCurrency(data.taxes)}
                    </CardTitle>
                    <div className="flex items-center justify-between gap-2">
                        <CardDescription className="text-sm">
                            {formatPercentage(data.taxes, data.revenue)}
                        </CardDescription>
                        <Badge
                            variant={getTrendVariant(data.taxesChange)}
                            className={
                                data.taxesChange >= 0
                                    ? 'border-red-200 bg-red-50 text-red-700'
                                    : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            }
                        >
                            <TaxesIcon className="h-3 w-3" />
                            {data.taxesChange >= 0 ? '+' : ''}
                            {data.taxesChange.toFixed(1)}%
                        </Badge>
                    </div>
                </CardHeader>
            </Card>
            <Card className="@container/card">
                <CardHeader>
                    <CardDescription>Lucro Bruto (MC)</CardDescription>
                    <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                        {formatCurrency(data.contributionMargin)}
                    </CardTitle>
                    <div className="flex items-center justify-between gap-2">
                        <CardDescription className="text-sm">
                            {formatPercentage(
                                data.contributionMargin,
                                data.revenue,
                            )}
                        </CardDescription>
                        <Badge
                            variant={getTrendVariant(
                                data.contributionMarginChange,
                            )}
                            className={
                                data.contributionMarginChange >= 0
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                    : 'border-red-200 bg-red-50 text-red-700'
                            }
                        >
                            <ContributionMarginIcon className="h-3 w-3" />
                            {data.contributionMarginChange >= 0 ? '+' : ''}
                            {data.contributionMarginChange.toFixed(1)}%
                        </Badge>
                    </div>
                </CardHeader>
            </Card>
            <Card className="@container/card">
                <CardHeader>
                    <CardDescription>Custos Fixos</CardDescription>
                    <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                        {formatCurrency(data.fixedCosts)}
                    </CardTitle>
                    <div className="flex items-center justify-between gap-2">
                        <CardDescription className="text-sm">
                            {formatPercentage(data.fixedCosts, data.revenue)}
                        </CardDescription>
                        <Badge
                            variant={getTrendVariant(data.fixedCostsChange)}
                            className={
                                data.fixedCostsChange >= 0
                                    ? 'border-red-200 bg-red-50 text-red-700'
                                    : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            }
                        >
                            <FixedCostsIcon className="h-3 w-3" />
                            {data.fixedCostsChange >= 0 ? '+' : ''}
                            {data.fixedCostsChange.toFixed(1)}%
                        </Badge>
                    </div>
                </CardHeader>
            </Card>
            <Card className="@container/card">
                <CardHeader>
                    <CardDescription>Lucro Líquido</CardDescription>
                    <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                        {formatCurrency(data.netProfit)}
                    </CardTitle>
                    <div className="flex items-center justify-between gap-2">
                        <CardDescription className="text-sm">
                            Margem:{' '}
                            {(data.revenue > 0
                                ? (data.netProfit / data.revenue) * 100
                                : 0
                            ).toFixed(1)}
                            %
                        </CardDescription>
                        <Badge
                            variant={getTrendVariant(data.netProfitChange)}
                            className={
                                data.netProfitChange >= 0
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                    : 'border-red-200 bg-red-50 text-red-700'
                            }
                        >
                            <NetProfitIcon className="h-3 w-3" />
                            {data.netProfitChange >= 0 ? '+' : ''}
                            {data.netProfitChange.toFixed(1)}%
                        </Badge>
                    </div>
                </CardHeader>
            </Card>
        </div>
    );
}
