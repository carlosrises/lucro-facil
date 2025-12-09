import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowDownLeft, ArrowRightLeft, ArrowUpRight } from 'lucide-react';

type OrderFinancialCardProps = {
    sale?: {
        id: number;
        sale_uuid: string;
        short_id: string;
        type: string;
        sales_channel: string;
        current_status: string;
        bag_value?: number;
        delivery_fee?: number;
        service_fee?: number;
        gross_value: number;
        discount_value?: number;
        net_value: number;
        payment_method: string;
        concluded_at: string | null;
        expected_payment_date: string | null;
        raw?: any;
    };
    order?: {
        provider: string;
        origin: string;
        gross_total?: string | null;
        discount_total?: string | null;
        delivery_fee?: string | null;
        net_total?: string | null;
        total_costs?: string | number | null;
        total_commissions?: string | number | null;
        items?: any[];
        raw?: any;
    };
};

export function OrderFinancialCard({ sale, order }: OrderFinancialCardProps) {
    // Se for Takeat, sempre usar dados do raw (não terá sale)
    if (order?.provider === 'takeat' && order.raw?.session) {
        const session = order.raw.session;
        const grossTotal = parseFloat(order.gross_total || '0');
        const discountTotal = parseFloat(order.discount_total || '0');
        const deliveryFee = parseFloat(order.delivery_fee || '0');
        const netTotal = parseFloat(order.net_total || '0');
        const isDelivery = session.is_delivery;
        const channel = session.sales_channel || order.origin.toUpperCase();

        return (
            <Card className="h-fit gap-1 border-0 bg-gray-100 p-1 text-sm shadow-none dark:bg-neutral-950">
                <CardHeader className="gap-0 bg-gray-100 px-2 py-2 dark:bg-neutral-950">
                    <CardTitle className="flex h-[18px] items-center font-semibold">
                        Detalhamento financeiro do pedido
                    </CardTitle>
                </CardHeader>
                <CardContent className="rounded-md bg-card p-0">
                    <ul className="m-0 flex w-full flex-col ps-0">
                        {/* Tipo de pedido */}
                        <li className="flex flex-col gap-2 border-b-1 px-0 py-4">
                            <div className="flex w-full flex-row items-center gap-2 px-3 py-0">
                                <span className="text-sm leading-4 font-semibold">
                                    Tipo de pedido
                                </span>
                                <span className="text-sm leading-4">
                                    {isDelivery ? 'Delivery' : 'Retirada'} via{' '}
                                    {channel}
                                </span>
                            </div>
                        </li>

                        {/* Total dos itens (valor base) */}
                        <li className="flex flex-col gap-2 border-b-1 px-0 py-4">
                            <div className="flex w-full flex-row items-center gap-2 px-3 py-0">
                                <div className="flex items-center justify-center rounded-full bg-gray-200 p-1 text-gray-700">
                                    <ArrowRightLeft className="h-3 w-3" />
                                </div>
                                <span className="flex-grow text-sm leading-4 font-semibold">
                                    Total do pedido
                                </span>
                                <span className="text-sm leading-4 font-semibold whitespace-nowrap">
                                    {new Intl.NumberFormat('pt-BR', {
                                        style: 'currency',
                                        currency: 'BRL',
                                    }).format(
                                        session.old_total_price
                                            ? parseFloat(
                                                  session.old_total_price,
                                              )
                                            : grossTotal,
                                    )}
                                </span>
                            </div>
                            <ul className="flex w-full flex-col items-center justify-between pl-0">
                                <li className="flex w-full flex-row items-start justify-between px-3 py-2">
                                    <span className="text-sm leading-4 font-normal whitespace-nowrap text-gray-700">
                                        Subtotal dos itens
                                    </span>
                                </li>
                            </ul>
                        </li>

                        {/* Taxa de entrega */}
                        {isDelivery && deliveryFee > 0 && (
                            <li className="flex flex-col gap-2 border-b-1 px-0 py-4">
                                <div className="flex w-full flex-row items-center gap-2 px-3 py-0">
                                    <div className="flex items-center justify-center rounded-full bg-blue-100 p-0.5 text-blue-900">
                                        <ArrowUpRight className="h-4 w-4" />
                                    </div>
                                    <span className="flex-grow text-sm leading-4 font-semibold">
                                        Taxa de entrega
                                    </span>
                                    <span className="text-sm leading-4 whitespace-nowrap">
                                        {new Intl.NumberFormat('pt-BR', {
                                            style: 'currency',
                                            currency: 'BRL',
                                        }).format(deliveryFee)}
                                    </span>
                                </div>
                            </li>
                        )}

                        {/* Desconto no pedido */}
                        {discountTotal > 0 && (
                            <li className="flex flex-col gap-2 border-b-1 px-0 py-4">
                                <div className="flex w-full flex-row items-center gap-2 px-3 py-0">
                                    <div className="flex items-center justify-center rounded-full bg-red-100 p-0.5 text-red-900">
                                        <ArrowDownLeft className="h-4 w-4" />
                                    </div>
                                    <span className="flex-grow text-sm leading-4 font-semibold">
                                        Desconto
                                    </span>
                                    <span className="text-sm leading-4 whitespace-nowrap">
                                        -{' '}
                                        {new Intl.NumberFormat('pt-BR', {
                                            style: 'currency',
                                            currency: 'BRL',
                                        }).format(discountTotal)}
                                    </span>
                                </div>
                                {session.discount_obs && (
                                    <ul className="flex w-full flex-col items-center justify-between gap-2 pl-0">
                                        <li className="flex w-full flex-row items-start justify-between px-3 py-0">
                                            <span className="text-xs leading-4 font-normal text-muted-foreground">
                                                {session.discount_obs}
                                            </span>
                                        </li>
                                    </ul>
                                )}
                            </li>
                        )}

                        {/* Desconto na entrega */}
                        {session.delivery_fee_discount &&
                            parseFloat(session.delivery_fee_discount) > 0 && (
                                <li className="flex flex-col gap-2 border-b-1 px-0 py-4">
                                    <div className="flex w-full flex-row items-center gap-2 px-3 py-0">
                                        <div className="flex items-center justify-center rounded-full bg-red-100 p-0.5 text-red-900">
                                            <ArrowDownLeft className="h-4 w-4" />
                                        </div>
                                        <span className="flex-grow text-sm leading-4 font-semibold">
                                            Desconto na entrega
                                        </span>
                                        <span className="text-sm leading-4 whitespace-nowrap">
                                            -{' '}
                                            {new Intl.NumberFormat('pt-BR', {
                                                style: 'currency',
                                                currency: 'BRL',
                                            }).format(
                                                parseFloat(
                                                    session.delivery_fee_discount,
                                                ),
                                            )}
                                        </span>
                                    </div>
                                </li>
                            )}

                        {/* Total pago (após descontos, antes de impostos) */}
                        <li className="flex flex-col gap-2 border-b-1 px-0 py-4">
                            <div className="flex w-full flex-row items-center gap-2 px-3 py-0">
                                <div className="flex items-center justify-center rounded-full bg-gray-200 p-1 text-gray-700">
                                    <ArrowRightLeft className="h-3 w-3" />
                                </div>
                                <span className="flex-grow text-sm leading-4 font-semibold">
                                    Total pago pelo cliente
                                </span>
                                <span className="text-sm leading-4 font-semibold whitespace-nowrap">
                                    {new Intl.NumberFormat('pt-BR', {
                                        style: 'currency',
                                        currency: 'BRL',
                                    }).format(netTotal)}
                                </span>
                            </div>
                            <ul className="flex w-full flex-col items-center justify-between pl-0">
                                <li className="flex w-full flex-row items-start justify-between px-3 py-0">
                                    <span className="text-xs leading-4 font-normal text-muted-foreground">
                                        Total do pedido após descontos, antes de
                                        custos e impostos
                                    </span>
                                </li>
                            </ul>
                        </li>

                        {/* Custos dos produtos */}
                        {(() => {
                            const totalCost = (order.items || []).reduce(
                                (sum: number, item: any) => {
                                    if (item.internal_product?.unit_cost) {
                                        const quantity =
                                            item.quantity || item.qty || 0;
                                        const unitCost = parseFloat(
                                            item.internal_product.unit_cost,
                                        );
                                        return sum + quantity * unitCost;
                                    }
                                    return sum;
                                },
                                0,
                            );

                            return (
                                <li className="flex flex-col gap-2 border-b-1 px-0 py-4">
                                    <div className="flex w-full flex-row items-center gap-2 px-3 py-0">
                                        <div className="flex items-center justify-center rounded-full bg-orange-100 p-0.5 text-orange-900">
                                            <ArrowDownLeft className="h-4 w-4" />
                                        </div>
                                        <span className="flex-grow text-sm leading-4 font-semibold">
                                            Custo do Pedido
                                        </span>
                                        <span className="text-sm leading-4 whitespace-nowrap">
                                            -{' '}
                                            {new Intl.NumberFormat('pt-BR', {
                                                style: 'currency',
                                                currency: 'BRL',
                                            }).format(totalCost)}
                                        </span>
                                    </div>
                                </li>
                            );
                        })()}

                        {/* Impostos */}
                        {(() => {
                            const totalTax = (order.items || []).reduce(
                                (sum: number, item: any) => {
                                    if (
                                        item.internal_product?.tax_category
                                            ?.total_tax_rate !== undefined &&
                                        item.internal_product?.tax_category
                                            ?.total_tax_rate !== null
                                    ) {
                                        const quantity =
                                            item.quantity || item.qty || 0;
                                        const unitPrice =
                                            item.price || item.unit_price || 0;
                                        const itemTotal = quantity * unitPrice;
                                        const taxRate =
                                            item.internal_product.tax_category
                                                .total_tax_rate / 100;
                                        return sum + itemTotal * taxRate;
                                    }
                                    return sum;
                                },
                                0,
                            );

                            return (
                                <li className="flex flex-col gap-2 border-b-1 px-0 py-4">
                                    <div className="flex w-full flex-row items-center gap-2 px-3 py-0">
                                        <div className="flex items-center justify-center rounded-full bg-orange-100 p-0.5 text-orange-900">
                                            <ArrowDownLeft className="h-4 w-4" />
                                        </div>
                                        <span className="flex-grow text-sm leading-4 font-semibold">
                                            Impostos
                                        </span>
                                        <span className="text-sm leading-4 whitespace-nowrap">
                                            -{' '}
                                            {new Intl.NumberFormat('pt-BR', {
                                                style: 'currency',
                                                currency: 'BRL',
                                            }).format(totalTax)}
                                        </span>
                                    </div>
                                </li>
                            );
                        })()}

                        {/* Custos extras (da página Custos e Comissões) */}
                        {(() => {
                            const extraCosts =
                                typeof order.total_costs === 'string'
                                    ? parseFloat(order.total_costs)
                                    : (order.total_costs ?? 0);

                            return extraCosts > 0 ? (
                                <li className="flex flex-col gap-2 border-b-1 px-0 py-4">
                                    <div className="flex w-full flex-row items-center gap-2 px-3 py-0">
                                        <div className="flex items-center justify-center rounded-full bg-orange-100 p-0.5 text-orange-900">
                                            <ArrowDownLeft className="h-4 w-4" />
                                        </div>
                                        <span className="flex-grow text-sm leading-4 font-semibold">
                                            Taxas personalizadas
                                        </span>
                                        <span className="text-sm leading-4 whitespace-nowrap">
                                            -{' '}
                                            {new Intl.NumberFormat('pt-BR', {
                                                style: 'currency',
                                                currency: 'BRL',
                                            }).format(extraCosts)}
                                        </span>
                                    </div>
                                </li>
                            ) : null;
                        })()}

                        {/* Comissões (da página Custos e Comissões) */}
                        {(() => {
                            const commissions =
                                typeof order.total_commissions === 'string'
                                    ? parseFloat(order.total_commissions)
                                    : (order.total_commissions ?? 0);

                            return commissions > 0 ? (
                                <li className="flex flex-col gap-2 border-b-1 px-0 py-4">
                                    <div className="flex w-full flex-row items-center gap-2 px-3 py-0">
                                        <div className="flex items-center justify-center rounded-full bg-orange-100 p-0.5 text-orange-900">
                                            <ArrowDownLeft className="h-4 w-4" />
                                        </div>
                                        <span className="flex-grow text-sm leading-4 font-semibold">
                                            Comissões
                                        </span>
                                        <span className="text-sm leading-4 whitespace-nowrap">
                                            -{' '}
                                            {new Intl.NumberFormat('pt-BR', {
                                                style: 'currency',
                                                currency: 'BRL',
                                            }).format(commissions)}
                                        </span>
                                    </div>
                                </li>
                            ) : null;
                        })()}

                        {/* Total líquido */}
                        <li className="flex flex-col gap-2 px-0 py-4">
                            <ul className="flex w-full flex-col items-center justify-between pl-0">
                                <li className="flex w-full flex-row items-start justify-between px-3 py-2">
                                    <span className="text-sm leading-4 font-semibold">
                                        Total líquido
                                    </span>
                                    <span className="positive text-sm leading-4 font-semibold text-green-700">
                                        {(() => {
                                            // Calcular total líquido: total_final - custos - impostos - taxas - comissões
                                            const totalFinal = netTotal;

                                            // Custos dos produtos
                                            const totalCost = (
                                                order.items || []
                                            ).reduce(
                                                (sum: number, item: any) => {
                                                    if (
                                                        item.internal_product
                                                            ?.unit_cost
                                                    ) {
                                                        const quantity =
                                                            item.qty ||
                                                            item.quantity ||
                                                            0;
                                                        const unitCost =
                                                            parseFloat(
                                                                item
                                                                    .internal_product
                                                                    .unit_cost,
                                                            );
                                                        return (
                                                            sum +
                                                            quantity * unitCost
                                                        );
                                                    }
                                                    return sum;
                                                },
                                                0,
                                            );

                                            // Impostos
                                            const totalTax = (
                                                order.items || []
                                            ).reduce(
                                                (sum: number, item: any) => {
                                                    if (
                                                        item.internal_product
                                                            ?.tax_category
                                                            ?.total_tax_rate !==
                                                            undefined &&
                                                        item.internal_product
                                                            ?.tax_category
                                                            ?.total_tax_rate !==
                                                            null
                                                    ) {
                                                        const quantity =
                                                            item.qty ||
                                                            item.quantity ||
                                                            0;
                                                        const unitPrice =
                                                            item.unit_price ||
                                                            item.price ||
                                                            0;
                                                        const itemTotal =
                                                            quantity *
                                                            unitPrice;
                                                        const taxRate =
                                                            item
                                                                .internal_product
                                                                .tax_category
                                                                .total_tax_rate /
                                                            100;
                                                        return (
                                                            sum +
                                                            itemTotal * taxRate
                                                        );
                                                    }
                                                    return sum;
                                                },
                                                0,
                                            );

                                            // Taxas personalizadas
                                            const extraCosts =
                                                typeof order.total_costs ===
                                                'string'
                                                    ? parseFloat(
                                                          order.total_costs,
                                                      )
                                                    : (order.total_costs ?? 0);

                                            // Comissões
                                            const commissions =
                                                typeof order.total_commissions ===
                                                'string'
                                                    ? parseFloat(
                                                          order.total_commissions,
                                                      )
                                                    : (order.total_commissions ??
                                                      0);

                                            const liquidTotal =
                                                totalFinal -
                                                totalCost -
                                                totalTax -
                                                extraCosts -
                                                commissions;

                                            return new Intl.NumberFormat(
                                                'pt-BR',
                                                {
                                                    style: 'currency',
                                                    currency: 'BRL',
                                                },
                                            ).format(liquidTotal);
                                        })()}
                                    </span>
                                </li>
                            </ul>
                        </li>
                    </ul>
                </CardContent>
            </Card>
        );
    }

    // Para iFood e outros providers, mostrar sale ou mensagem padrão
    if (!sale) {
        return (
            <Card className="h-fit gap-1 border-0 bg-gray-100 p-1 text-sm shadow-none dark:bg-neutral-950">
                <CardHeader className="gap-0 bg-gray-100 px-2 py-2 dark:bg-neutral-950">
                    <CardTitle className="flex h-[18px] items-center font-semibold">
                        Detalhamento financeiro do pedido
                    </CardTitle>
                </CardHeader>
                <CardContent className="rounded-md bg-card p-0">
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                        <p className="text-sm text-muted-foreground">
                            Detalhamento financeiro ainda não disponível
                        </p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    // Extrair dados do raw se existir
    const saleRaw = sale.raw || {};
    const financialData = saleRaw.financialData || {};

    // Valores principais
    const grossValue = sale.gross_value || 0;
    const serviceFeePaidByCustomer = sale.service_fee || 0;
    const discountValue = sale.discount_value || 0;
    const netValue = sale.net_value || 0;
    const bagValue = sale.bag_value || 0;
    const deliveryFee = sale.delivery_fee || 0;

    // Calcular taxas e comissões do iFood (estimativa baseada no padrão)
    const paymentCommission =
        financialData.paymentCommission || bagValue * 0.0311; // ~3.11%
    const ifoodCommission = financialData.ifoodCommission || bagValue * 0.12; // 12%
    const totalFees = paymentCommission + ifoodCommission;

    // Calcular total recebido via loja
    const receivedAtStore = bagValue - discountValue;

    // Valor base para cálculo de taxas
    const baseValue = bagValue;

    return (
        <Card className="h-fit gap-1 border-0 bg-gray-100 p-1 text-sm shadow-none dark:bg-neutral-950">
            <CardHeader className="gap-0 bg-gray-100 px-2 py-2 dark:bg-neutral-950">
                <CardTitle className="flex h-[18px] items-center font-semibold">
                    Detalhamento financeiro do pedido
                </CardTitle>
            </CardHeader>
            <CardContent className="rounded-md bg-card p-0">
                <ul className="m-0 flex w-full flex-col ps-0">
                    {/* Valor bruto da venda */}
                    {grossValue > 0 && (
                        <li className="flex flex-col gap-2 border-b-1 px-0 py-4">
                            <div className="flex w-full flex-row items-center gap-2 px-3 py-0">
                                <div className="flex items-center justify-center rounded-full bg-green-100 p-0.5 text-green-800">
                                    <ArrowUpRight className="h-4 w-4" />
                                </div>
                                <span className="flex-grow text-sm leading-4 font-semibold">
                                    Valor bruto da venda
                                </span>
                                <span className="text-sm leading-4 whitespace-nowrap">
                                    {new Intl.NumberFormat('pt-BR', {
                                        style: 'currency',
                                        currency: 'BRL',
                                    }).format(grossValue)}
                                </span>
                            </div>
                            <ul className="flex w-full flex-col items-center justify-between gap-2 pl-0">
                                <li className="flex w-full flex-row items-start justify-between px-3 py-0">
                                    <span className="text-xs leading-4 font-normal text-muted-foreground">
                                        Total recebido via{' '}
                                        {sale.sales_channel || 'iFood'}
                                    </span>
                                </li>
                                {discountValue > 0 && (
                                    <li className="flex w-full flex-row items-start justify-between px-3 py-0">
                                        <span className="text-xs leading-4 font-normal text-muted-foreground">
                                            Promoções custeadas pela loja
                                        </span>
                                    </li>
                                )}
                                {deliveryFee !== undefined && (
                                    <li className="flex w-full flex-row items-start justify-between px-3 py-0">
                                        <span className="text-xs leading-4 font-normal text-muted-foreground">
                                            Taxa de entrega no valor de{' '}
                                            {new Intl.NumberFormat('pt-BR', {
                                                style: 'currency',
                                                currency: 'BRL',
                                            }).format(deliveryFee)}
                                        </span>
                                    </li>
                                )}
                            </ul>
                        </li>
                    )}

                    {/* Valores pagos pelo cliente devidos ao iFood */}
                    {serviceFeePaidByCustomer > 0 && (
                        <li className="flex flex-col gap-2 border-b-1 px-0 py-4">
                            <div className="flex w-full flex-row items-center gap-2 px-3 py-0">
                                <div className="flex items-center justify-center rounded-full bg-red-100 p-0.5 text-red-900">
                                    <ArrowDownLeft className="h-4 w-4" />
                                </div>
                                <span className="flex-grow text-sm leading-4 font-semibold">
                                    Valores pagos pelo cliente devidos ao iFood
                                </span>
                                <span className="text-sm leading-4 whitespace-nowrap">
                                    -{' '}
                                    {new Intl.NumberFormat('pt-BR', {
                                        style: 'currency',
                                        currency: 'BRL',
                                    }).format(serviceFeePaidByCustomer)}
                                </span>
                            </div>
                            <ul className="flex w-full flex-col items-center justify-between pl-0">
                                <li className="flex w-full flex-row items-start justify-between px-3 py-2">
                                    <span className="text-sm leading-4 font-normal">
                                        <div className="flex h-[1em] items-center">
                                            <span>
                                                Taxa de serviço iFood cobrada do
                                                cliente
                                            </span>
                                        </div>
                                    </span>
                                    <span className="text-sm leading-4 font-normal whitespace-nowrap text-gray-700">
                                        -{' '}
                                        {new Intl.NumberFormat('pt-BR', {
                                            style: 'currency',
                                            currency: 'BRL',
                                        }).format(serviceFeePaidByCustomer)}
                                    </span>
                                </li>
                            </ul>
                        </li>
                    )}

                    {/* Promoções */}
                    {discountValue > 0 && (
                        <li className="flex flex-col gap-2 border-b-1 px-0 py-4">
                            <div className="flex w-full flex-row items-center gap-2 px-3 py-0">
                                <div className="flex items-center justify-center rounded-full bg-red-100 p-0.5 text-red-900">
                                    <ArrowDownLeft className="h-4 w-4" />
                                </div>
                                <span className="flex-grow text-sm leading-4 font-semibold">
                                    Promoções
                                </span>
                                <span className="text-sm leading-4 whitespace-nowrap">
                                    -{' '}
                                    {new Intl.NumberFormat('pt-BR', {
                                        style: 'currency',
                                        currency: 'BRL',
                                    }).format(discountValue)}
                                </span>
                            </div>
                            <ul className="flex w-full flex-col items-center justify-between gap-2 pl-0">
                                <li className="flex w-full flex-row items-start justify-between px-3 py-2">
                                    <span className="text-sm leading-4 font-normal">
                                        Promoção custeada pela loja
                                    </span>
                                    <span className="text-sm leading-4 font-normal whitespace-nowrap text-gray-700">
                                        -{' '}
                                        {new Intl.NumberFormat('pt-BR', {
                                            style: 'currency',
                                            currency: 'BRL',
                                        }).format(discountValue)}
                                    </span>
                                </li>
                            </ul>
                        </li>
                    )}

                    {/* Total recebido via loja */}
                    <li className="flex flex-col gap-2 border-b-1 px-0 py-4">
                        <div className="flex w-full flex-row items-center gap-2 px-3 py-0">
                            <div className="flex items-center justify-center rounded-full bg-gray-200 p-1 text-gray-700">
                                <ArrowRightLeft className="h-3 w-3" />
                            </div>
                            <span className="flex-grow text-sm leading-4 font-semibold">
                                Total recebido via loja
                            </span>
                            <span className="text-sm leading-4 whitespace-nowrap">
                                {new Intl.NumberFormat('pt-BR', {
                                    style: 'currency',
                                    currency: 'BRL',
                                }).format(receivedAtStore)}
                            </span>
                        </div>
                        <ul className="flex w-full flex-col items-center justify-between pl-0">
                            <li className="flex w-full flex-row items-start justify-between px-3 py-2">
                                <span className="text-sm leading-4 font-normal whitespace-nowrap text-gray-700">
                                    Pedido recebido via{' '}
                                    {sale.sales_channel || 'iFood'} no valor de{' '}
                                    {new Intl.NumberFormat('pt-BR', {
                                        style: 'currency',
                                        currency: 'BRL',
                                    }).format(bagValue)}
                                </span>
                            </li>
                        </ul>
                    </li>

                    {/* Taxas e comissões iFood */}
                    {totalFees > 0 && (
                        <li className="flex flex-col gap-2 border-b-1 px-0 py-4">
                            <div className="flex w-full flex-row items-center gap-2 px-3 py-0">
                                <div className="flex items-center justify-center rounded-full bg-red-100 p-0.5 text-red-900">
                                    <ArrowDownLeft className="h-4 w-4" />
                                </div>
                                <span className="flex-grow text-sm leading-4 font-semibold">
                                    Taxas e comissões{' '}
                                    {sale.sales_channel || 'iFood'}
                                </span>
                                <span className="text-sm leading-4 whitespace-nowrap">
                                    -{' '}
                                    {new Intl.NumberFormat('pt-BR', {
                                        style: 'currency',
                                        currency: 'BRL',
                                    }).format(totalFees)}
                                </span>
                            </div>
                            <ul className="flex w-full flex-col items-center justify-between pl-0">
                                <li className="flex w-full flex-row items-start justify-between px-3 py-2">
                                    <span className="text-sm leading-4 font-normal">
                                        Comissão pela transação do pagamento
                                    </span>
                                    <span className="text-sm leading-4 font-normal whitespace-nowrap text-gray-700">
                                        -{' '}
                                        {new Intl.NumberFormat('pt-BR', {
                                            style: 'currency',
                                            currency: 'BRL',
                                        }).format(paymentCommission)}
                                    </span>
                                </li>
                                <li className="flex w-full flex-row items-start justify-between px-3 py-2">
                                    <span className="text-sm leading-4 font-normal">
                                        Comissão {sale.sales_channel || 'iFood'}{' '}
                                        (12,0%)
                                    </span>
                                    <span className="text-sm leading-4 font-normal whitespace-nowrap text-gray-700">
                                        -{' '}
                                        {new Intl.NumberFormat('pt-BR', {
                                            style: 'currency',
                                            currency: 'BRL',
                                        }).format(ifoodCommission)}
                                    </span>
                                </li>
                                <li className="flex w-full flex-row items-start justify-between px-3 py-2">
                                    <span className="text-xs leading-4 font-normal text-gray-700">
                                        O valor de{' '}
                                        {new Intl.NumberFormat('pt-BR', {
                                            style: 'currency',
                                            currency: 'BRL',
                                        }).format(baseValue)}{' '}
                                        é o valor base usado para calcular as
                                        taxas e comissões{' '}
                                        {sale.sales_channel || 'iFood'} desse
                                        pedido.
                                    </span>
                                </li>
                            </ul>
                        </li>
                    )}

                    {/* Valor líquido a receber */}
                    <li className="flex flex-col gap-2 px-0 py-4">
                        <ul className="flex w-full flex-col items-center justify-between pl-0">
                            <li className="flex w-full flex-row items-start justify-between px-3 py-2">
                                <span className="text-sm leading-4 font-semibold">
                                    Valor líquido a receber
                                </span>
                                <span className="positive text-sm leading-4 font-semibold text-green-700">
                                    {new Intl.NumberFormat('pt-BR', {
                                        style: 'currency',
                                        currency: 'BRL',
                                    }).format(netValue)}
                                </span>
                            </li>
                        </ul>
                    </li>
                </ul>
            </CardContent>
        </Card>
    );
}
