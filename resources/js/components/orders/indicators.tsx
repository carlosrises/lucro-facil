import {
    Card,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';

interface IndicatorsData {
    subtotal: number;
    averageTicket: number;
    cmv: number;
    netRevenue: number;
    orderCount: number;
}

interface OrderIndicatorsProps {
    data: IndicatorsData;
}

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(value);
};

const formatPercentage = (value: number, base: number): string => {
    if (base === 0) return '0,0%';
    const percentage = (value / base) * 100;
    return percentage.toFixed(1).replace('.', ',') + '%';
};

export function OrderIndicators({ data }: OrderIndicatorsProps) {
    return (
        <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
            {/* Subtotal */}
            <Card className="@container/card">
                <CardHeader>
                    <CardDescription>Subtotal do Período</CardDescription>
                    <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                        {formatCurrency(data.subtotal)}
                    </CardTitle>
                    <div className="flex items-center justify-between gap-2">
                        <CardDescription className="text-sm">
                            {data.orderCount}{' '}
                            {data.orderCount === 1 ? 'pedido' : 'pedidos'}
                        </CardDescription>
                    </div>
                </CardHeader>
            </Card>

            {/* Ticket Médio */}
            <Card className="@container/card">
                <CardHeader>
                    <CardDescription>Ticket Médio</CardDescription>
                    <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                        {formatCurrency(data.averageTicket)}
                    </CardTitle>
                    <div className="flex items-center justify-between gap-2">
                        <CardDescription className="text-sm">
                            {formatPercentage(
                                data.averageTicket,
                                data.subtotal,
                            )}
                        </CardDescription>
                    </div>
                </CardHeader>
            </Card>

            {/* CMV */}
            <Card className="@container/card">
                <CardHeader>
                    <CardDescription>CMV do Período</CardDescription>
                    <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                        {formatCurrency(data.cmv)}
                    </CardTitle>
                    <div className="flex items-center justify-between gap-2">
                        <CardDescription className="text-sm">
                            {formatPercentage(data.cmv, data.subtotal)}
                        </CardDescription>
                    </div>
                </CardHeader>
            </Card>

            {/* Total Líquido */}
            <Card className="@container/card">
                <CardHeader>
                    <CardDescription>Total Líquido do Período</CardDescription>
                    <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                        {formatCurrency(data.netRevenue)}
                    </CardTitle>
                    <div className="flex items-center justify-between gap-2">
                        <CardDescription className="text-sm">
                            {formatPercentage(data.netRevenue, data.subtotal)}
                        </CardDescription>
                    </div>
                </CardHeader>
            </Card>
        </div>
    );
}
