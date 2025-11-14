import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Hash, Percent, User } from 'lucide-react';

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
            };
            orderTiming?: string;
            scheduledTo?: string;
            takeout?: {
                takeoutCode?: string;
            };
            delivery?: {
                observations?: string;
            };
        };
    };
};

export function OrderExpandedDetails({ order }: OrderExpandedDetailsProps) {
    const benefitsList = order.raw?.benefits || [];
    const totalBenefits = order.raw?.total?.benefits || 0;
    const cpfCnpj = order.raw?.customer?.taxPayerIdentificationNumber;
    const orderTiming = order.raw?.orderTiming;
    const scheduledTo = order.raw?.scheduledTo;
    const takeoutCode = order.raw?.takeout?.takeoutCode;

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
            {/* Cupons/Descontos */}
            {benefitsList.length > 0 && (
                <Card className="border-0 bg-gray-100 shadow-none dark:bg-neutral-950">
                    <CardHeader className="px-3 py-2">
                        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                            <Percent className="h-4 w-4" />
                            Cupons e Descontos
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="rounded-md bg-card p-3">
                        <div className="space-y-3">
                            {benefitsList.map((benefit, index) => (
                                <div
                                    key={index}
                                    className="space-y-2 border-b border-border pb-3 last:border-0 last:pb-0"
                                >
                                    {/* Nome da campanha e valor */}
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="text-sm font-medium">
                                                {benefit.campaign?.name ||
                                                    'Cupom de Desconto'}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                Aplicado em:{' '}
                                                {getTargetLabel(benefit.target)}
                                            </div>
                                        </div>
                                        <Badge
                                            variant="secondary"
                                            className="text-green-600"
                                        >
                                            - R${' '}
                                            {(benefit.value || 0).toFixed(2)}
                                        </Badge>
                                    </div>

                                    {/* Responsáveis pelo subsídio */}
                                    {benefit.sponsorshipValues &&
                                        benefit.sponsorshipValues.length >
                                            0 && (
                                            <div className="space-y-1">
                                                <div className="text-xs font-medium text-muted-foreground">
                                                    Subsídio:
                                                </div>
                                                {benefit.sponsorshipValues
                                                    .filter(
                                                        (sponsor) =>
                                                            (sponsor.value ||
                                                                0) > 0,
                                                    )
                                                    .map((sponsor, idx) => (
                                                        <div
                                                            key={idx}
                                                            className="flex items-center justify-between text-xs"
                                                        >
                                                            <span className="text-muted-foreground">
                                                                •{' '}
                                                                {getSponsorLabel(
                                                                    sponsor.name,
                                                                )}
                                                            </span>
                                                            <span className="font-medium">
                                                                R${' '}
                                                                {(
                                                                    sponsor.value ||
                                                                    0
                                                                ).toFixed(2)}
                                                            </span>
                                                        </div>
                                                    ))}
                                            </div>
                                        )}
                                </div>
                            ))}

                            {/* Total de descontos */}
                            {totalBenefits > 0 && (
                                <div className="flex items-center justify-between border-t border-border pt-2 text-sm font-semibold">
                                    <span>Total de Descontos</span>
                                    <span className="text-green-600">
                                        - R$ {totalBenefits.toFixed(2)}
                                    </span>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* CPF/CNPJ */}
            {cpfCnpj && (
                <Card className="border-0 bg-gray-100 shadow-none dark:bg-neutral-950">
                    <CardHeader className="px-3 py-2">
                        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                            <User className="h-4 w-4" />
                            Documento Fiscal
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="rounded-md bg-card p-3">
                        <div className="flex items-center justify-between">
                            <div className="text-sm text-muted-foreground">
                                {cpfCnpj.length > 14 ? 'CNPJ' : 'CPF'}
                            </div>
                            <div className="font-mono text-sm font-medium">
                                {cpfCnpj}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Agendamento */}
            {orderTiming === 'SCHEDULED' && scheduledTo && (
                <Card className="border-0 bg-gray-100 shadow-none dark:bg-neutral-950">
                    <CardHeader className="px-3 py-2">
                        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                            <Calendar className="h-4 w-4" />
                            Pedido Agendado
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="rounded-md bg-card p-3">
                        <div className="flex items-center justify-between">
                            <div className="text-sm text-muted-foreground">
                                Data de entrega
                            </div>
                            <Badge variant="outline" className="font-normal">
                                {new Date(scheduledTo).toLocaleString('pt-BR', {
                                    dateStyle: 'short',
                                    timeStyle: 'short',
                                })}
                            </Badge>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Código de Coleta TAKEOUT */}
            {takeoutCode && (
                <Card className="border-0 bg-gray-100 shadow-none dark:bg-neutral-950">
                    <CardHeader className="px-3 py-2">
                        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                            <Hash className="h-4 w-4" />
                            Código de Coleta
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="rounded-md bg-card p-3">
                        <div className="flex items-center justify-between">
                            <div className="text-sm text-muted-foreground">
                                Código para retirada
                            </div>
                            <div className="font-mono text-2xl font-bold text-primary">
                                {takeoutCode}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </>
    );
}
