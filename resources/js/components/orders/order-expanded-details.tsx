import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type OrderExpandedDetailsProps = {
    order: {
        raw?: {
            payments?: {
                methods?: Array<{
                    method?: string;
                    type?: string;
                    value?: number;
                    currency?: string;
                    card?: {
                        brand?: string;
                    };
                    cash?: {
                        changeFor?: number;
                    };
                    wallet?: {
                        name?: string;
                    };
                    transaction?: {
                        authorizationCode?: string;
                        acquirerDocument?: string;
                    };
                }>;
                prepaid?: number;
                pending?: number;
            };
            benefits?: Array<{
                value?: number;
                target?: string;
                targetId?: string;
                sponsorshipValues?: Array<{
                    name?: string;
                    value?: number;
                }>;
                campaign?: {
                    id?: string;
                    name?: string;
                };
            }>;
            total?: {
                benefits?: number;
            };
            customer?: {
                taxPayerIdentificationNumber?: string;
                documentNumber?: string;
            };
            orderTiming?: string;
            scheduledTo?: string;
            takeout?: {
                takeoutCode?: string;
                takeoutDateTime?: string;
            };
            schedule?: {
                deliveryDateTimeStart?: string;
                deliveryDateTimeEnd?: string;
            };
            orderType?: string;
            delivery?: {
                observations?: string;
                deliveryDateTime?: string;
                mode?: string;
                deliveryAddress?: {
                    city?: string;
                    state?: string;
                    country?: string;
                    reference?: string;
                    complement?: string;
                    postalCode?: string;
                    streetName?: string;
                    coordinates?: {
                        latitude?: number;
                        longitude?: number;
                    };
                    neighborhood?: string;
                    streetNumber?: string;
                    formattedAddress?: string;
                };
            };
        };
    };
};

export function OrderExpandedDetails({ order }: OrderExpandedDetailsProps) {
    const benefitsList = order.raw?.benefits || [];
    const totalBenefits = order.raw?.total?.benefits || 0;
    // Suporta tanto taxPayerIdentificationNumber quanto documentNumber
    const cpfCnpj =
        order.raw?.customer?.taxPayerIdentificationNumber ||
        order.raw?.customer?.documentNumber;
    const orderTiming = order.raw?.orderTiming;
    // Busca o campo de agendamento em múltiplos locais
    const scheduledTo =
        order.raw?.scheduledTo ||
        order.raw?.delivery?.deliveryDateTime ||
        order.raw?.takeout?.takeoutDateTime ||
        order.raw?.schedule?.deliveryDateTimeStart ||
        order.raw?.schedule?.deliveryDateTimeEnd;
    const deliveryMode = order.raw?.delivery?.mode;
    const deliveryAddress = order.raw?.delivery?.deliveryAddress;
    const takeoutCode = order.raw?.takeout?.takeoutCode;

    // Função para formatar CPF/CNPJ
    const formatCpfCnpj = (value?: string) => {
        if (!value) return '';

        // Remove caracteres não numéricos
        const numbers = value.replace(/\D/g, '');

        if (numbers.length === 11) {
            // Formata CPF: 000.000.000-00
            return numbers.replace(
                /(\d{3})(\d{3})(\d{3})(\d{2})/,
                '$1.$2.$3-$4',
            );
        } else if (numbers.length === 14) {
            // Formata CNPJ: 00.000.000/0000-00
            return numbers.replace(
                /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
                '$1.$2.$3/$4-$5',
            );
        }

        return value; // Retorna sem formatação se não for CPF nem CNPJ
    };

    // Função auxiliar para traduzir o target
    const getTargetLabel = (target?: string) => {
        switch (target) {
            case 'CART':
                return 'Carrinho';
            case 'DELIVERY_FEE':
                return 'Taxa de Entrega';
            case 'ITEM':
                return 'Item específico';
            case 'PROGRESSIVE_DISCOUNT_ITEM':
                return 'Desconto progressivo';
            default:
                return target || 'Não especificado';
        }
    };

    // Função auxiliar para traduzir o nome do sponsor
    const getSponsorLabel = (name?: string) => {
        switch (name) {
            case 'IFOOD':
                return 'iFood';
            case 'MERCHANT':
                return 'Loja';
            case 'EXTERNAL':
                return 'Parceiro';
            case 'CHAIN':
                return 'Rede';
            default:
                return name || 'Não especificado';
        }
    };

    // Se não há dados adicionais, não renderiza
    if (
        benefitsList.length === 0 &&
        !cpfCnpj &&
        orderTiming !== 'SCHEDULED' &&
        !takeoutCode
    ) {
        return null;
    }

    return (
        <>
            {/* Pagamento */}
            <Card className="h-fit gap-1 border-0 bg-gray-100 p-1 text-sm shadow-none dark:bg-neutral-950">
                <CardHeader className="gap-0 bg-gray-100 px-2 py-2 dark:bg-neutral-950">
                    <CardTitle className="flex h-[18px] items-center font-semibold">
                        Pagamento
                    </CardTitle>
                </CardHeader>
                <CardContent className="rounded-md bg-card p-0">
                    {(() => {
                        const paymentMethods =
                            order.raw?.payments?.methods || [];

                        if (paymentMethods.length === 0) {
                            return (
                                <div className="flex flex-col items-center justify-center px-3 py-6 text-center">
                                    <p className="text-sm text-muted-foreground">
                                        Nenhum pagamento registrado
                                    </p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        Informações de pagamento não disponíveis
                                        para este pedido
                                    </p>
                                </div>
                            );
                        }

                        return (
                            <ul className="m-0 flex w-full flex-col ps-0">
                                {paymentMethods.map((payment, index) => (
                                    <li
                                        key={index}
                                        className="flex flex-col gap-2 border-b-1 px-3 py-4 last:border-b-0"
                                    >
                                        <div className="flex w-full flex-row items-center justify-between gap-2">
                                            <div className="flex-1">
                                                <div className="text-sm leading-4 font-medium">
                                                    {payment.method ||
                                                        'Pagamento'}
                                                </div>
                                                {payment.card?.brand && (
                                                    <div className="mt-1 text-xs leading-4 font-normal text-muted-foreground">
                                                        {payment.card.brand}
                                                    </div>
                                                )}
                                            </div>
                                            <span className="text-sm leading-4 font-semibold whitespace-nowrap">
                                                R${' '}
                                                {(payment.value || 0).toFixed(
                                                    2,
                                                )}
                                            </span>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        );
                    })()}
                </CardContent>
            </Card>

            {/* Cupons/Descontos */}
            {benefitsList.length > 0 && (
                <Card className="h-fit gap-1 border-0 bg-gray-100 p-1 text-sm shadow-none dark:bg-neutral-950">
                    <CardHeader className="gap-0 bg-gray-100 px-2 py-2 dark:bg-neutral-950">
                        <CardTitle className="flex h-[18px] items-center font-semibold">
                            Cupons e Descontos
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="rounded-md bg-card p-0">
                        <ul className="m-0 flex w-full flex-col ps-0">
                            {benefitsList.map((benefit, index) => (
                                <li
                                    key={index}
                                    className="flex flex-col gap-2 px-3 py-4 last:border-b-0"
                                >
                                    {/* Nome da campanha e valor */}
                                    <div className="flex w-full flex-row items-center justify-between gap-2">
                                        <div className="flex-1">
                                            <div className="text-sm leading-4 font-medium">
                                                {benefit.campaign?.name ||
                                                    'Cupom de Desconto'}
                                            </div>
                                            <div className="mt-1 text-xs leading-4 font-normal text-muted-foreground">
                                                {getTargetLabel(benefit.target)}
                                            </div>
                                        </div>
                                        <span className="text-sm leading-4 font-semibold whitespace-nowrap text-green-600">
                                            - R${' '}
                                            {(benefit.value || 0).toFixed(2)}
                                        </span>
                                    </div>

                                    {/* Responsáveis pelo subsídio */}
                                    {benefit.sponsorshipValues &&
                                        benefit.sponsorshipValues.length >
                                            0 && (
                                            <ul className="flex w-full flex-col gap-2 pl-0">
                                                {benefit.sponsorshipValues
                                                    .filter(
                                                        (sponsor) =>
                                                            (sponsor.value ||
                                                                0) > 0,
                                                    )
                                                    .map((sponsor, idx) => (
                                                        <li
                                                            key={idx}
                                                            className="flex w-full flex-row items-start justify-between px-0 py-0"
                                                        >
                                                            <span className="text-xs leading-4 font-normal text-muted-foreground">
                                                                Responsável pelo
                                                                subsídio:{' '}
                                                                {getSponsorLabel(
                                                                    sponsor.name,
                                                                )}
                                                            </span>
                                                            <span className="text-xs leading-4 font-medium">
                                                                R${' '}
                                                                {(
                                                                    sponsor.value ||
                                                                    0
                                                                ).toFixed(2)}
                                                            </span>
                                                        </li>
                                                    ))}
                                            </ul>
                                        )}
                                </li>
                            ))}

                            {/* Total de descontos */}
                            {totalBenefits > 0 && (
                                <li className="flex w-full flex-row items-center justify-between gap-2 border-t-1 px-3 py-4">
                                    <span className="text-sm leading-4 font-semibold">
                                        Total de Descontos
                                    </span>
                                    <span className="text-sm leading-4 font-semibold whitespace-nowrap text-green-600">
                                        - R$ {totalBenefits.toFixed(2)}
                                    </span>
                                </li>
                            )}
                        </ul>
                    </CardContent>
                </Card>
            )}

            {/* CPF/CNPJ */}
            {cpfCnpj && (
                <Card className="h-fit gap-1 border-0 bg-gray-100 p-1 text-sm shadow-none dark:bg-neutral-950">
                    <CardHeader className="gap-0 bg-gray-100 px-2 py-2 dark:bg-neutral-950">
                        <CardTitle className="flex h-[18px] items-center font-semibold">
                            Documento Fiscal
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="rounded-md bg-card p-0">
                        <ul className="m-0 flex w-full flex-col ps-0">
                            <li className="flex flex-row items-center justify-between gap-2 px-3 py-4">
                                <span className="text-sm leading-4 font-normal text-muted-foreground">
                                    {cpfCnpj &&
                                    cpfCnpj.replace(/\D/g, '').length > 11
                                        ? 'CNPJ'
                                        : 'CPF'}
                                </span>
                                <span className="font-mono text-sm leading-4 font-medium whitespace-nowrap">
                                    {formatCpfCnpj(cpfCnpj)}
                                </span>
                            </li>
                        </ul>
                    </CardContent>
                </Card>
            )}

            {/* Agendamento */}
            {orderTiming === 'SCHEDULED' && scheduledTo && (
                <Card className="h-fit gap-1 border-0 bg-gray-100 p-1 text-sm shadow-none dark:bg-neutral-950">
                    <CardHeader className="gap-0 bg-gray-100 px-2 py-2 dark:bg-neutral-950">
                        <CardTitle className="flex h-[18px] items-center font-semibold">
                            Pedido Agendado
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="rounded-md bg-card p-0">
                        <ul className="m-0 flex w-full flex-col ps-0">
                            <li className="flex flex-row items-center justify-between gap-2 px-3 py-4">
                                <span className="text-sm leading-4 font-normal text-muted-foreground">
                                    Data e hora
                                </span>
                                <span className="text-sm leading-4 font-medium whitespace-nowrap">
                                    {new Date(scheduledTo).toLocaleString(
                                        'pt-BR',
                                        {
                                            dateStyle: 'short',
                                            timeStyle: 'short',
                                        },
                                    )}
                                </span>
                            </li>
                            {/* Se for retirada (TAKEOUT ou modo PICKUP), mostra mensagem explícita */}
                            {(order.raw?.orderType === 'TAKEOUT' ||
                                deliveryMode === 'PICKUP') && (
                                <li className="flex flex-col gap-1 px-3 py-2">
                                    <span className="text-sm font-semibold text-primary">
                                        Retirada no local
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        Este pedido é para retirada no balcão.
                                    </span>
                                </li>
                            )}
                            {deliveryMode === 'DEFAULT' && deliveryAddress ? (
                                <li className="flex flex-col gap-1 px-3 py-2">
                                    <span className="text-sm font-semibold">
                                        Endereço de Entrega
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        {deliveryAddress.streetName},{' '}
                                        {deliveryAddress.streetNumber}
                                    </span>
                                    {deliveryAddress.neighborhood && (
                                        <span className="text-xs text-muted-foreground">
                                            Bairro:{' '}
                                            {deliveryAddress.neighborhood}
                                        </span>
                                    )}
                                    {deliveryAddress.city && (
                                        <span className="text-xs text-muted-foreground">
                                            Cidade: {deliveryAddress.city}
                                        </span>
                                    )}
                                    {deliveryAddress.state && (
                                        <span className="text-xs text-muted-foreground">
                                            UF: {deliveryAddress.state}
                                        </span>
                                    )}
                                    {deliveryAddress.complement && (
                                        <span className="text-xs text-muted-foreground">
                                            Complemento:{' '}
                                            {deliveryAddress.complement}
                                        </span>
                                    )}
                                    {deliveryAddress.reference && (
                                        <span className="text-xs text-muted-foreground">
                                            Referência:{' '}
                                            {deliveryAddress.reference}
                                        </span>
                                    )}
                                    {deliveryAddress.postalCode && (
                                        <span className="text-xs text-muted-foreground">
                                            CEP: {deliveryAddress.postalCode}
                                        </span>
                                    )}
                                </li>
                            ) : null}
                            {deliveryMode === 'PICKUP' &&
                                {
                                    /* Mensagem de retirada já exibida acima para TAKEOUT/PICKUP */
                                }}
                        </ul>
                    </CardContent>
                </Card>
            )}

            {/* Código de Coleta TAKEOUT */}
            {takeoutCode && (
                <Card className="h-fit gap-1 border-0 bg-gray-100 p-1 text-sm shadow-none dark:bg-neutral-950">
                    <CardHeader className="gap-0 bg-gray-100 px-2 py-2 dark:bg-neutral-950">
                        <CardTitle className="flex h-[18px] items-center font-semibold">
                            Código de Coleta
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="rounded-md bg-card p-0">
                        <ul className="m-0 flex w-full flex-col ps-0">
                            <li className="flex flex-row items-center justify-between gap-2 px-3 py-4">
                                <span className="text-sm leading-4 font-normal text-muted-foreground">
                                    Código para retirada
                                </span>
                                <span className="font-mono text-2xl font-bold text-primary">
                                    {takeoutCode}
                                </span>
                            </li>
                        </ul>
                    </CardContent>
                </Card>
            )}
        </>
    );
}
