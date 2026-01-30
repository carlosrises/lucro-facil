import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Combobox } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import {
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    CreditCard,
    Link2Off,
    Loader2,
    Search,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

interface CostCommission {
    id: number;
    name: string;
    type: string;
    value: number;
}

interface PaymentMethod {
    id: string;
    name: string;
    keyword: string | null;
    order_count: number;
    cost_commission_id: number | null;
    cost_commission_name: string | null;
    has_no_fee: boolean;
    payment_category: 'payment' | 'subsidy' | 'discount';
    is_linked: boolean;
    is_recalculating: boolean;
}

interface RecentOrder {
    id: number;
    code: string;
    short_reference: string;
    placed_at: string;
    gross_total: number;
}

interface PaymentTriageProps {
    paymentMethods: PaymentMethod[];
    availableFees: CostCommission[];
}

export default function PaymentTriage({
    paymentMethods,
    availableFees,
}: PaymentTriageProps) {
    const { url } = usePage();
    const urlParams = new URLSearchParams(url.split('?')[1] || '');

    const [selectedPaymentMethod, setSelectedPaymentMethod] =
        useState<PaymentMethod | null>(null);
    const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
    const [selectedFee, setSelectedFee] = useState<string>('');
    const [hasNoFee, setHasNoFee] = useState(false);
    const [paymentCategory, setPaymentCategory] = useState<string>('payment');
    const [search, setSearch] = useState(urlParams.get('search') || '');
    const [statusFilter, setStatusFilter] = useState<string>(
        urlParams.get('status') || 'all',
    );
    const [isOrdersExpanded, setIsOrdersExpanded] = useState(false);
    const [isClassifying, setIsClassifying] = useState(false);

    const { auth } = usePage<{ auth: { user: { tenant_id: number } } }>().props;

    const breadcrumbs: BreadcrumbItem[] = [
        { label: 'Triagem de Pagamentos', href: '/payment-triage' },
    ];

    const stats = useMemo(() => {
        const total = paymentMethods.length;
        const linked = paymentMethods.filter((pm) => pm.is_linked).length;
        const pending = total - linked;
        const totalOrders = paymentMethods.reduce(
            (sum, pm) => sum + pm.order_count,
            0,
        );

        return { total, linked, pending, totalOrders };
    }, [paymentMethods]);

    const filteredPaymentMethods = useMemo(() => {
        return paymentMethods.filter((pm) => {
            const matchesSearch =
                search === '' ||
                pm.name.toLowerCase().includes(search.toLowerCase()) ||
                (pm.keyword &&
                    pm.keyword.toLowerCase().includes(search.toLowerCase()));

            const matchesStatus =
                statusFilter === 'all' ||
                (statusFilter === 'linked' && pm.is_linked) ||
                (statusFilter === 'pending' && !pm.is_linked);

            return matchesSearch && matchesStatus;
        });
    }, [paymentMethods, search, statusFilter]);

    useEffect(() => {
        if (filteredPaymentMethods.length > 0 && !selectedPaymentMethod) {
            handleSelectPaymentMethod(filteredPaymentMethods[0]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filteredPaymentMethods]);

    // Persistir filtros na URL
    useEffect(() => {
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        if (statusFilter !== 'all') params.set('status', statusFilter);

        const queryString = params.toString();
        const newUrl = queryString
            ? `/payment-triage?${queryString}`
            : '/payment-triage';

        window.history.replaceState({}, '', newUrl);
    }, [search, statusFilter]);

    // WebSocket listener para recálculo de pedidos
    useEffect(() => {
        if (!auth?.user?.tenant_id || !window.Echo) {
            return;
        }

        const channel = window.Echo.channel(
            `orders.tenant.${auth.user.tenant_id}`,
        );

        channel.listen(
            '.payment-method-linked',
            (event: {
                payment_method_id: string;
                orders_recalculated: number;
                success: boolean;
                error?: string;
            }) => {
                if (event.success) {
                    toast.success(`Recálculo concluído!`, {
                        description: `${event.orders_recalculated} pedido(s) atualizado(s)`,
                    });

                    // Recarregar página para atualizar badges preservando query params
                    const params = new URLSearchParams();
                    if (search) params.set('search', search);
                    if (statusFilter !== 'all')
                        params.set('status', statusFilter);
                    const queryString = params.toString();

                    router.visit(
                        queryString
                            ? `/payment-triage?${queryString}`
                            : '/payment-triage',
                        {
                            only: ['paymentMethods'],
                            preserveState: true,
                        },
                    );
                } else {
                    toast.error('Erro ao recalcular pedidos', {
                        description: event.error || 'Erro desconhecido',
                    });

                    // Recarregar para limpar status de recálculo preservando query params
                    const params = new URLSearchParams();
                    if (search) params.set('search', search);
                    if (statusFilter !== 'all')
                        params.set('status', statusFilter);
                    const queryString = params.toString();

                    router.visit(
                        queryString
                            ? `/payment-triage?${queryString}`
                            : '/payment-triage',
                        {
                            only: ['paymentMethods'],
                            preserveState: true,
                        },
                    );
                }
            },
        );

        return () => {
            window.Echo.leave(`tenant.${auth.user.tenant_id}`);
        };
    }, [auth?.user?.tenant_id]);

    const handleSelectPaymentMethod = async (pm: PaymentMethod) => {
        setSelectedPaymentMethod(pm);
        setSelectedFee(pm.cost_commission_id?.toString() || '');
        setHasNoFee(pm.has_no_fee);
        setPaymentCategory(pm.payment_category || 'payment');

        try {
            const response = await fetch(
                `/api/payment-triage/${encodeURIComponent(pm.id)}`,
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            setRecentOrders(data.recent_orders || []);
        } catch (error) {
            console.error('Erro ao buscar pedidos:', error);
            setRecentOrders([]);
        }
    };

    const handleLink = () => {
        if (!selectedPaymentMethod) return;

        setIsClassifying(true);

        router.post(
            '/payment-triage/link',
            {
                payment_method_id: selectedPaymentMethod.id,
                payment_method_name: selectedPaymentMethod.name,
                payment_method_keyword: selectedPaymentMethod.keyword,
                cost_commission_id: selectedFee || null,
                has_no_fee: hasNoFee,
                payment_category: paymentCategory,
            },
            {
                preserveScroll: true,
                preserveState: false, // Recarregar dados para mostrar is_recalculating
                onSuccess: () => {
                    toast.info('Vinculação iniciada', {
                        description:
                            'Os pedidos estão sendo recalculados em segundo plano',
                    });
                    setIsClassifying(false);
                },
                onError: () => {
                    toast.error('Erro ao vincular taxa ao método de pagamento');
                    setIsClassifying(false);
                },
            },
        );
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        // Subtrair 3 horas pois o placed_at foi salvo com 3h a mais
        date.setHours(date.getHours() - 3);
        const dateStr = date.toLocaleDateString('pt-BR', {
            timeZone: 'America/Sao_Paulo',
        });
        const timeStr = date.toLocaleTimeString('pt-BR', {
            timeZone: 'America/Sao_Paulo',
            hour: '2-digit',
            minute: '2-digit',
        });
        return `${dateStr}, ${timeStr}`;
    };

    const canLink = Boolean(
        selectedPaymentMethod &&
            !isClassifying &&
            (paymentCategory === 'subsidy' ||
                paymentCategory === 'discount' ||
                selectedFee ||
                hasNoFee),
    );

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Triagem de Pagamentos" />

            <div className="flex flex-1 flex-col">
                <div className="@container/main flex flex-1 flex-col gap-2">
                    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                        <div className="flex items-center justify-between px-4 lg:px-6">
                            <div>
                                <h1 className="text-2xl font-bold tracking-tight">
                                    Triagem de Métodos de Pagamento
                                </h1>
                                <p className="text-muted-foreground">
                                    Vincule taxas aos métodos de pagamento dos
                                    pedidos
                                </p>
                            </div>
                        </div>

                        <div className="grid gap-4 px-4 md:grid-cols-4 lg:px-6">
                            <Card className="border-l-4 border-l-purple-500 p-0">
                                <CardContent className="flex items-center gap-4 p-6">
                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-purple-100">
                                        <CreditCard className="h-6 w-6 text-purple-600" />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <p className="text-sm font-medium text-muted-foreground">
                                            Total de Métodos
                                        </p>
                                        <p className="text-2xl font-bold">
                                            {stats.total}
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="border-l-4 border-l-green-500 p-0">
                                <CardContent className="flex items-center gap-4 p-6">
                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-green-100">
                                        <CheckCircle2 className="h-6 w-6 text-green-600" />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <p className="text-sm font-medium text-muted-foreground">
                                            Vinculados
                                        </p>
                                        <p className="text-2xl font-bold text-green-600">
                                            {stats.linked}
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="border-l-4 border-l-orange-500 p-0">
                                <CardContent className="flex items-center gap-4 p-6">
                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-orange-100">
                                        <Link2Off className="h-6 w-6 text-orange-600" />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <p className="text-sm font-medium text-muted-foreground">
                                            Pendentes
                                        </p>
                                        <p className="text-2xl font-bold text-orange-600">
                                            {stats.pending}
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="border-l-4 border-l-blue-500 p-0">
                                <CardContent className="flex items-center gap-4 p-6">
                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-blue-100">
                                        <CreditCard className="h-6 w-6 text-blue-600" />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <p className="text-sm font-medium text-muted-foreground">
                                            Total de Pedidos
                                        </p>
                                        <p className="text-2xl font-bold text-blue-600">
                                            {stats.totalOrders}
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="flex flex-col gap-4 px-4 lg:px-6">
                            <div className="flex flex-col gap-2 md:flex-row md:items-center">
                                <div className="relative flex-1">
                                    <Search className="absolute top-2.5 left-2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Buscar por nome ou palavra-chave..."
                                        value={search}
                                        onChange={(e) =>
                                            setSearch(e.target.value)
                                        }
                                        className="pl-8"
                                    />
                                </div>

                                <Select
                                    value={statusFilter}
                                    onValueChange={setStatusFilter}
                                >
                                    <SelectTrigger className="w-full md:w-[200px]">
                                        <SelectValue placeholder="Status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">
                                            Todos
                                        </SelectItem>
                                        <SelectItem value="linked">
                                            Vinculados
                                        </SelectItem>
                                        <SelectItem value="pending">
                                            Pendentes
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 px-4 lg:grid-cols-2 lg:px-6">
                            <Card className="h-[calc(100vh-400px)] overflow-hidden">
                                <CardHeader className="border-b">
                                    <CardTitle className="text-base">
                                        Métodos de Pagamento (
                                        {filteredPaymentMethods.length})
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="h-full overflow-y-auto p-0">
                                    <ul className="divide-y">
                                        {filteredPaymentMethods.map((pm) => {
                                            const isSelected =
                                                selectedPaymentMethod?.id ===
                                                pm.id;
                                            return (
                                                <li key={pm.id}>
                                                    <button
                                                        onClick={() =>
                                                            handleSelectPaymentMethod(
                                                                pm,
                                                            )
                                                        }
                                                        className={`w-full p-4 text-left transition-colors hover:bg-accent ${
                                                            isSelected
                                                                ? 'bg-accent'
                                                                : ''
                                                        }`}
                                                    >
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div className="flex-1 space-y-1">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-medium">
                                                                        {
                                                                            pm.name
                                                                        }
                                                                    </span>
                                                                    {pm.is_recalculating ? (
                                                                        <Badge
                                                                            variant="default"
                                                                            className="bg-orange-600"
                                                                        >
                                                                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                                                            Vinculando...
                                                                        </Badge>
                                                                    ) : pm.is_linked ? (
                                                                        <Badge
                                                                            variant="default"
                                                                            className={
                                                                                pm.payment_category ===
                                                                                'subsidy'
                                                                                    ? 'bg-blue-600'
                                                                                    : pm.payment_category ===
                                                                                        'discount'
                                                                                      ? 'bg-purple-600'
                                                                                      : 'bg-green-600'
                                                                            }
                                                                        >
                                                                            <CheckCircle2 className="mr-1 h-3 w-3" />
                                                                            {pm.payment_category ===
                                                                            'subsidy'
                                                                                ? 'Subsídio'
                                                                                : pm.payment_category ===
                                                                                    'discount'
                                                                                  ? 'Desconto'
                                                                                  : pm.has_no_fee
                                                                                    ? 'Sem taxa'
                                                                                    : 'Vinculado'}
                                                                        </Badge>
                                                                    ) : (
                                                                        <Badge variant="secondary">
                                                                            <Link2Off className="mr-1 h-3 w-3" />
                                                                            Pendente
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                                {pm.keyword && (
                                                                    <div className="text-xs text-muted-foreground">
                                                                        Keyword:{' '}
                                                                        {
                                                                            pm.keyword
                                                                        }
                                                                    </div>
                                                                )}
                                                                <div className="text-xs text-muted-foreground">
                                                                    {
                                                                        pm.order_count
                                                                    }{' '}
                                                                    {pm.order_count ===
                                                                    1
                                                                        ? 'pedido'
                                                                        : 'pedidos'}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </button>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </CardContent>
                            </Card>

                            <Card className="h-[calc(100vh-400px)] overflow-hidden">
                                <CardHeader className="border-b">
                                    <CardTitle className="text-base">
                                        {selectedPaymentMethod
                                            ? selectedPaymentMethod.name
                                            : 'Selecione um método'}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="h-full overflow-y-auto p-4">
                                    {selectedPaymentMethod ? (
                                        <div className="flex flex-col gap-6">
                                            <div className="space-y-2">
                                                <div className="text-sm">
                                                    <span className="font-medium">
                                                        Pedidos:
                                                    </span>{' '}
                                                    {
                                                        selectedPaymentMethod.order_count
                                                    }
                                                </div>
                                                {selectedPaymentMethod.keyword && (
                                                    <div className="text-sm">
                                                        <span className="font-medium">
                                                            Palavra-chave:
                                                        </span>{' '}
                                                        {
                                                            selectedPaymentMethod.keyword
                                                        }
                                                    </div>
                                                )}
                                            </div>

                                            <div>
                                                <button
                                                    onClick={() =>
                                                        setIsOrdersExpanded(
                                                            !isOrdersExpanded,
                                                        )
                                                    }
                                                    className="mb-2 flex w-full items-center justify-between text-sm font-medium hover:opacity-70"
                                                >
                                                    <span>
                                                        Pedidos recentes (
                                                        {recentOrders.length})
                                                    </span>
                                                    {isOrdersExpanded ? (
                                                        <ChevronUp className="h-4 w-4" />
                                                    ) : (
                                                        <ChevronDown className="h-4 w-4" />
                                                    )}
                                                </button>
                                                {isOrdersExpanded && (
                                                    <div className="space-y-2">
                                                        {recentOrders.map(
                                                            (order) => (
                                                                <div
                                                                    key={
                                                                        order.id
                                                                    }
                                                                    className="rounded-md border p-2"
                                                                >
                                                                    <div className="flex items-center justify-between">
                                                                        <div>
                                                                            <div className="font-medium">
                                                                                #
                                                                                {
                                                                                    order.short_reference
                                                                                }
                                                                            </div>
                                                                            <div className="text-xs text-muted-foreground">
                                                                                {formatDate(
                                                                                    order.placed_at,
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                        <span className="text-xs text-muted-foreground">
                                                                            {new Intl.NumberFormat(
                                                                                'pt-BR',
                                                                                {
                                                                                    style: 'currency',
                                                                                    currency:
                                                                                        'BRL',
                                                                                },
                                                                            ).format(
                                                                                order.gross_total,
                                                                            )}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            ),
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="space-y-4 rounded-lg border p-4">
                                                <h3 className="font-medium">
                                                    Classificação
                                                </h3>

                                                <div className="space-y-3">
                                                    <label className="text-sm font-medium">
                                                        Tipo de Pagamento
                                                    </label>
                                                    <div className="space-y-2">
                                                        <label className="flex items-center space-x-2">
                                                            <input
                                                                type="radio"
                                                                value="payment"
                                                                checked={
                                                                    paymentCategory ===
                                                                    'payment'
                                                                }
                                                                onChange={(e) =>
                                                                    setPaymentCategory(
                                                                        e.target
                                                                            .value,
                                                                    )
                                                                }
                                                                className="h-4 w-4"
                                                            />
                                                            <div>
                                                                <span className="text-sm font-medium">
                                                                    Pagamento
                                                                    Normal
                                                                </span>
                                                                <p className="text-xs text-muted-foreground">
                                                                    Pode ter
                                                                    taxa ou ser
                                                                    marcado sem
                                                                    taxa
                                                                </p>
                                                            </div>
                                                        </label>

                                                        <label className="flex items-center space-x-2">
                                                            <input
                                                                type="radio"
                                                                value="subsidy"
                                                                checked={
                                                                    paymentCategory ===
                                                                    'subsidy'
                                                                }
                                                                onChange={(e) =>
                                                                    setPaymentCategory(
                                                                        e.target
                                                                            .value,
                                                                    )
                                                                }
                                                                className="h-4 w-4"
                                                            />
                                                            <div>
                                                                <span className="text-sm font-medium">
                                                                    Subsídio
                                                                </span>
                                                                <p className="text-xs text-muted-foreground">
                                                                    Somado no
                                                                    subtotal,
                                                                    sem taxa
                                                                </p>
                                                            </div>
                                                        </label>

                                                        <label className="flex items-center space-x-2">
                                                            <input
                                                                type="radio"
                                                                value="discount"
                                                                checked={
                                                                    paymentCategory ===
                                                                    'discount'
                                                                }
                                                                onChange={(e) =>
                                                                    setPaymentCategory(
                                                                        e.target
                                                                            .value,
                                                                    )
                                                                }
                                                                className="h-4 w-4"
                                                            />
                                                            <div>
                                                                <span className="text-sm font-medium">
                                                                    Desconto
                                                                </span>
                                                                <p className="text-xs text-muted-foreground">
                                                                    Subtraído no
                                                                    subtotal
                                                                    (cupom/desconto),
                                                                    sem taxa
                                                                </p>
                                                            </div>
                                                        </label>
                                                    </div>
                                                </div>

                                                {paymentCategory ===
                                                    'payment' && (
                                                    <>
                                                        <div className="flex items-center justify-between border-t pt-2">
                                                            <div className="space-y-0.5">
                                                                <label className="text-sm font-medium">
                                                                    Pagamento
                                                                    sem taxa
                                                                </label>
                                                                <p className="text-xs text-muted-foreground">
                                                                    Marcar se
                                                                    não tem taxa
                                                                    aplicada
                                                                </p>
                                                            </div>
                                                            <Switch
                                                                checked={
                                                                    hasNoFee
                                                                }
                                                                onCheckedChange={
                                                                    setHasNoFee
                                                                }
                                                            />
                                                        </div>

                                                        {!hasNoFee && (
                                                            <div className="space-y-2">
                                                                <label className="text-sm font-medium">
                                                                    Taxa de
                                                                    Pagamento
                                                                </label>
                                                                <Combobox
                                                                    options={[
                                                                        {
                                                                            value: 'none',
                                                                            label: 'Remover vínculo',
                                                                        },
                                                                        ...availableFees.map(
                                                                            (
                                                                                fee,
                                                                            ) => ({
                                                                                value: fee.id.toString(),
                                                                                label: `${fee.name} (${fee.type === 'percentage' ? `${fee.value}%` : `R$ ${fee.value.toFixed(2)}`})`,
                                                                            }),
                                                                        ),
                                                                    ]}
                                                                    value={
                                                                        selectedFee
                                                                    }
                                                                    onChange={
                                                                        setSelectedFee
                                                                    }
                                                                    placeholder="Selecionar taxa..."
                                                                    searchPlaceholder="Buscar taxa..."
                                                                    emptyMessage="Nenhuma taxa encontrada."
                                                                    className="w-full"
                                                                />
                                                            </div>
                                                        )}
                                                    </>
                                                )}

                                                <Button
                                                    onClick={handleLink}
                                                    disabled={!canLink}
                                                    className="w-full"
                                                >
                                                    {isClassifying ? (
                                                        <span className="flex w-full items-center justify-center gap-2">
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                            Classificando...
                                                        </span>
                                                    ) : (
                                                        'Confirmar Classificação'
                                                    )}
                                                </Button>
                                                {isClassifying && (
                                                    <div className="flex items-center justify-center gap-2 text-xs text-primary">
                                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                        Aguarde, recalculando
                                                        pedidos
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                                            Selecione um método de pagamento
                                            para ver os detalhes
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
