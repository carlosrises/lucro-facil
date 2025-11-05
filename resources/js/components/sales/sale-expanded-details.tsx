import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Sale } from './columns';

interface SaleExpandedDetailsProps {
    sale: Sale;
}

export function SaleExpandedDetails({ sale }: SaleExpandedDetailsProps) {
    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
        }).format(value);
    };

    const getEntryTypeLabel = (type: string) => {
        const labels: Record<string, string> = {
            COMMISSION: 'Comissão',
            FEE: 'Taxa',
            TRANSFER: 'Repasse',
            PAYMENT: 'Pagamento',
            REFUND: 'Reembolso',
        };
        return labels[type] || type;
    };

    const getEntryTypeColor = (type: string) => {
        const colors: Record<string, string> = {
            COMMISSION: 'text-red-600',
            FEE: 'text-orange-600',
            TRANSFER: 'text-blue-600',
            PAYMENT: 'text-green-600',
            REFUND: 'text-purple-600',
        };
        return colors[type] || 'text-gray-600';
    };

    return (
        <div className="grid gap-4 p-4 md:grid-cols-2 lg:grid-cols-3">
            {/* Card de Resumo Financeiro */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">
                        Resumo Financeiro
                    </CardTitle>
                    <CardDescription>
                        Valores da venda #{sale.sale_id}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                            Valor da Sacola:
                        </span>
                        <span className="font-medium">
                            {formatCurrency(sale.bag_value)}
                        </span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                            Taxa de Entrega:
                        </span>
                        <span className="font-medium">
                            {formatCurrency(sale.delivery_fee)}
                        </span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                            Taxa de Serviço:
                        </span>
                        <span className="font-medium">
                            {formatCurrency(sale.service_fee)}
                        </span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                            Valor Bruto:
                        </span>
                        <span className="font-semibold">
                            {formatCurrency(sale.gross_value)}
                        </span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                            Descontos:
                        </span>
                        <span className="font-medium text-red-600">
                            -{formatCurrency(sale.discount_value)}
                        </span>
                    </div>
                    <Separator />
                    <div className="flex justify-between">
                        <span className="font-semibold">Valor Líquido:</span>
                        <span className="font-bold text-green-600">
                            {formatCurrency(sale.net_value)}
                        </span>
                    </div>
                </CardContent>
            </Card>

            {/* Card de Informações de Pagamento */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">
                        Informações de Pagamento
                    </CardTitle>
                    <CardDescription>Forma e responsável</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Método:</span>
                        <span className="font-medium">
                            {sale.payment_method || 'N/A'}
                        </span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Bandeira:</span>
                        <span className="font-medium">
                            {sale.payment_brand || 'N/A'}
                        </span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                            Valor Pago:
                        </span>
                        <span className="font-medium">
                            {formatCurrency(sale.payment_value)}
                        </span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                            Responsável:
                        </span>
                        <span className="font-medium">
                            {sale.payment_liability || 'N/A'}
                        </span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                            Previsão de Pagamento:
                        </span>
                        <span className="font-medium">
                            {sale.expected_payment_date
                                ? new Date(
                                      sale.expected_payment_date,
                                  ).toLocaleDateString('pt-BR')
                                : 'N/A'}
                        </span>
                    </div>
                </CardContent>
            </Card>

            {/* Card de Lançamentos de Faturamento */}
            <Card className="md:col-span-2 lg:col-span-1">
                <CardHeader>
                    <CardTitle className="text-base">
                        Lançamentos de Faturamento
                    </CardTitle>
                    <CardDescription>
                        Comissões, taxas e repasses
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                    {sale.billing_entries && sale.billing_entries.length > 0 ? (
                        <>
                            {sale.billing_entries.map((entry, index) => (
                                <div
                                    key={index}
                                    className="flex justify-between text-sm"
                                >
                                    <span className="text-muted-foreground">
                                        {getEntryTypeLabel(entry.type)}:
                                    </span>
                                    <span
                                        className={`font-medium ${getEntryTypeColor(entry.type)}`}
                                    >
                                        {entry.type === 'TRANSFER' ||
                                        entry.type === 'PAYMENT'
                                            ? '+'
                                            : '-'}
                                        {formatCurrency(Math.abs(entry.value))}
                                    </span>
                                </div>
                            ))}
                            <Separator />
                            <div className="flex justify-between">
                                <span className="font-semibold">
                                    Saldo Final:
                                </span>
                                <span
                                    className={`font-bold ${
                                        sale.sale_balance > 0
                                            ? 'text-green-600'
                                            : 'text-gray-600'
                                    }`}
                                >
                                    {formatCurrency(sale.sale_balance)}
                                </span>
                            </div>
                        </>
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            Nenhum lançamento disponível
                        </p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
