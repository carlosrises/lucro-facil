'use client';

import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts';

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    ChartConfig,
    ChartContainer,
    ChartTooltip,
} from '@/components/ui/chart';

export const description = 'Dashboard financial chart';

interface ChartDataPoint {
    date: string;
    revenue: number;
    cmv: number;
    taxes: number;
    commissions: number;
    costs: number;
    paymentFees: number;
    netTotal: number;
}

interface DashboardSectionChartProps {
    data: ChartDataPoint[];
}

const chartConfig = {
    revenue: {
        label: 'Faturamento',
        color: 'hsl(var(--primary))',
    },
    cmv: {
        label: 'CMV',
        color: 'hsl(var(--destructive))',
    },
    taxes: {
        label: 'Impostos',
        color: 'hsl(var(--chart-3))',
    },
    commissions: {
        label: 'Comissões',
        color: 'hsl(var(--chart-4))',
    },
    costs: {
        label: 'Custos Operacionais',
        color: 'hsl(var(--chart-5))',
    },
    paymentFees: {
        label: 'Taxas de Pagamento',
        color: 'hsl(var(--muted-foreground))',
    },
    netTotal: {
        label: 'Lucro Líquido',
        color: 'hsl(var(--primary))',
    },
} satisfies ChartConfig;

export function DashboardSectionChart({ data }: DashboardSectionChartProps) {
    const CustomTooltip = ({ active, payload }: any) => {
        if (!active || !payload || !payload.length) return null;

        const formatCurrency = (value: number) =>
            new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL',
            }).format(value);

        const dataPoint = payload[0].payload;
        // Parsear data como local (não UTC) adicionando hora meio-dia
        const date = new Date(dataPoint.date + 'T12:00:00');

        return (
            <div className="rounded-lg border bg-background p-3 shadow-md">
                <p className="mb-2 text-sm font-semibold">
                    {date.toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                    })}
                </p>
                <div className="space-y-1 text-xs">
                    <div className="flex items-center justify-between gap-8">
                        <div className="flex items-center gap-2">
                            <div
                                className="h-2 w-2 rounded-full"
                                style={{
                                    backgroundColor: 'hsl(var(--primary))',
                                }}
                            />
                            <span className="text-muted-foreground">
                                Faturamento
                            </span>
                        </div>
                        <span className="font-semibold">
                            {formatCurrency(dataPoint.revenue)}
                        </span>
                    </div>

                    <div className="my-1.5 border-t" />

                    <div className="flex items-center justify-between gap-8">
                        <div className="flex items-center gap-2">
                            <div
                                className="h-2 w-2 rounded-full"
                                style={{
                                    backgroundColor: 'hsl(var(--destructive))',
                                }}
                            />
                            <span className="text-muted-foreground">CMV</span>
                        </div>
                        <span className="text-destructive">
                            -{formatCurrency(dataPoint.cmv)}
                        </span>
                    </div>

                    <div className="flex items-center justify-between gap-8">
                        <div className="flex items-center gap-2">
                            <div
                                className="h-2 w-2 rounded-full"
                                style={{
                                    backgroundColor: 'hsl(var(--chart-3))',
                                }}
                            />
                            <span className="text-muted-foreground">
                                Impostos
                            </span>
                        </div>
                        <span className="text-destructive">
                            -{formatCurrency(dataPoint.taxes)}
                        </span>
                    </div>

                    <div className="flex items-center justify-between gap-8">
                        <div className="flex items-center gap-2">
                            <div
                                className="h-2 w-2 rounded-full"
                                style={{
                                    backgroundColor: 'hsl(var(--chart-4))',
                                }}
                            />
                            <span className="text-muted-foreground">
                                Comissões
                            </span>
                        </div>
                        <span className="text-destructive">
                            -{formatCurrency(dataPoint.commissions)}
                        </span>
                    </div>

                    <div className="flex items-center justify-between gap-8">
                        <div className="flex items-center gap-2">
                            <div
                                className="h-2 w-2 rounded-full"
                                style={{
                                    backgroundColor: 'hsl(var(--chart-5))',
                                }}
                            />
                            <span className="text-muted-foreground">
                                Custos Operacionais
                            </span>
                        </div>
                        <span className="text-destructive">
                            -{formatCurrency(dataPoint.costs)}
                        </span>
                    </div>

                    <div className="flex items-center justify-between gap-8">
                        <div className="flex items-center gap-2">
                            <div
                                className="h-2 w-2 rounded-full"
                                style={{
                                    backgroundColor:
                                        'hsl(var(--muted-foreground))',
                                }}
                            />
                            <span className="text-muted-foreground">
                                Taxas de Pagamento
                            </span>
                        </div>
                        <span className="text-destructive">
                            -{formatCurrency(dataPoint.paymentFees)}
                        </span>
                    </div>

                    <div className="my-1.5 border-t" />

                    <div className="flex items-center justify-between gap-8">
                        <div className="flex items-center gap-2">
                            <div
                                className="h-2 w-2 rounded-full"
                                style={{
                                    backgroundColor: 'hsl(var(--primary))',
                                }}
                            />
                            <span className="font-semibold">Lucro Líquido</span>
                        </div>
                        <span className="font-bold text-primary">
                            {formatCurrency(dataPoint.netTotal)}
                        </span>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <Card className="@container/card">
            <CardHeader>
                <CardTitle>Evolução Financeira</CardTitle>
                <CardDescription>
                    <span className="hidden @[540px]/card:block">
                        Faturamento e Lucro Líquido do mês
                    </span>
                    <span className="@[540px]/card:hidden">Mês atual</span>
                </CardDescription>
            </CardHeader>
            <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
                <ChartContainer
                    config={chartConfig}
                    className="aspect-auto h-[250px] w-full"
                >
                    <AreaChart data={data}>
                        <defs>
                            <linearGradient
                                id="fillRevenue"
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                            >
                                <stop
                                    offset="5%"
                                    stopColor="var(--primary)"
                                    stopOpacity={0.1}
                                />
                                <stop
                                    offset="95%"
                                    stopColor="var(--primary)"
                                    stopOpacity={0.02}
                                />
                            </linearGradient>
                            <linearGradient
                                id="fillNetTotal"
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                            >
                                <stop
                                    offset="5%"
                                    stopColor="var(--primary)"
                                    stopOpacity={0.8}
                                />
                                <stop
                                    offset="95%"
                                    stopColor="var(--primary)"
                                    stopOpacity={0.1}
                                />
                            </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} />
                        <XAxis
                            dataKey="date"
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            minTickGap={32}
                            tickFormatter={(value) => {
                                // Parsear data como local (não UTC) adicionando hora meio-dia
                                const date = new Date(value + 'T12:00:00');
                                return date.toLocaleDateString('pt-BR', {
                                    day: '2-digit',
                                    month: 'short',
                                });
                            }}
                        />
                        <ChartTooltip content={<CustomTooltip />} />
                        <Area
                            dataKey="revenue"
                            type="natural"
                            fill="url(#fillRevenue)"
                            stroke="var(--primary)"
                            strokeOpacity={0.2}
                            strokeWidth={1}
                            stackId="a"
                        />
                        <Area
                            dataKey="netTotal"
                            type="natural"
                            fill="url(#fillNetTotal)"
                            stroke="var(--primary)"
                            strokeWidth={1}
                            stackId="b"
                        />
                    </AreaChart>
                </ChartContainer>
            </CardContent>
        </Card>
    );
}
