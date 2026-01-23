import {
    CostCommissionItem,
    Order,
    OrderItem,
    OrderItemMapping,
} from '@/components/orders/columns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import {
    calculateOrderCMV,
    isTakeatIfoodOrder,
} from '@/lib/order-calculations';
import {
    AlertCircle,
    ArrowDownLeft,
    ArrowRightLeft,
    ArrowUpRight,
    Box,
    Check,
    CupSoda,
    DollarSign,
    IceCream2,
    Layers,
    Link2 as LinkIcon,
    Package,
    Pizza,
    Plus,
    Plus as PlusIcon,
    UtensilsCrossed,
} from 'lucide-react';
import { useState } from 'react';
import { CreatePaymentFeeDialog } from './create-payment-fee-dialog';
import { LinkPaymentFeeDialog } from './link-payment-fee-dialog';
import { QuickLinkDialog } from './quick-link-dialog';

const OPTION_TYPE_TO_ITEM_TYPE: Record<string, string> = {
    pizza_flavor: 'flavor',
    drink: 'beverage',
    addon: 'complement',
    regular: 'optional',
    observation: 'optional',
};

const TAKEAT_IFOOD_SERVICE_FEE = 0.99; // Mantém alinhado com OrderCostService.php

const resolveItemType = (
    productMappingType?: string | null,
    optionType?: string | null,
): string | null => {
    if (productMappingType) {
        return productMappingType;
    }

    if (!optionType) {
        return null;
    }

    const normalized = optionType.toLowerCase();
    return OPTION_TYPE_TO_ITEM_TYPE[normalized] ?? null;
};

/**
 * Calcula o custo de um item considerando múltiplas associações
 */
function calculateItemCost(item: OrderItem): number {
    const itemQuantity = item.qty || item.quantity || 0;

    // Novo sistema: usar mappings se existir
    if (item.mappings && item.mappings.length > 0) {
        // Separar mappings do tipo 'main' (item principal) dos add-ons
        const mainMappings = item.mappings.filter(
            (m: OrderItemMapping) => m.mapping_type === 'main',
        );

        // Se tem mapping 'main', calcular APENAS dele (ignorar add-ons aqui)
        if (mainMappings.length > 0) {
            const mappingsCost = mainMappings.reduce(
                (sum: number, mapping: OrderItemMapping) => {
                    if (mapping.internal_product?.unit_cost) {
                        const unitCost = parseFloat(
                            mapping.internal_product.unit_cost,
                        );
                        const mappingQuantity = mapping.quantity || 1;
                        return sum + unitCost * mappingQuantity;
                    }
                    return sum;
                },
                0,
            );
            return mappingsCost * itemQuantity;
        }

        // Se NÃO tem mapping 'main', mas tem add-ons, retorna 0
        // (os add-ons serão mostrados separadamente abaixo)
        return 0;
    }

    // Fallback: sistema legado (internal_product direto)
    if (item.internal_product?.unit_cost) {
        const unitCost = parseFloat(item.internal_product.unit_cost);
        return unitCost * itemQuantity;
    }

    // Se não tem nada, usar total_cost do backend se existir
    if (item.total_cost !== undefined && item.total_cost !== null) {
        return parseFloat(String(item.total_cost));
    }

    return 0;
}

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
        raw?: unknown;
    };
    order?: Order;
};

export function OrderFinancialCard({
    sale,
    order,
    internalProducts = [],
}: OrderFinancialCardProps) {
    // Estado para controlar o dialog de criação de taxa
    const [isCreateFeeDialogOpen, setIsCreateFeeDialogOpen] = useState(false);
    const [selectedPayment, setSelectedPayment] = useState<{
        method: string;
        name: string;
    } | null>(null);

    // Estado para controlar o dialog de vinculação de taxa existente
    const [isLinkFeeDialogOpen, setIsLinkFeeDialogOpen] = useState(false);
    const [availableFees, setAvailableFees] = useState<any[]>([]);
    const [loadingFees, setLoadingFees] = useState(false);

    // Estado para controlar o dialog de vinculação rápida
    const [isQuickLinkDialogOpen, setIsQuickLinkDialogOpen] = useState(false);
    const [selectedItemToLink, setSelectedItemToLink] = useState<{
        sku?: string;
        name: string;
        occurrences?: number;
    } | null>(null);

    // Função para recarregar dados do pedido
    const handleReloadOrder = () => {
        if (order?.id) {
            router.reload({
                only: ['order'],
                preserveScroll: true,
                preserveState: true,
            });
        }
    };

    // Função helper para calcular todos os valores financeiros
    const calculateFinancials = () => {
        // Para Takeat:
        // - orderTotal (Pedido) = old_total_price OU total_price (valor dos itens)
        // - grossTotal = total_delivery_price (usado para cálculo de subtotal)
        let orderTotal = parseFloat(String(order?.gross_total || '0')) || 0; // Valor do pedido (itens)
        let grossTotal = parseFloat(String(order?.gross_total || '0')) || 0; // Usado para subtotal

        if (order?.provider === 'takeat') {
            // orderTotal = valor dos itens ANTES do desconto (para exibição)
            if (order?.raw?.session?.old_total_price) {
                orderTotal =
                    parseFloat(String(order.raw.session.old_total_price)) || 0;
            } else if (order?.raw?.session?.total_price) {
                orderTotal =
                    parseFloat(String(order.raw.session.total_price)) || 0;
            }

            // grossTotal = valor APÓS desconto (usado no cálculo de subtotal/receita)
            // Prioridade: total_delivery_price > total_price > order.gross_total (fallback)
            if (order?.raw?.session?.total_delivery_price) {
                grossTotal =
                    parseFloat(
                        String(order.raw.session.total_delivery_price),
                    ) || 0;
            } else if (order?.raw?.session?.total_price) {
                grossTotal =
                    parseFloat(String(order.raw.session.total_price)) || 0;
            }
            // Se ainda estiver zerado, usar order.gross_total como fallback
            if (grossTotal === 0 && order?.gross_total) {
                grossTotal = parseFloat(String(order.gross_total)) || 0;
            }
        }

        const discountTotal =
            parseFloat(String(order?.discount_total || '0')) || 0;
        const deliveryFee = parseFloat(String(order?.delivery_fee || '0')) || 0;
        const rawSessionServiceFee =
            parseFloat(
                String(
                    order?.raw?.session?.service_fee ??
                        order?.raw?.session?.serviceFee ??
                        0,
                ),
            ) || 0;
        const ifoodServiceFee = isTakeatIfoodOrder(order)
            ? rawSessionServiceFee > 0
                ? rawSessionServiceFee
                : TAKEAT_IFOOD_SERVICE_FEE
            : 0;
        const netTotal = parseFloat(String(order?.net_total || '0')) || 0;

        // Subsídio e métodos de pagamento (dos pagamentos da sessão)
        const sessionPayments = order?.raw?.session?.payments || [];

        // Filtrar pagamentos de cashback (desconto da loja, não subsídio)
        const cashbackPayments = sessionPayments.filter((payment: unknown) => {
            const p = payment as {
                payment_method?: { name?: string; keyword?: string };
            };
            const paymentName = p.payment_method?.name?.toLowerCase() || '';
            const paymentKeyword =
                p.payment_method?.keyword?.toLowerCase() || '';
            return (
                paymentName.includes('cashback') ||
                paymentKeyword.includes('clube')
            );
        });

        // Filtrar pagamentos subsidiados (excluindo cashback)
        const subsidyPayments = sessionPayments.filter((payment: unknown) => {
            const p = payment as {
                payment_method?: { name?: string; keyword?: string };
            };
            const paymentName = p.payment_method?.name?.toLowerCase() || '';
            const paymentKeyword =
                p.payment_method?.keyword?.toLowerCase() || '';
            const isCashback =
                paymentName.includes('cashback') ||
                paymentKeyword.includes('clube');
            const isSubsidy =
                paymentName.includes('subsid') ||
                paymentName.includes('cupom') ||
                paymentKeyword.includes('subsid') ||
                paymentKeyword.includes('cupom');
            return isSubsidy && !isCashback;
        });

        // Filtrar pagamentos reais (não subsidiados e não cashback)
        const realPayments = sessionPayments.filter((payment: unknown) => {
            const p = payment as {
                payment_method?: { name?: string; keyword?: string };
                payment_value?: number;
            };
            const paymentName = p.payment_method?.name?.toLowerCase() || '';
            const paymentKeyword =
                p.payment_method?.keyword?.toLowerCase() || '';
            const isCashback =
                paymentName.includes('cashback') ||
                paymentKeyword.includes('clube');
            const isSubsidized =
                paymentName.includes('subsid') ||
                paymentName.includes('cupom') ||
                paymentKeyword.includes('subsid') ||
                paymentKeyword.includes('cupom');
            return !isSubsidized && !isCashback && (p.payment_value || 0) > 0;
        });

        const totalSubsidy = subsidyPayments.reduce(
            (sum: number, payment: unknown) => {
                const p = payment as { payment_value?: string | number };
                const value = parseFloat(String(p.payment_value || '0')) || 0;
                return sum + value;
            },
            0,
        );

        // Total de cashback (desconto da loja)
        const totalCashback = cashbackPayments.reduce(
            (sum: number, payment: unknown) => {
                const p = payment as { payment_value?: string | number };
                const value = parseFloat(String(p.payment_value || '0')) || 0;
                return sum + value;
            },
            0,
        );

        // Desconto loja = desconto - subsídio + cashback
        const storeDiscount = discountTotal - totalSubsidy + totalCashback;

        // Pago pelo cliente (soma dos pagamentos reais)
        let paidByClient = realPayments.reduce(
            (sum: number, payment: unknown) => {
                const p = payment as { payment_value?: string | number };
                const value = parseFloat(String(p.payment_value || '0')) || 0;
                return sum + value;
            },
            0,
        );

        // Se não houver pagamentos, usar old_total_price como fallback
        if (paidByClient === 0 && realPayments.length === 0) {
            if (
                order?.provider === 'takeat' &&
                order?.raw?.session?.old_total_price
            ) {
                // Para Takeat, usar total_price (já com desconto) ao invés de old_total_price
                // old_total_price é o valor antes do desconto
                const totalPrice =
                    parseFloat(String(order.raw.session.total_price)) || 0;
                paidByClient = totalPrice;
            } else if (
                order?.provider === 'takeat' &&
                order?.raw?.session?.total_price
            ) {
                paidByClient =
                    parseFloat(String(order.raw.session.total_price)) || 0;
            } else {
                paidByClient =
                    parseFloat(String(order?.gross_total || '0')) || 0;
            }
        }

        // Subtotal para cálculo de receita líquida
        // Começar com grossTotal e aplicar ajustes
        // IMPORTANTE: grossTotal já pode incluir ou não os descontos dependendo da fonte
        let subtotal = grossTotal;

        // Aplicar desconto de loja (descontos reais pagos pela loja, não subsídios)
        subtotal -= storeDiscount;

        // Verifica se usou total_delivery_price (que já inclui subsídio e delivery)
        const usedTotalDeliveryPrice =
            order?.provider === 'takeat' &&
            Boolean(order?.raw?.session?.total_delivery_price);

        // Verificar se a entrega foi feita pelo marketplace
        // Quando for pelo marketplace, a taxa de entrega já está em calculated_costs como custo
        const deliveryBy =
            order?.raw?.session?.delivery_by?.toUpperCase() || '';
        const isMarketplaceDelivery = ['IFOOD', 'MARKETPLACE'].includes(
            deliveryBy,
        );

        // Se NÃO usou total_delivery_price, precisa somar subsídio e (quando aplicável) delivery
        if (!usedTotalDeliveryPrice) {
            subtotal += totalSubsidy;
            // Só somar deliveryFee ao subtotal se a entrega for pela LOJA (não marketplace)
            // Quando é marketplace, a taxa já está em calculated_costs como custo
            if (!isMarketplaceDelivery && deliveryFee > 0) {
                subtotal += deliveryFee;
            }
        } else if (isMarketplaceDelivery && deliveryFee > 0) {
            // total_delivery_price inclui delivery; remover se for entrega marketplace
            subtotal -= deliveryFee;
        }

        // Descontar cashback do subtotal (é desconto da loja)
        subtotal -= totalCashback;

        // Taxa fixa do iFood reduz o valor recebido pelo lojista
        // Sempre subtrair para pedidos iFood via Takeat (independente de delivery_by)
        if (ifoodServiceFee > 0) {
            subtotal -= ifoodServiceFee;
        }

        // CMV (custo dos produtos + add-ons)
        const items = order?.items || [];
        const cmv = calculateOrderCMV(items);

        // Impostos dos produtos
        const productTax = items.reduce((sum: number, item: OrderItem) => {
            if (item.internal_product?.tax_category?.total_tax_rate) {
                const quantity = item.qty || item.quantity || 0;
                const unitPrice = item.unit_price || item.price || 0;
                const taxRate =
                    item.internal_product.tax_category.total_tax_rate || 0;
                const taxValue = (quantity * unitPrice * taxRate) / 100;
                // Proteção contra NaN
                return sum + (isNaN(taxValue) ? 0 : taxValue);
            }
            return sum;
        }, 0);

        // Impostos adicionais (da categoria 'tax' em cost_commissions)
        const calculatedCosts = order?.calculated_costs || null;
        const additionalTaxes = calculatedCosts?.taxes || [];
        const totalAdditionalTax = additionalTaxes.reduce(
            (sum: number, tax: CostCommissionItem) =>
                sum + (tax.calculated_value || 0),
            0,
        );

        // Total de impostos = impostos dos produtos + impostos adicionais
        const totalTax = productTax + totalAdditionalTax;

        // Custos operacionais (do order.total_costs)
        const totalCosts =
            typeof order?.total_costs === 'string'
                ? parseFloat(order.total_costs)
                : (order?.total_costs ?? 0);

        // Comissões (do order.total_commissions)
        const totalCommissions =
            typeof order?.total_commissions === 'string'
                ? parseFloat(order.total_commissions)
                : (order?.total_commissions ?? 0);

        // Comissões do marketplace (category='commission')
        const commissions = calculatedCosts?.commissions || [];
        const marketplaceCommissions = commissions.reduce(
            (sum: number, comm: CostCommissionItem) =>
                sum + (comm.calculated_value || 0),
            0,
        );

        // Custos de entrega do marketplace (category='cost' com 'delivery' no nome ou applies_to='delivery')
        const costs = calculatedCosts?.costs || [];
        const marketplaceDeliveryCosts = costs.reduce(
            (sum: number, cost: CostCommissionItem) => {
                // Verificar se é custo de entrega (nome contém 'entrega' ou 'delivery')
                const isDeliveryCost =
                    cost.name?.toLowerCase().includes('entrega') ||
                    cost.name?.toLowerCase().includes('delivery');
                return isDeliveryCost
                    ? sum + (cost.calculated_value || 0)
                    : sum;
            },
            0,
        );

        // Taxas do meio de pagamento (da categoria 'payment_method' em cost_commissions)
        const paymentMethodFees = calculatedCosts?.payment_methods || [];
        const totalPaymentMethodFee = paymentMethodFees.reduce(
            (sum: number, fee: CostCommissionItem) =>
                sum + (fee.calculated_value || 0),
            0,
        );

        // Verificar se o pedido tem pagamento online
        const hasOnlinePayment = realPayments.some((payment: any) => {
            const paymentKeyword = (
                payment.payment_method?.keyword || ''
            ).toLowerCase();
            return (
                paymentKeyword.includes('pagamento_online') ||
                paymentKeyword.includes('ifood') ||
                paymentKeyword.includes('online')
            );
        });

        // Taxas de pagamento online
        // Se o pedido tem pagamento online, considerar TODAS as taxas de pagamento como online
        // Caso contrário, filtrar apenas payment_type='online'
        const totalOnlinePaymentFee = hasOnlinePayment
            ? totalPaymentMethodFee
            : paymentMethodFees
                  .filter(
                      (fee: CostCommissionItem) =>
                          fee.payment_type === 'online',
                  )
                  .reduce(
                      (sum: number, fee: CostCommissionItem) =>
                          sum + (fee.calculated_value || 0),
                      0,
                  );

        // Receita líquida marketplace = Subtotal - Comissão Marketplace - Custo Entrega Marketplace (se aplicável) - Taxa Pagamento Online
        // Só descontar marketplaceDeliveryCosts se a entrega foi pelo marketplace
        // Nota: As comissões do marketplace já incluem a taxa fixa do iFood se cadastrada pelo usuário
        const marketplaceNetRevenue =
            subtotal -
            marketplaceCommissions -
            (isMarketplaceDelivery ? marketplaceDeliveryCosts : 0) -
            totalOnlinePaymentFee;

        // Líquido = Subtotal - CMV - Impostos - Custos - Comissão - Taxas de Pagamento
        const netRevenue =
            subtotal -
            cmv -
            totalTax -
            totalCosts -
            totalCommissions -
            totalPaymentMethodFee;

        return {
            orderTotal, // Valor do pedido (itens antes de desconto)
            grossTotal,
            discountTotal,
            storeDiscount,
            paidByClient,
            totalSubsidy,
            totalCashback,
            subtotal,
            cmv,
            productTax,
            additionalTaxes,
            totalTax,
            totalCosts,
            totalCommissions,
            paymentMethodFees,
            totalPaymentMethodFee,
            marketplaceNetRevenue,
            netRevenue,
            deliveryFee,
            realPayments,
            ifoodServiceFee,
        };
    };

    // Se for Takeat, sempre usar dados do raw (não terá sale)
    if (order?.provider === 'takeat' && order.raw?.session) {
        const session = order.raw.session;
        const financials = calculateFinancials();
        const isDelivery = session.is_delivery;
        const channel = session.sales_channel || order.origin.toUpperCase();

        // Helper para formatar valores
        const formatCurrency = (value: number) => {
            // Proteção contra NaN
            if (isNaN(value) || !isFinite(value)) {
                return 'R$ 0,00';
            }
            return new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL',
            }).format(value);
        };

        // Helper para formatar porcentagem
        const formatPercentage = (value: number, total: number) => {
            // Proteção contra valores inválidos ou divisão por zero
            if (
                isNaN(value) ||
                isNaN(total) ||
                !isFinite(value) ||
                !isFinite(total) ||
                total === 0
            ) {
                return '0,0%';
            }
            const percentage = (value / total) * 100;
            // Permitir valores negativos
            return `${percentage.toFixed(1).replace('.', ',')}%`;
        };

        return (
            <>
                <Card className="h-fit gap-1 border-0 bg-gray-100 p-1 text-sm shadow-none dark:bg-neutral-950">
                    <CardHeader className="gap-0 bg-gray-100 px-2 py-2 dark:bg-neutral-950">
                        <CardTitle className="flex h-[18px] items-center font-semibold">
                            Detalhamento financeiro do pedido
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="rounded-md bg-card p-0">
                        <ul className="m-0 flex w-full flex-col ps-0">
                            {/* Total do Pedido */}
                            <li className="flex flex-col gap-2 border-b-1 px-0 py-4">
                                <div className="flex w-full flex-row items-center gap-2 px-3 py-0">
                                    <div className="flex items-center justify-center rounded-full bg-blue-100 p-0.5 text-blue-900">
                                        <ArrowUpRight className="h-4 w-4" />
                                    </div>
                                    <span className="flex-grow text-sm leading-4 font-semibold">
                                        Total do pedido
                                    </span>
                                    <span className="text-sm leading-4 font-semibold whitespace-nowrap">
                                        {formatCurrency(financials.orderTotal)}
                                    </span>
                                    <span className="text-sm leading-4 font-medium whitespace-nowrap text-muted-foreground">
                                        {formatPercentage(
                                            financials.orderTotal,
                                            financials.subtotal,
                                        )}
                                    </span>
                                </div>
                            </li>

                            {/* Taxa de entrega */}
                            {financials.deliveryFee > 0 && (
                                <li className="flex flex-col gap-2 border-b-1 px-0 py-4">
                                    <div className="flex w-full flex-row items-center gap-2 px-3 py-0">
                                        <div className="flex items-center justify-center rounded-full bg-blue-100 p-0.5 text-blue-900">
                                            <ArrowUpRight className="h-4 w-4" />
                                        </div>
                                        <span className="flex-grow text-sm leading-4 font-semibold">
                                            Taxa de entrega
                                        </span>
                                        <span className="text-sm leading-4 font-semibold whitespace-nowrap">
                                            {formatCurrency(
                                                financials.deliveryFee,
                                            )}
                                        </span>
                                        <span className="text-sm leading-4 font-medium whitespace-nowrap text-muted-foreground">
                                            {formatPercentage(
                                                financials.deliveryFee,
                                                financials.subtotal,
                                            )}
                                        </span>
                                    </div>
                                </li>
                            )}

                            {/* Taxa fixa do iFood repassada ao cliente */}
                            {financials.ifoodServiceFee > 0 && (
                                <li className="flex flex-col gap-2 border-b-1 px-0 py-4">
                                    <div className="flex w-full flex-row items-center gap-2 px-3 py-0">
                                        <div className="flex items-center justify-center rounded-full bg-red-100 p-0.5 text-red-900">
                                            <ArrowDownLeft className="h-4 w-4" />
                                        </div>
                                        <span className="flex-grow text-sm leading-4 font-semibold">
                                            Taxa de serviço iFood
                                        </span>
                                        <span className="text-sm leading-4 font-semibold whitespace-nowrap">
                                            {formatCurrency(
                                                financials.ifoodServiceFee,
                                            )}
                                        </span>
                                        <span className="text-sm leading-4 font-medium whitespace-nowrap text-muted-foreground">
                                            {formatPercentage(
                                                financials.ifoodServiceFee,
                                                financials.subtotal,
                                            )}
                                        </span>
                                    </div>
                                    <div className="flex w-full flex-row items-center gap-2 px-3 pb-0 text-xs text-muted-foreground">
                                        Taxa cobrada do cliente e retida pelo
                                        iFood
                                    </div>
                                </li>
                            )}

                            {/* Cashback */}
                            {financials.totalCashback > 0 && (
                                <li className="flex flex-col gap-2 border-b-1 px-0 py-4">
                                    <div className="flex w-full flex-row items-center gap-2 px-3 py-0">
                                        <div className="flex items-center justify-center rounded-full bg-red-100 p-0.5 text-red-900">
                                            <ArrowDownLeft className="h-4 w-4" />
                                        </div>
                                        <span className="flex-grow text-sm leading-4 font-semibold">
                                            Cashback (desconto da loja)
                                        </span>
                                        <span className="text-sm leading-4 font-semibold whitespace-nowrap">
                                            -
                                            {formatCurrency(
                                                financials.totalCashback,
                                            )}
                                        </span>
                                        <span className="text-sm leading-4 font-medium whitespace-nowrap text-muted-foreground">
                                            {formatPercentage(
                                                financials.totalCashback,
                                                financials.subtotal,
                                            )}
                                        </span>
                                    </div>
                                </li>
                            )}

                            {/* Descontos */}
                            {financials.discountTotal > 0 && (
                                <li className="flex flex-col gap-2 border-b-1 px-0 py-4">
                                    <div className="flex w-full flex-row items-center gap-2 px-3 py-0">
                                        <div className="flex items-center justify-center rounded-full bg-red-100 p-0.5 text-red-900">
                                            <ArrowDownLeft className="h-4 w-4" />
                                        </div>
                                        <span className="flex-grow text-sm leading-4 font-semibold">
                                            Descontos
                                        </span>
                                        <span className="text-sm leading-4 whitespace-nowrap">
                                            -
                                            {formatCurrency(
                                                financials.discountTotal,
                                            )}
                                        </span>
                                        <span className="text-sm leading-4 font-medium whitespace-nowrap text-muted-foreground">
                                            {formatPercentage(
                                                financials.discountTotal,
                                                financials.subtotal,
                                            )}
                                        </span>
                                    </div>
                                    <ul className="flex w-full flex-col items-center justify-between gap-1 pt-2 pl-0">
                                        {financials.storeDiscount > 0 && (
                                            <li className="flex w-full flex-row items-start justify-between px-3 py-0">
                                                <span className="text-xs leading-4 font-normal text-muted-foreground">
                                                    Desconto da loja
                                                </span>
                                                <span className="text-xs leading-4 font-normal whitespace-nowrap text-muted-foreground">
                                                    -
                                                    {formatCurrency(
                                                        financials.storeDiscount,
                                                    )}
                                                </span>
                                            </li>
                                        )}
                                        {financials.totalCashback > 0 && (
                                            <li className="flex w-full flex-row items-start justify-between px-3 py-0">
                                                <span className="text-xs leading-4 font-normal text-muted-foreground">
                                                    Cashback (desconto da loja)
                                                </span>
                                                <span className="text-xs leading-4 font-normal whitespace-nowrap text-muted-foreground">
                                                    -
                                                    {formatCurrency(
                                                        financials.totalCashback,
                                                    )}
                                                </span>
                                            </li>
                                        )}
                                        {financials.totalSubsidy > 0 && (
                                            <li className="flex w-full flex-row items-start justify-between px-3 py-0">
                                                <span className="text-xs leading-4 font-normal text-muted-foreground">
                                                    Desconto do marketplace
                                                    (subsídio)
                                                </span>
                                                <span className="text-xs leading-4 font-normal whitespace-nowrap text-muted-foreground">
                                                    -
                                                    {formatCurrency(
                                                        financials.totalSubsidy,
                                                    )}
                                                </span>
                                            </li>
                                        )}
                                        {session.discount_obs && (
                                            <li className="flex w-full flex-row items-start justify-between px-3 py-2">
                                                <span className="text-xs leading-4 font-normal text-muted-foreground italic">
                                                    {session.discount_obs}
                                                </span>
                                            </li>
                                        )}
                                    </ul>
                                </li>
                            )}

                            {/* Pago pelo cliente */}
                            <li className="flex flex-col gap-2 border-b-1 px-0 py-4">
                                <div className="flex w-full flex-row items-center gap-2 px-3 py-0">
                                    <div className="flex items-center justify-center rounded-full bg-green-100 p-0.5 text-green-900">
                                        <ArrowUpRight className="h-4 w-4" />
                                    </div>
                                    <span className="flex-grow text-sm leading-4 font-semibold">
                                        Pago pelo cliente
                                    </span>
                                    <span className="text-sm leading-4 font-semibold whitespace-nowrap">
                                        {formatCurrency(
                                            financials.paidByClient,
                                        )}
                                    </span>
                                    <span className="text-sm leading-4 font-medium whitespace-nowrap text-muted-foreground">
                                        {formatPercentage(
                                            financials.paidByClient,
                                            financials.subtotal,
                                        )}
                                    </span>
                                </div>
                            </li>

                            {/* Subsídio do marketplace */}
                            {financials.totalSubsidy > 0 && (
                                <li className="flex flex-col gap-2 px-0 py-4">
                                    <div className="flex w-full flex-row items-center gap-2 px-3 py-0">
                                        <div className="flex items-center justify-center rounded-full bg-green-100 p-0.5 text-green-900">
                                            <ArrowUpRight className="h-4 w-4" />
                                        </div>
                                        <span className="flex-grow text-sm leading-4 font-semibold">
                                            Subsídio do marketplace
                                        </span>
                                        <span className="text-sm leading-4 font-semibold whitespace-nowrap text-green-700">
                                            {formatCurrency(
                                                financials.totalSubsidy,
                                            )}
                                        </span>
                                        <span className="text-sm leading-4 font-medium whitespace-nowrap text-muted-foreground">
                                            {formatPercentage(
                                                financials.totalSubsidy,
                                                financials.subtotal,
                                            )}
                                        </span>
                                    </div>
                                </li>
                            )}

                            {/* Linha separadora */}
                            <li className="border-b-3 border-gray-100"></li>

                            {/* Subtotal */}
                            <li className="flex flex-col gap-2 border-b-1 px-0 py-4">
                                <div className="flex w-full flex-row items-center gap-2 px-3 py-0">
                                    <div className="flex items-center justify-center rounded-full bg-gray-200 p-1 text-gray-700">
                                        <ArrowRightLeft className="h-3 w-3" />
                                    </div>
                                    <span className="flex-grow text-sm leading-4 font-semibold">
                                        Subtotal
                                    </span>
                                    <span className="text-sm leading-4 font-semibold whitespace-nowrap">
                                        {formatCurrency(financials.subtotal)}
                                    </span>
                                    <span className="text-sm leading-4 font-medium whitespace-nowrap text-muted-foreground">
                                        100,0%
                                    </span>
                                </div>
                                <ul className="flex w-full flex-col items-center justify-between gap-2 pl-0">
                                    <li className="flex w-full flex-row items-start justify-between px-3 py-0">
                                        <span className="text-xs leading-4 font-normal text-muted-foreground">
                                            Total pag. pelo cliente + Subsídio
                                        </span>
                                    </li>
                                </ul>
                            </li>

                            {/* CMV */}
                            {(() => {
                                const items = order.items || [];

                                // Sempre mostrar a seção CMV, mesmo sem mapeamentos
                                return (
                                    <li className="flex flex-col gap-2 border-b-1 px-0 py-4">
                                        <div className="flex w-full flex-row items-center gap-2 px-3 py-0">
                                            <div className="flex items-center justify-center rounded-full bg-orange-100 p-0.5 text-orange-900">
                                                <ArrowDownLeft className="h-4 w-4" />
                                            </div>
                                            <span className="flex-grow text-sm leading-4 font-semibold">
                                                Custo dos produtos (CMV)
                                            </span>
                                            <span className="text-sm leading-4 whitespace-nowrap">
                                                {formatCurrency(financials.cmv)}
                                            </span>
                                            <span className="text-sm leading-4 font-medium whitespace-nowrap text-muted-foreground">
                                                {formatPercentage(
                                                    financials.cmv,
                                                    financials.subtotal,
                                                )}
                                            </span>
                                        </div>
                                        {/* Detalhamento dos custos por produto */}
                                        <ul className="flex w-full flex-col items-center justify-between pl-0">
                                            {items.map((item: OrderItem) => {
                                                // DEBUG: Log PRIMEIRO quando processa cada item
                                                console.log(
                                                    `[DEBUG START] Processando OrderItem ${item.id}`,
                                                    {
                                                        name: item.name,
                                                        has_add_ons:
                                                            !!item.add_ons,
                                                        add_ons_length:
                                                            Array.isArray(
                                                                item.add_ons,
                                                            )
                                                                ? item.add_ons
                                                                      .length
                                                                : 0,
                                                        has_add_ons_product_mappings:
                                                            !!item.add_ons_product_mappings,
                                                        add_ons_product_mappings:
                                                            item.add_ons_product_mappings,
                                                    },
                                                );

                                                // Custo apenas do item principal (add-ons são listados separadamente abaixo)
                                                const itemTotalCost =
                                                    calculateItemCost(item);

                                                const quantity =
                                                    item.qty ||
                                                    item.quantity ||
                                                    0;
                                                const hasMappings =
                                                    item.mappings &&
                                                    item.mappings.length > 0;
                                                const hasLegacyProduct =
                                                    !hasMappings &&
                                                    item.internal_product
                                                        ?.unit_cost;

                                                // Verificar se tem produto interno vinculado no ITEM PRINCIPAL (mapping tipo 'main')
                                                // Não considerar apenas add-ons - esses são mostrados separadamente
                                                const hasInternalProduct =
                                                    hasMappings
                                                        ? item.mappings.some(
                                                              (
                                                                  m: OrderItemMapping,
                                                              ) =>
                                                                  m.mapping_type ===
                                                                      'main' &&
                                                                  m.internal_product_id !==
                                                                      null &&
                                                                  m.internal_product !==
                                                                      null &&
                                                                  m.internal_product !==
                                                                      undefined,
                                                          )
                                                        : hasLegacyProduct;

                                                // Verificar se tem ProductMapping COM produto vinculado
                                                const hasProductMapping =
                                                    item.product_mapping
                                                        ?.internal_product_id !=
                                                    null;

                                                const hasAnyMapping =
                                                    hasInternalProduct &&
                                                    hasProductMapping;

                                                // Função para obter ícone baseado no tipo do item
                                                const getItemIcon = () => {
                                                    const itemType =
                                                        item.product_mapping
                                                            ?.item_type;

                                                    if (!itemType) {
                                                        return {
                                                            Icon: AlertCircle,
                                                            className:
                                                                'text-muted-foreground',
                                                        };
                                                    }

                                                    switch (itemType) {
                                                        case 'flavor':
                                                            return {
                                                                Icon: Pizza,
                                                                className:
                                                                    'text-purple-500',
                                                            };
                                                        case 'beverage':
                                                            return {
                                                                Icon: CupSoda,
                                                                className:
                                                                    'text-blue-500',
                                                            };
                                                        case 'complement':
                                                            return {
                                                                Icon: PlusIcon,
                                                                className:
                                                                    'text-green-500',
                                                            };
                                                        case 'parent_product':
                                                            return {
                                                                Icon: Package,
                                                                className:
                                                                    'text-orange-500',
                                                            };
                                                        case 'optional':
                                                            return {
                                                                Icon: Layers,
                                                                className:
                                                                    'text-amber-500',
                                                            };
                                                        case 'combo':
                                                            return {
                                                                Icon: Box,
                                                                className:
                                                                    'text-pink-500',
                                                            };
                                                        case 'side':
                                                            return {
                                                                Icon: UtensilsCrossed,
                                                                className:
                                                                    'text-teal-500',
                                                            };
                                                        case 'dessert':
                                                            return {
                                                                Icon: IceCream2,
                                                                className:
                                                                    'text-rose-500',
                                                            };
                                                        default:
                                                            return {
                                                                Icon: Package,
                                                                className:
                                                                    'text-muted-foreground',
                                                            };
                                                    }
                                                };

                                                const { Icon, className } =
                                                    getItemIcon();

                                                // PROCESSAR ADD-ONS ORIGINAIS DO PEDIDO (do RAW)
                                                // Enriquecer com dados de mapping no frontend para evitar N+1 queries
                                                const rawAddOns = Array.isArray(
                                                    item.add_ons,
                                                )
                                                    ? item.add_ons
                                                    : [];

                                                // DEBUG: Log SEMPRE para ver todos os pedidos
                                                console.log(
                                                    '[DEBUG] Processando item:',
                                                    {
                                                        orderId: order.id,
                                                        itemId: item.id,
                                                        itemName: item.name,
                                                        hasAddOns:
                                                            rawAddOns.length >
                                                            0,
                                                        addOnsCount:
                                                            rawAddOns.length,
                                                    },
                                                );

                                                // DEBUG específico para pedido 24729
                                                if (
                                                    item.id === 24729 ||
                                                    order.id === 24729
                                                ) {
                                                    console.log(
                                                        '[DEBUG 24729] Order:',
                                                        order.id,
                                                    );
                                                    console.log(
                                                        '[DEBUG 24729] Item:',
                                                        item.id,
                                                        item.name,
                                                    );
                                                    console.log(
                                                        '[DEBUG 24729] add_ons:',
                                                        item.add_ons,
                                                    );
                                                    console.log(
                                                        '[DEBUG 24729] add_ons_product_mappings:',
                                                        item.add_ons_product_mappings,
                                                    );
                                                }

                                                const enrichedAddOns = rawAddOns
                                                    .map(
                                                        (
                                                            addOn: any,
                                                            index: number,
                                                        ) => {
                                                            const addOnName =
                                                                typeof addOn ===
                                                                'string'
                                                                    ? addOn
                                                                    : addOn.name ||
                                                                      addOn.nome ||
                                                                      '';
                                                            const addOnQuantity =
                                                                typeof addOn ===
                                                                'object'
                                                                    ? addOn.quantity ||
                                                                      addOn.qty ||
                                                                      1
                                                                    : 1;

                                                            // Buscar ProductMapping do backend (vem de add_ons_product_mappings)
                                                            const productMapping =
                                                                item
                                                                    .add_ons_product_mappings?.[
                                                                    index
                                                                ];

                                                            // Buscar OrderItemMapping se existir
                                                            const addOnMapping =
                                                                item.mappings?.find(
                                                                    (
                                                                        m: OrderItemMapping,
                                                                    ) =>
                                                                        m.mapping_type ===
                                                                            'addon' &&
                                                                        m.external_reference ===
                                                                            String(
                                                                                index,
                                                                            ),
                                                                );

                                                            return {
                                                                name: addOnName,
                                                                quantity:
                                                                    addOnQuantity,
                                                                mapping:
                                                                    addOnMapping,
                                                                product_mapping:
                                                                    productMapping, // ProductMapping da Triagem
                                                                index: index,
                                                            };
                                                        },
                                                    )
                                                    .filter(
                                                        (addon) => addon.name,
                                                    ); // Filtrar add-ons vazios

                                                // Tooltip com produto interno vinculado
                                                const getMappingTooltip =
                                                    () => {
                                                        const parts = [];
                                                        if (
                                                            hasMappings &&
                                                            item.mappings
                                                        ) {
                                                            // Mostrar apenas mappings do tipo 'main' (do item principal)
                                                            item.mappings.forEach(
                                                                (
                                                                    m: OrderItemMapping,
                                                                ) => {
                                                                    // Filtrar apenas mapping principal, não add-ons
                                                                    if (
                                                                        m.mapping_type ===
                                                                            'main' &&
                                                                        m
                                                                            .internal_product
                                                                            ?.name
                                                                    ) {
                                                                        const pct =
                                                                            (
                                                                                (m.quantity ||
                                                                                    0) *
                                                                                100
                                                                            ).toFixed(
                                                                                0,
                                                                            );
                                                                        parts.push(
                                                                            `${m.internal_product.name} (${pct}% - Principal)`,
                                                                        );
                                                                    }
                                                                },
                                                            );
                                                        }

                                                        // Se não tem mapping principal, verificar product_mapping (classificação)
                                                        if (
                                                            parts.length ===
                                                                0 &&
                                                            item.product_mapping
                                                                ?.internal_product
                                                        ) {
                                                            parts.push(
                                                                `${item.product_mapping.internal_product.name} (100% - Classificado)`,
                                                            );
                                                        } else if (
                                                            parts.length ===
                                                                0 &&
                                                            hasLegacyProduct &&
                                                            item.internal_product
                                                        ) {
                                                            parts.push(
                                                                `${item.internal_product.name} (100% - Legado)`,
                                                            );
                                                        }
                                                        return parts.length > 0
                                                            ? parts.join(', ')
                                                            : null;
                                                    };

                                                const tooltipText =
                                                    getMappingTooltip();

                                                return (
                                                    <li
                                                        key={item.id}
                                                        className="flex w-full flex-col gap-1"
                                                    >
                                                        <div className="flex w-full flex-row items-center justify-between gap-2 px-3 py-1.5">
                                                            <div className="flex min-w-0 flex-1 items-center gap-2">
                                                                <Icon
                                                                    className={`h-3.5 w-3.5 shrink-0 ${className}`}
                                                                />
                                                                {quantity >
                                                                    1 && (
                                                                    <span className="rounded bg-blue-50 px-1 py-0.5 text-[10px] leading-3 font-medium text-blue-600">
                                                                        {
                                                                            quantity
                                                                        }
                                                                        x
                                                                    </span>
                                                                )}
                                                                <TooltipProvider
                                                                    delayDuration={
                                                                        300
                                                                    }
                                                                >
                                                                    <Tooltip>
                                                                        <TooltipTrigger
                                                                            asChild
                                                                        >
                                                                            <span className="cursor-help truncate text-xs leading-4 font-medium text-muted-foreground">
                                                                                {
                                                                                    item.name
                                                                                }
                                                                            </span>
                                                                        </TooltipTrigger>
                                                                        {tooltipText && (
                                                                            <TooltipContent
                                                                                side="right"
                                                                                className="max-w-xs"
                                                                            >
                                                                                <p className="text-xs">
                                                                                    Vinculado
                                                                                    a:{' '}
                                                                                    {
                                                                                        tooltipText
                                                                                    }
                                                                                </p>
                                                                            </TooltipContent>
                                                                        )}
                                                                    </Tooltip>
                                                                </TooltipProvider>
                                                                {hasAnyMapping ? (
                                                                    <Check className="h-3.5 w-3.5 shrink-0 text-green-600" />
                                                                ) : (
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-5 w-5 p-0 hover:bg-blue-100"
                                                                        onClick={(
                                                                            e,
                                                                        ) => {
                                                                            e.stopPropagation();
                                                                            setSelectedItemToLink(
                                                                                {
                                                                                    sku:
                                                                                        item.sku ||
                                                                                        item.external_code,
                                                                                    name: item.name,
                                                                                    occurrences: 1,
                                                                                },
                                                                            );
                                                                            setIsQuickLinkDialogOpen(
                                                                                true,
                                                                            );
                                                                        }}
                                                                    >
                                                                        <LinkIcon className="h-3 w-3 text-muted-foreground hover:text-blue-600" />
                                                                    </Button>
                                                                )}
                                                            </div>
                                                            <span className="text-xs leading-4 font-medium whitespace-nowrap text-muted-foreground">
                                                                {formatCurrency(
                                                                    itemTotalCost,
                                                                )}
                                                            </span>
                                                        </div>

                                                        {/* Mostrar todos os add-ons originais do pedido */}
                                                        {enrichedAddOns.length >
                                                            0 && (
                                                            <ul className="flex w-full flex-col gap-0.5 pl-3">
                                                                {enrichedAddOns.map(
                                                                    (
                                                                        addOn,
                                                                        addonIdx: number,
                                                                    ) => {
                                                                        const isLast =
                                                                            addonIdx ===
                                                                            enrichedAddOns.length -
                                                                                1;
                                                                        const treeChar =
                                                                            isLast
                                                                                ? '└'
                                                                                : '├';

                                                                        // Buscar classificação diretamente do ProductMapping (Triagem)
                                                                        const productMapping =
                                                                            addOn.product_mapping;

                                                                        // Verificar se está classificado (tem ProductMapping)
                                                                        const isClassified =
                                                                            !!productMapping;

                                                                        // Verificar se tem associação de produto (do ProductMapping ou do OrderItemMapping)
                                                                        const hasProductMapping =
                                                                            !!productMapping?.internal_product ||
                                                                            !!addOn
                                                                                .mapping
                                                                                ?.internal_product;
                                                                        const internalProduct =
                                                                            productMapping?.internal_product ||
                                                                            addOn
                                                                                .mapping
                                                                                ?.internal_product;
                                                                        const resolvedItemType =
                                                                            resolveItemType(
                                                                                productMapping?.item_type,
                                                                                addOn
                                                                                    .mapping
                                                                                    ?.option_type,
                                                                            );

                                                                        // DEBUG GERAL: Log para TODOS os add-ons (antes de verificar tipo)
                                                                        console.log(
                                                                            `[DEBUG ADDON] Item ${item.id} - "${addOn.name}"`,
                                                                            {
                                                                                productMapping:
                                                                                    productMapping,
                                                                                pm_item_type:
                                                                                    productMapping?.item_type,
                                                                                mapping_option_type:
                                                                                    addOn
                                                                                        .mapping
                                                                                        ?.option_type,
                                                                                resolvedItemType:
                                                                                    resolvedItemType,
                                                                                hasProductMapping:
                                                                                    hasProductMapping,
                                                                            },
                                                                        );

                                                                        // Determinar ícone baseado na classificação
                                                                        const getAddonIcon =
                                                                            () => {
                                                                                if (
                                                                                    !resolvedItemType
                                                                                ) {
                                                                                    return {
                                                                                        Icon: AlertCircle,
                                                                                        className:
                                                                                            'text-orange-500',
                                                                                    };
                                                                                }

                                                                                switch (
                                                                                    resolvedItemType
                                                                                ) {
                                                                                    case 'flavor':
                                                                                        return {
                                                                                            Icon: Pizza,
                                                                                            className:
                                                                                                'text-purple-500',
                                                                                        };
                                                                                    case 'beverage':
                                                                                        return {
                                                                                            Icon: CupSoda,
                                                                                            className:
                                                                                                'text-blue-500',
                                                                                        };
                                                                                    case 'complement':
                                                                                        return {
                                                                                            Icon: PlusIcon,
                                                                                            className:
                                                                                                'text-green-500',
                                                                                        };
                                                                                    case 'parent_product':
                                                                                        return {
                                                                                            Icon: Package,
                                                                                            className:
                                                                                                'text-orange-500',
                                                                                        };
                                                                                    case 'optional':
                                                                                        return {
                                                                                            Icon: Layers,
                                                                                            className:
                                                                                                'text-amber-500',
                                                                                        };
                                                                                    case 'combo':
                                                                                        return {
                                                                                            Icon: Box,
                                                                                            className:
                                                                                                'text-pink-500',
                                                                                        };
                                                                                    case 'side':
                                                                                        return {
                                                                                            Icon: UtensilsCrossed,
                                                                                            className:
                                                                                                'text-teal-500',
                                                                                        };
                                                                                    case 'dessert':
                                                                                        return {
                                                                                            Icon: IceCream2,
                                                                                            className:
                                                                                                'text-rose-500',
                                                                                        };
                                                                                    default:
                                                                                        return {
                                                                                            Icon: Package,
                                                                                            className:
                                                                                                'text-muted-foreground',
                                                                                        };
                                                                                }
                                                                            };

                                                                        const {
                                                                            Icon: AddonIcon,
                                                                            className:
                                                                                addonClassName,
                                                                        } =
                                                                            getAddonIcon();

                                                                        // Calcular custo
                                                                        let addonCost = 0;
                                                                        if (
                                                                            hasProductMapping &&
                                                                            internalProduct
                                                                        ) {
                                                                            // Prioridade 1: unit_cost_override do OrderItemMapping (se existir)
                                                                            // Prioridade 2: unit_cost do InternalProduct
                                                                            const unitCost =
                                                                                addOn
                                                                                    .mapping
                                                                                    ?.unit_cost_override !==
                                                                                    null &&
                                                                                addOn
                                                                                    .mapping
                                                                                    ?.unit_cost_override !==
                                                                                    undefined
                                                                                    ? parseFloat(
                                                                                          String(
                                                                                              addOn
                                                                                                  .mapping
                                                                                                  .unit_cost_override,
                                                                                          ),
                                                                                      )
                                                                                    : parseFloat(
                                                                                          internalProduct?.unit_cost ||
                                                                                              '0',
                                                                                      );

                                                                            const mappingQuantity =
                                                                                addOn
                                                                                    .mapping
                                                                                    ?.quantity ||
                                                                                1;
                                                                            const itemQty =
                                                                                item.qty ||
                                                                                item.quantity ||
                                                                                1;
                                                                            // mappingQuantity JÁ inclui a quantidade do sabor (ex: 2/3 para 2x de 3 sabores)
                                                                            // então NÃO multiplicamos por addOn.quantity novamente
                                                                            addonCost =
                                                                                unitCost *
                                                                                mappingQuantity *
                                                                                itemQty;
                                                                        }

                                                                        // Calcular fração para exibição
                                                                        let fractionText:
                                                                            | string
                                                                            | null =
                                                                            null;

                                                                        // Se for sabor, calcular fração baseado em TODOS os sabores classificados (mesmo sem produto)
                                                                        let individualFraction = 1;

                                                                        if (
                                                                            resolvedItemType ===
                                                                            'flavor'
                                                                        ) {
                                                                            // DEBUG: Log detalhado do cálculo de fração
                                                                            console.log(
                                                                                `[FRACTION DEBUG] Item ${item.id} - Sabor "${addOn.name}"`,
                                                                            );
                                                                            console.log(
                                                                                '  enrichedAddOns:',
                                                                                enrichedAddOns.map(
                                                                                    (
                                                                                        a,
                                                                                    ) => ({
                                                                                        name: a.name,
                                                                                        has_product_mapping:
                                                                                            !!a.product_mapping,
                                                                                        item_type:
                                                                                            a
                                                                                                .product_mapping
                                                                                                ?.item_type,
                                                                                        quantity:
                                                                                            a.quantity,
                                                                                    }),
                                                                                ),
                                                                            );

                                                                            // Contar quantos add-ons são sabores (classificados como 'flavor')
                                                                            const flavorsWithType =
                                                                                enrichedAddOns.map(
                                                                                    (
                                                                                        a,
                                                                                    ) => {
                                                                                        const pm =
                                                                                            a.product_mapping;
                                                                                        const oit =
                                                                                            resolveItemType(
                                                                                                pm?.item_type,
                                                                                                a
                                                                                                    .mapping
                                                                                                    ?.option_type,
                                                                                            );
                                                                                        return {
                                                                                            name: a.name,
                                                                                            pm_item_type:
                                                                                                pm?.item_type,
                                                                                            resolved:
                                                                                                oit,
                                                                                            is_flavor:
                                                                                                oit ===
                                                                                                'flavor',
                                                                                            quantity:
                                                                                                a.quantity ||
                                                                                                1,
                                                                                        };
                                                                                    },
                                                                                );

                                                                            console.log(
                                                                                '  flavorsWithType:',
                                                                                flavorsWithType,
                                                                            );

                                                                            const flavorCount =
                                                                                enrichedAddOns
                                                                                    .filter(
                                                                                        (
                                                                                            a,
                                                                                        ) => {
                                                                                            const pm =
                                                                                                a.product_mapping;
                                                                                            const oit =
                                                                                                resolveItemType(
                                                                                                    pm?.item_type,
                                                                                                    a
                                                                                                        .mapping
                                                                                                        ?.option_type,
                                                                                                );
                                                                                            return (
                                                                                                oit ===
                                                                                                'flavor'
                                                                                            );
                                                                                        },
                                                                                    )
                                                                                    .reduce(
                                                                                        (
                                                                                            sum,
                                                                                            a,
                                                                                        ) =>
                                                                                            sum +
                                                                                            (a.quantity ||
                                                                                                1),
                                                                                        0,
                                                                                    );

                                                                            const addonQuantity =
                                                                                addOn.quantity ||
                                                                                1;

                                                                            console.log(
                                                                                `  flavorCount: ${flavorCount}, addonQuantity: ${addonQuantity}`,
                                                                            );

                                                                            if (
                                                                                flavorCount >
                                                                                0
                                                                            ) {
                                                                                individualFraction =
                                                                                    addonQuantity /
                                                                                    flavorCount;
                                                                                console.log(
                                                                                    `  individualFraction: ${individualFraction}`,
                                                                                );
                                                                            }
                                                                        } else {
                                                                            // Para outros tipos, usar a quantity do mapping se existir
                                                                            const mappingQuantity =
                                                                                addOn
                                                                                    .mapping
                                                                                    ?.quantity ||
                                                                                1;
                                                                            const addonQuantity =
                                                                                addOn.quantity ||
                                                                                1;

                                                                            // Se tem quantidade > 1 (ex: 2x), calcular a fração individual
                                                                            individualFraction =
                                                                                addonQuantity >
                                                                                1
                                                                                    ? mappingQuantity /
                                                                                      addonQuantity
                                                                                    : mappingQuantity;
                                                                        }

                                                                        if (
                                                                            individualFraction <
                                                                            1
                                                                        ) {
                                                                            if (
                                                                                Math.abs(
                                                                                    individualFraction -
                                                                                        0.5,
                                                                                ) <
                                                                                0.01
                                                                            ) {
                                                                                fractionText =
                                                                                    '1/2';
                                                                            } else if (
                                                                                Math.abs(
                                                                                    individualFraction -
                                                                                        0.333,
                                                                                ) <
                                                                                    0.01 ||
                                                                                Math.abs(
                                                                                    individualFraction -
                                                                                        1 /
                                                                                            3,
                                                                                ) <
                                                                                    0.01
                                                                            ) {
                                                                                fractionText =
                                                                                    '1/3';
                                                                            } else if (
                                                                                Math.abs(
                                                                                    individualFraction -
                                                                                        0.25,
                                                                                ) <
                                                                                0.01
                                                                            ) {
                                                                                fractionText =
                                                                                    '1/4';
                                                                            } else if (
                                                                                Math.abs(
                                                                                    individualFraction -
                                                                                        0.2,
                                                                                ) <
                                                                                0.01
                                                                            ) {
                                                                                fractionText =
                                                                                    '1/5';
                                                                            } else if (
                                                                                Math.abs(
                                                                                    individualFraction -
                                                                                        0.166,
                                                                                ) <
                                                                                    0.01 ||
                                                                                Math.abs(
                                                                                    individualFraction -
                                                                                        1 /
                                                                                            6,
                                                                                ) <
                                                                                    0.01
                                                                            ) {
                                                                                fractionText =
                                                                                    '1/6';
                                                                            } else if (
                                                                                Math.abs(
                                                                                    individualFraction -
                                                                                        0.666,
                                                                                ) <
                                                                                    0.01 ||
                                                                                Math.abs(
                                                                                    individualFraction -
                                                                                        2 /
                                                                                            3,
                                                                                ) <
                                                                                    0.01
                                                                            ) {
                                                                                fractionText =
                                                                                    '2/3';
                                                                            } else if (
                                                                                Math.abs(
                                                                                    individualFraction -
                                                                                        0.75,
                                                                                ) <
                                                                                0.01
                                                                            ) {
                                                                                fractionText =
                                                                                    '3/4';
                                                                            } else {
                                                                                fractionText = `${(individualFraction * 100).toFixed(0)}%`;
                                                                            }

                                                                            // DEBUG: Log final do fractionText
                                                                            console.log(
                                                                                `  fractionText gerado: "${fractionText}"`,
                                                                            );
                                                                        }

                                                                        // Tooltip com produto vinculado
                                                                        const addonTooltip =
                                                                            hasProductMapping &&
                                                                            internalProduct
                                                                                ? `Vinculado a: ${internalProduct.name}`
                                                                                : null;

                                                                        return (
                                                                            <li
                                                                                key={
                                                                                    addonIdx
                                                                                }
                                                                                className="flex w-full flex-row items-center justify-between gap-2 px-3 py-1.5"
                                                                            >
                                                                                <div className="flex min-w-0 flex-1 items-center gap-1.5">
                                                                                    <span className="text-xs leading-4 text-muted-foreground">
                                                                                        {
                                                                                            treeChar
                                                                                        }
                                                                                    </span>
                                                                                    <AddonIcon
                                                                                        className={`h-3 w-3 shrink-0 ${addonClassName}`}
                                                                                    />
                                                                                    {fractionText && (
                                                                                        <span className="rounded bg-purple-50 px-1 py-0.5 text-[10px] leading-3 font-medium text-purple-600">
                                                                                            {
                                                                                                fractionText
                                                                                            }
                                                                                        </span>
                                                                                    )}
                                                                                    {addOn.quantity >
                                                                                        1 && (
                                                                                        <span className="rounded bg-blue-50 px-1 py-0.5 text-[10px] leading-3 font-medium text-blue-600">
                                                                                            {
                                                                                                addOn.quantity
                                                                                            }

                                                                                            x
                                                                                        </span>
                                                                                    )}
                                                                                    {addonTooltip ? (
                                                                                        <TooltipProvider
                                                                                            delayDuration={
                                                                                                300
                                                                                            }
                                                                                        >
                                                                                            <Tooltip>
                                                                                                <TooltipTrigger
                                                                                                    asChild
                                                                                                >
                                                                                                    <span className="cursor-help truncate text-xs leading-4 font-medium text-muted-foreground">
                                                                                                        {
                                                                                                            addOn.name
                                                                                                        }
                                                                                                    </span>
                                                                                                </TooltipTrigger>
                                                                                                <TooltipContent
                                                                                                    side="right"
                                                                                                    className="max-w-xs"
                                                                                                >
                                                                                                    <p className="text-xs">
                                                                                                        {
                                                                                                            addonTooltip
                                                                                                        }
                                                                                                    </p>
                                                                                                </TooltipContent>
                                                                                            </Tooltip>
                                                                                        </TooltipProvider>
                                                                                    ) : (
                                                                                        <span className="truncate text-xs leading-4 font-medium text-muted-foreground">
                                                                                            {
                                                                                                addOn.name
                                                                                            }
                                                                                        </span>
                                                                                    )}
                                                                                    {hasProductMapping ? (
                                                                                        <Check className="h-3 w-3 shrink-0 text-green-600" />
                                                                                    ) : (
                                                                                        <Button
                                                                                            variant="ghost"
                                                                                            size="sm"
                                                                                            className="h-4 w-4 p-0 hover:bg-blue-100"
                                                                                            onClick={(
                                                                                                e,
                                                                                            ) => {
                                                                                                e.stopPropagation();
                                                                                                setSelectedItemToLink(
                                                                                                    {
                                                                                                        sku: addOn.sku,
                                                                                                        name: addOn.name,
                                                                                                        occurrences: 1,
                                                                                                    },
                                                                                                );
                                                                                                setIsQuickLinkDialogOpen(
                                                                                                    true,
                                                                                                );
                                                                                            }}
                                                                                        >
                                                                                            <LinkIcon className="h-2.5 w-2.5 text-muted-foreground hover:text-blue-600" />
                                                                                        </Button>
                                                                                    )}
                                                                                </div>
                                                                                <span className="text-xs leading-4 font-medium whitespace-nowrap text-muted-foreground">
                                                                                    {formatCurrency(
                                                                                        addonCost,
                                                                                    )}
                                                                                </span>
                                                                            </li>
                                                                        );
                                                                    },
                                                                )}
                                                            </ul>
                                                        )}
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </li>
                                );
                            })()}

                            {/* Impostos */}
                            {(() => {
                                const items = order.items || [];
                                const itemsWithTax = items.filter(
                                    (item: OrderItem) =>
                                        item.internal_product?.tax_category
                                            ?.total_tax_rate !== undefined &&
                                        item.internal_product?.tax_category
                                            ?.total_tax_rate !== null,
                                );

                                // Mostrar seção se tiver impostos OU se tiver detalhes para exibir
                                const hasDetails =
                                    itemsWithTax.length > 0 ||
                                    financials.additionalTaxes.length > 0;

                                return financials.totalTax > 0 || hasDetails ? (
                                    <li className="flex flex-col gap-2 border-b-1 px-0 py-4">
                                        <div className="flex w-full flex-row items-center gap-2 px-3 py-0">
                                            <div className="flex items-center justify-center rounded-full bg-orange-100 p-0.5 text-orange-900">
                                                <ArrowDownLeft className="h-4 w-4" />
                                            </div>
                                            <span className="flex-grow text-sm leading-4 font-semibold">
                                                Impostos
                                            </span>
                                            <span className="text-sm leading-4 whitespace-nowrap">
                                                {formatCurrency(
                                                    financials.totalTax,
                                                )}
                                            </span>
                                            <span className="text-sm leading-4 font-medium whitespace-nowrap text-muted-foreground">
                                                {formatPercentage(
                                                    financials.totalTax,
                                                    financials.subtotal,
                                                )}
                                            </span>
                                        </div>
                                        {/* Detalhamento dos impostos por produto */}
                                        {hasDetails && (
                                            <ul className="flex w-full flex-col items-center justify-between pt-2 pl-0">
                                                {itemsWithTax.map(
                                                    (item: OrderItem) => {
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
                                                        const taxCat =
                                                            item
                                                                .internal_product
                                                                ?.tax_category;
                                                        if (!taxCat)
                                                            return null;
                                                        const taxRate =
                                                            taxCat.total_tax_rate /
                                                            100;
                                                        const itemTax =
                                                            itemTotal * taxRate;

                                                        return (
                                                            <li
                                                                key={item.id}
                                                                className="flex w-full flex-row items-start justify-between px-3 py-0.5"
                                                            >
                                                                <span className="text-xs leading-4 font-normal text-muted-foreground">
                                                                    {quantity}x{' '}
                                                                    {item.name}{' '}
                                                                    (
                                                                    {taxCat.total_tax_rate.toFixed(
                                                                        2,
                                                                    )}
                                                                    %)
                                                                </span>
                                                                <span className="text-xs leading-4 font-normal whitespace-nowrap text-muted-foreground">
                                                                    {formatCurrency(
                                                                        itemTax,
                                                                    )}
                                                                </span>
                                                            </li>
                                                        );
                                                    },
                                                )}
                                                {/* Impostos adicionais da categoria 'tax' */}
                                                {financials.additionalTaxes
                                                    .length > 0 &&
                                                    financials.additionalTaxes.map(
                                                        (
                                                            tax: CostCommissionItem,
                                                        ) => (
                                                            <li
                                                                key={tax.id}
                                                                className="flex w-full flex-row items-start justify-between px-3 py-0.5"
                                                            >
                                                                <span className="text-xs leading-4 font-normal text-muted-foreground">
                                                                    {tax.name}
                                                                    {tax.type ===
                                                                    'percentage'
                                                                        ? ` (${String(tax.value)}%)`
                                                                        : ''}
                                                                </span>
                                                                <span className="text-xs leading-4 font-normal whitespace-nowrap text-muted-foreground">
                                                                    {formatCurrency(
                                                                        tax.calculated_value,
                                                                    )}
                                                                </span>
                                                            </li>
                                                        ),
                                                    )}
                                            </ul>
                                        )}
                                    </li>
                                ) : null;
                            })()}

                            {/* Custos operacionais */}
                            {(() => {
                                const calculatedCosts =
                                    order.calculated_costs || null;
                                const costs = calculatedCosts?.costs || [];
                                const costsWithValue = costs.filter(
                                    (cost: CostCommissionItem) =>
                                        cost.calculated_value > 0,
                                );

                                return financials.totalCosts > 0 ||
                                    costsWithValue.length > 0 ? (
                                    <li className="flex flex-col gap-2 border-b-1 px-0 py-4">
                                        <div className="flex w-full flex-row items-center gap-2 px-3 py-0">
                                            <div className="flex items-center justify-center rounded-full bg-orange-100 p-0.5 text-orange-900">
                                                <ArrowDownLeft className="h-4 w-4" />
                                            </div>
                                            <span className="flex-grow text-sm leading-4 font-semibold">
                                                Custos operacionais
                                            </span>
                                            <span className="text-sm leading-4 whitespace-nowrap">
                                                {formatCurrency(
                                                    financials.totalCosts,
                                                )}
                                            </span>
                                            <span className="text-sm leading-4 font-medium whitespace-nowrap text-muted-foreground">
                                                {formatPercentage(
                                                    financials.totalCosts,
                                                    financials.subtotal,
                                                )}
                                            </span>
                                        </div>
                                        {/* Detalhamento dos custos */}
                                        {costsWithValue.length > 0 && (
                                            <ul className="flex w-full flex-col items-center justify-between gap-1 pt-2 pl-0">
                                                {costsWithValue.map(
                                                    (
                                                        cost: CostCommissionItem,
                                                    ) => (
                                                        <li
                                                            key={cost.id}
                                                            className="flex w-full flex-row items-start justify-between px-3 py-0"
                                                        >
                                                            <span className="text-xs leading-4 font-normal text-muted-foreground">
                                                                {cost.name}
                                                                {cost.type ===
                                                                'percentage'
                                                                    ? ` (${String(cost.value)}%)`
                                                                    : ''}
                                                            </span>
                                                            <span className="text-xs leading-4 font-normal whitespace-nowrap text-muted-foreground">
                                                                {formatCurrency(
                                                                    cost.calculated_value,
                                                                )}
                                                            </span>
                                                        </li>
                                                    ),
                                                )}
                                            </ul>
                                        )}
                                    </li>
                                ) : null;
                            })()}

                            {/* COMISSÃO */}
                            {(() => {
                                const calculatedCosts =
                                    order.calculated_costs || null;
                                const commissions =
                                    calculatedCosts?.commissions || [];
                                const commissionsWithValue = commissions.filter(
                                    (comm: CostCommissionItem) =>
                                        comm.calculated_value > 0,
                                );

                                return financials.totalCommissions > 0 ||
                                    commissionsWithValue.length > 0 ? (
                                    <li className="flex flex-col gap-2 border-b-1 px-0 py-4">
                                        <div className="flex w-full flex-row items-center gap-2 px-3 py-0">
                                            <div className="flex items-center justify-center rounded-full bg-orange-100 p-0.5 text-orange-900">
                                                <ArrowDownLeft className="h-4 w-4" />
                                            </div>
                                            <span className="flex-grow text-sm leading-4 font-semibold">
                                                Comissões
                                            </span>
                                            <span className="text-sm leading-4 whitespace-nowrap">
                                                {formatCurrency(
                                                    financials.totalCommissions,
                                                )}
                                            </span>
                                            <span className="text-sm leading-4 font-medium whitespace-nowrap text-muted-foreground">
                                                {formatPercentage(
                                                    financials.totalCommissions,
                                                    financials.subtotal,
                                                )}
                                            </span>
                                        </div>
                                        {/* Detalhamento das comissões */}
                                        {commissionsWithValue.length > 0 && (
                                            <ul className="flex w-full flex-col items-center justify-between gap-1 pt-2 pl-0">
                                                {commissionsWithValue.map(
                                                    (
                                                        commission: CostCommissionItem,
                                                    ) => (
                                                        <li
                                                            key={commission.id}
                                                            className="flex w-full flex-row items-start justify-between px-3 py-0"
                                                        >
                                                            <span className="text-xs leading-4 font-normal text-muted-foreground">
                                                                {
                                                                    commission.name
                                                                }
                                                                {commission.type ===
                                                                'percentage'
                                                                    ? ` (${String(commission.value)}%)`
                                                                    : ''}
                                                            </span>
                                                            <span className="text-xs leading-4 font-normal whitespace-nowrap text-muted-foreground">
                                                                {formatCurrency(
                                                                    commission.calculated_value,
                                                                )}
                                                            </span>
                                                        </li>
                                                    ),
                                                )}
                                            </ul>
                                        )}
                                    </li>
                                ) : null;
                            })()}

                            {/* Taxa do meio de pagamento - Sempre mostrar */}
                            <li className="flex flex-col gap-2 border-b-1 px-0 py-4">
                                <div className="flex w-full flex-row items-center gap-2 px-3 py-0">
                                    <div className="flex items-center justify-center rounded-full bg-orange-100 p-0.5 text-orange-900">
                                        <ArrowDownLeft className="h-4 w-4" />
                                    </div>
                                    <span className="flex-grow text-sm leading-4 font-semibold">
                                        Taxa do meio de pagamento
                                    </span>
                                    <span className="text-sm leading-4 whitespace-nowrap">
                                        {formatCurrency(
                                            financials.totalPaymentMethodFee,
                                        )}
                                    </span>
                                    <span className="text-sm leading-4 font-medium whitespace-nowrap text-muted-foreground">
                                        {formatPercentage(
                                            financials.totalPaymentMethodFee,
                                            financials.subtotal,
                                        )}
                                    </span>
                                </div>

                                {/* Mostrar taxas aplicadas se houver */}
                                {financials.paymentMethodFees.filter(
                                    (fee: CostCommissionItem) =>
                                        fee.calculated_value > 0,
                                ).length > 0 && (
                                    <ul className="flex w-full flex-col items-center justify-between gap-1 pt-2 pl-0">
                                        {financials.paymentMethodFees
                                            .filter(
                                                (fee: CostCommissionItem) =>
                                                    fee.calculated_value > 0,
                                            )
                                            .map((fee: CostCommissionItem) => (
                                                <li
                                                    key={fee.id}
                                                    className="flex w-full flex-row items-start justify-between px-3 py-0.5"
                                                >
                                                    <span className="text-xs leading-4 font-normal text-muted-foreground">
                                                        {fee.name}
                                                        {fee.type ===
                                                        'percentage'
                                                            ? ` (${String(fee.value)}%)`
                                                            : ''}
                                                    </span>
                                                    <span className="text-xs leading-4 font-normal whitespace-nowrap text-muted-foreground">
                                                        {formatCurrency(
                                                            fee.calculated_value,
                                                        )}
                                                    </span>
                                                </li>
                                            ))}
                                    </ul>
                                )}

                                {/* Mostrar apenas meios de pagamento sem taxa vinculada */}
                                {financials.realPayments.length > 0 &&
                                    financials.paymentMethodFees.filter(
                                        (fee: CostCommissionItem) =>
                                            fee.calculated_value > 0,
                                    ).length <
                                        financials.realPayments.length && (
                                        <ul className="flex w-full flex-col items-center justify-between pt-2 pl-0">
                                            {financials.realPayments.map(
                                                (
                                                    payment: unknown,
                                                    idx: number,
                                                ) => {
                                                    const p = payment as {
                                                        payment_method?: {
                                                            name?: string;
                                                            method?: string;
                                                            keyword?: string;
                                                        };
                                                        payment_value?: number;
                                                    };
                                                    const paymentName =
                                                        p.payment_method
                                                            ?.name ||
                                                        'Pagamento';
                                                    const paymentMethod =
                                                        p.payment_method
                                                            ?.method ||
                                                        p.payment_method
                                                            ?.keyword ||
                                                        '';
                                                    const paymentValue =
                                                        p.payment_value || 0;

                                                    // Verificar se já existe taxa para este método
                                                    const hasFee =
                                                        financials.paymentMethodFees.some(
                                                            (
                                                                fee: CostCommissionItem,
                                                            ) =>
                                                                fee.calculated_value >
                                                                    0 &&
                                                                fee.name
                                                                    .toLowerCase()
                                                                    .includes(
                                                                        paymentName.toLowerCase(),
                                                                    ),
                                                        );

                                                    // Não mostrar se já tem taxa
                                                    if (hasFee) return null;

                                                    return (
                                                        <li
                                                            key={idx}
                                                            className="flex w-full flex-row items-center justify-between gap-2 px-3 py-1 hover:bg-muted/50"
                                                        >
                                                            <div className="flex flex-1 flex-col gap-0.5">
                                                                <span className="text-xs leading-4 font-normal text-muted-foreground">
                                                                    {
                                                                        paymentName
                                                                    }
                                                                    {paymentMethod &&
                                                                        ` (${paymentMethod})`}
                                                                </span>
                                                            </div>
                                                            <span className="text-xs leading-4 font-normal whitespace-nowrap text-muted-foreground">
                                                                {formatCurrency(
                                                                    paymentValue,
                                                                )}
                                                            </span>
                                                            {paymentMethod && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-6 w-6 p-0"
                                                                    title="Vincular taxa de pagamento"
                                                                    onClick={async () => {
                                                                        setSelectedPayment(
                                                                            {
                                                                                method: paymentMethod,
                                                                                name: paymentName,
                                                                            },
                                                                        );

                                                                        // Carregar taxas disponíveis
                                                                        if (
                                                                            order
                                                                        ) {
                                                                            setLoadingFees(
                                                                                true,
                                                                            );
                                                                            try {
                                                                                // Passar paymentMethod e paymentType para obter análise de compatibilidade
                                                                                const response =
                                                                                    await fetch(
                                                                                        `/orders/${order.id}/available-payment-fees?payment_method=${paymentMethod}&payment_type=offline`,
                                                                                    );

                                                                                if (
                                                                                    !response.ok
                                                                                ) {
                                                                                    const errorText =
                                                                                        await response.text();
                                                                                    console.error(
                                                                                        'Erro na resposta:',
                                                                                        response.status,
                                                                                        errorText,
                                                                                    );
                                                                                    throw new Error(
                                                                                        `Erro ${response.status}: ${response.statusText}`,
                                                                                    );
                                                                                }

                                                                                const fees =
                                                                                    await response.json();
                                                                                setAvailableFees(
                                                                                    fees,
                                                                                );
                                                                                setIsLinkFeeDialogOpen(
                                                                                    true,
                                                                                );
                                                                            } catch (error) {
                                                                                console.error(
                                                                                    'Erro ao carregar taxas:',
                                                                                    error,
                                                                                );
                                                                                toast.error(
                                                                                    'Erro ao carregar taxas de pagamento. Tente novamente.',
                                                                                );
                                                                                // Fallback: abrir dialog de criação
                                                                                setIsCreateFeeDialogOpen(
                                                                                    true,
                                                                                );
                                                                            } finally {
                                                                                setLoadingFees(
                                                                                    false,
                                                                                );
                                                                            }
                                                                        }
                                                                    }}
                                                                >
                                                                    <Plus className="h-3 w-3" />
                                                                </Button>
                                                            )}
                                                        </li>
                                                    );
                                                },
                                            )}
                                        </ul>
                                    )}
                            </li>

                            {/* Receita líquida marketplace */}
                            <li className="flex flex-col gap-2 border-b-1 px-0 py-4">
                                <div className="flex w-full flex-row items-center gap-2 px-3 py-0">
                                    <div className="flex items-center justify-center rounded-full bg-blue-100 p-1 text-blue-900">
                                        <DollarSign className="h-3 w-3" />
                                    </div>
                                    <span className="flex-grow text-sm leading-4 font-semibold">
                                        Receita líquida marketplace
                                    </span>
                                    <span className="text-sm leading-4 font-semibold whitespace-nowrap text-blue-700">
                                        {formatCurrency(
                                            financials.marketplaceNetRevenue,
                                        )}
                                    </span>
                                    <span className="text-sm leading-4 font-medium whitespace-nowrap text-muted-foreground">
                                        {formatPercentage(
                                            financials.marketplaceNetRevenue,
                                            financials.subtotal,
                                        )}
                                    </span>
                                </div>
                            </li>

                            {/* Receita líquida */}
                            <li className="flex flex-col gap-2 px-0 py-4">
                                <div className="flex w-full flex-row items-center gap-2 px-3 py-0">
                                    <div className="flex items-center justify-center rounded-full bg-green-100 p-1 text-green-900">
                                        <DollarSign className="h-3 w-3" />
                                    </div>
                                    <span className="flex-grow text-sm leading-4 font-semibold">
                                        Receita líquida
                                    </span>
                                    <span className="text-sm leading-4 font-semibold whitespace-nowrap text-green-700">
                                        {formatCurrency(financials.netRevenue)}
                                    </span>
                                    <span className="text-sm leading-4 font-medium whitespace-nowrap text-muted-foreground">
                                        {formatPercentage(
                                            financials.netRevenue,
                                            financials.subtotal,
                                        )}
                                    </span>
                                </div>
                            </li>
                        </ul>
                    </CardContent>
                </Card>

                {/* Dialog para vincular taxa existente */}
                {order && selectedPayment && (
                    <LinkPaymentFeeDialog
                        open={isLinkFeeDialogOpen}
                        onOpenChange={setIsLinkFeeDialogOpen}
                        orderId={order.id}
                        paymentMethod={selectedPayment.method}
                        paymentMethodName={selectedPayment.name}
                        provider={order.provider}
                        origin={order.origin}
                        availableFees={availableFees}
                        onCreateNew={() => {
                            setIsLinkFeeDialogOpen(false);
                            setIsCreateFeeDialogOpen(true);
                        }}
                    />
                )}

                {/* Dialog para criar taxa de pagamento */}
                {selectedPayment && order && (
                    <CreatePaymentFeeDialog
                        open={isCreateFeeDialogOpen}
                        onOpenChange={setIsCreateFeeDialogOpen}
                        orderId={order.id}
                        paymentMethod={selectedPayment.method}
                        paymentMethodName={selectedPayment.name}
                        provider={order.provider}
                        origin={order.origin}
                    />
                )}

                {/* Dialog de vinculação rápida */}
                <QuickLinkDialog
                    open={isQuickLinkDialogOpen}
                    onOpenChange={setIsQuickLinkDialogOpen}
                    item={selectedItemToLink}
                    internalProducts={internalProducts}
                    orderId={order?.id}
                    onSuccess={handleReloadOrder}
                />
            </>
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
    const saleRaw = (sale.raw || {}) as { financialData?: unknown };
    const financialData = (saleRaw.financialData || {}) as Record<
        string,
        unknown
    >;

    // Valores principais
    const grossValue = sale.gross_value || 0;
    const serviceFeePaidByCustomer = sale.service_fee || 0;
    const discountValue = sale.discount_value || 0;
    const netValue = sale.net_value || 0;
    const bagValue = sale.bag_value || 0;
    const deliveryFee = sale.delivery_fee || 0;

    // Calcular taxas e comissões do iFood (estimativa baseada no padrão)
    const paymentCommission =
        (financialData.paymentCommission as number) || bagValue * 0.0311; // ~3.11%
    const ifoodCommission =
        (financialData.ifoodCommission as number) || bagValue * 0.12; // 12%
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
