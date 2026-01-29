import {
    Card,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { Info } from 'lucide-react';

interface IndicatorsData {
    subtotal: number;
    averageTicket: number;
    cmv: number;
    netRevenue: number;
    orderCount: number;
    averageMargin?: number;
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
        <TooltipProvider>
            <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
                {/* Subtotal */}
                <Card className="@container/card">
                    <CardHeader>
                        <CardDescription className="flex items-center gap-1.5">
                            Total faturado
                            <Tooltip delayDuration={100}>
                                <TooltipTrigger asChild>
                                    <button className="inline-flex text-muted-foreground hover:text-foreground">
                                        <Info className="h-3.5 w-3.5" />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-[250px]">
                                    <p className="text-sm">
                                        Soma do <strong>subtotal</strong> de
                                        todos os pedidos{' '}
                                        <strong>concluídos</strong> do período
                                        filtrado.
                                    </p>
                                </TooltipContent>
                            </Tooltip>
                        </CardDescription>
                        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                            {formatCurrency(data.subtotal)}
                        </CardTitle>
                        <div className="flex items-center justify-between gap-2">
                            <CardDescription className="text-sm">
                                {data.orderCount}{' '}
                                {data.orderCount === 1
                                    ? 'pedido concluído'
                                    : 'pedidos concluídos'}
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
                        <CardDescription className="flex items-center gap-1.5">
                            CMV
                            <Tooltip delayDuration={100}>
                                <TooltipTrigger asChild>
                                    <button className="inline-flex text-muted-foreground hover:text-foreground">
                                        <Info className="h-3.5 w-3.5" />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-[250px]">
                                    <p className="text-sm">
                                        <strong>
                                            Custo da Mercadoria Vendida
                                        </strong>
                                        : soma dos custos dos
                                        ingredientes/produtos internos de todos
                                        os itens vendidos.
                                    </p>
                                </TooltipContent>
                            </Tooltip>
                        </CardDescription>
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

                {/* Lucro Bruto (MC) */}
                <Card className="@container/card">
                    <CardHeader>
                        <CardDescription className="flex items-center gap-1.5">
                            Lucro Bruto (MC)
                            <Tooltip delayDuration={100}>
                                <TooltipTrigger asChild>
                                    <button className="inline-flex text-muted-foreground hover:text-foreground">
                                        <Info className="h-3.5 w-3.5" />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-[250px]">
                                    <p className="text-sm">
                                        <strong>Subtotal</strong> menos{' '}
                                        <strong>CMV</strong>,{' '}
                                        <strong>Impostos</strong>,{' '}
                                        <strong>Custos</strong>,{' '}
                                        <strong>Comissões</strong> e{' '}
                                        <strong>Taxas de Pagamento</strong>.
                                    </p>
                                </TooltipContent>
                            </Tooltip>
                        </CardDescription>
                        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                            {formatCurrency(data.netRevenue)}
                        </CardTitle>
                        <div className="flex items-center justify-between gap-2">
                            <CardDescription className="text-sm">
                                {data.averageMargin !== undefined
                                    ? `${data.averageMargin.toFixed(1).replace('.', ',')}%`
                                    : formatPercentage(
                                          data.netRevenue,
                                          data.subtotal,
                                      )}
                            </CardDescription>
                        </div>
                    </CardHeader>
                </Card>
            </div>
        </TooltipProvider>
    );
}
