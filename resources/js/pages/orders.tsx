import AppLayout from '@/layouts/app-layout';
import { Head, usePage } from '@inertiajs/react';

import { Order } from '@/components/orders/columns';
import { DataTable } from '@/components/orders/data-table';
import { Button } from '@/components/ui/button';
import { useOrderStatusListener } from '@/hooks/use-order-status-listener';
import { useRealtimeOrders } from '@/hooks/use-realtime-orders';
import { type BreadcrumbItem } from '@/types';
import { RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Pedidos',
        href: '/orders',
    },
];

type Store = {
    id: number;
    name: string;
};

type InternalProduct = {
    id: number;
    name: string;
    sku: string | null;
    unit_cost: string;
};

type OrdersPageProps = {
    orders: {
        data: Order[];
        current_page: number;
        last_page: number;
        per_page: number;
        from: number;
        to: number;
        total: number;
        next_page_url?: string | null;
        prev_page_url?: string | null;
    };
    indicators: {
        subtotal: number;
        averageTicket: number;
        cmv: number;
        netRevenue: number;
        orderCount: number;
    };
    filters: Record<string, any>;
    stores: Store[];
    providerOptions: Array<{ value: string; label: string }>;
    unmappedProductsCount: number;
    noPaymentMethodCount: number;
    noPaymentInfoCount: number;
    internalProducts: InternalProduct[];
    marginSettings: {
        margin_excellent: number;
        margin_good_min: number;
        margin_good_max: number;
        margin_poor: number;
    };
    auth: {
        user: {
            tenant_id: number;
        };
    };
};

export default function Orders() {
    const {
        orders,
        indicators,
        filters,
        stores,
        providerOptions,
        unmappedProductsCount,
        noPaymentMethodCount,
        noPaymentInfoCount,
        internalProducts,
        marginSettings,
        auth,
    } = usePage<OrdersPageProps>().props;

    // Estado local para pedidos (permite atualizações em tempo real sem reload)
    const [localOrders, setLocalOrders] = useState<Order[]>(orders.data);

    // Estados locais para paginação e indicadores (atualizam com novos pedidos)
    const [localPagination, setLocalPagination] = useState({
        current_page: orders.current_page,
        last_page: orders.last_page,
        per_page: orders.per_page,
        from: orders.from,
        to: orders.to,
        total: orders.total,
        next_page_url: orders.next_page_url,
        prev_page_url: orders.prev_page_url,
    });

    const [localIndicators, setLocalIndicators] = useState(indicators);

    // Ref para sempre ter acesso aos valores mais recentes dos filtros
    // Isso resolve o problema de closure stale no useCallback
    const filtersRef = useRef(filters);

    // Atualizar o ref quando os filtros mudarem
    useEffect(() => {
        filtersRef.current = filters;
    }, [filters]);

    // Sincronizar estado local quando os dados da página mudarem (filtros, navegação)
    // Isso garante que o skeleton apareça apenas em navegações/filtros
    useEffect(() => {
        setLocalOrders(orders.data);
        setLocalPagination({
            current_page: orders.current_page,
            last_page: orders.last_page,
            per_page: orders.per_page,
            from: orders.from,
            to: orders.to,
            total: orders.total,
            next_page_url: orders.next_page_url,
            prev_page_url: orders.prev_page_url,
        });
        setLocalIndicators(indicators);
    }, [orders.data, orders.total, indicators, filters]);

    // Hook para sincronização bidirecional de status (Critérios 12-13)
    // Recarrega automaticamente a lista quando há mudanças externas
    useOrderStatusListener(auth.user?.tenant_id);

    // Hook para atualizações em tempo real (novos pedidos + itens classificados)
    // Atualiza a lista silenciosamente sem skeleton/reload
    const handleOrderUpsert = useCallback(
        (order: Order, isNew: boolean) => {
            // Usar filtersRef para acessar sempre os valores mais recentes
            const currentFilters = filtersRef.current;

            // Validar se o pedido atende os filtros ativos antes de adicionar
            // IMPORTANTE: placed_at vem em UTC do banco
            if (!order.placed_at) return; // Segurança: ignorar pedidos sem data
            const orderDateUTC = new Date(order.placed_at);

            // Converter para data em Brasília (America/Sao_Paulo)
            // Usar toLocaleDateString que retorna apenas a data no formato do locale
            const orderDateBRParts = orderDateUTC
                .toLocaleDateString('pt-BR', {
                    timeZone: 'America/Sao_Paulo',
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                })
                .split('/'); // Retorna DD/MM/YYYY

            // Converter para YYYY-MM-DD para comparação
            const orderDateOnly = `${orderDateBRParts[2]}-${orderDateBRParts[1]}-${orderDateBRParts[0]}`;

            // Verificar se o pedido está dentro do período filtrado
            if (
                orderDateOnly < currentFilters.start_date ||
                orderDateOnly > currentFilters.end_date
            ) {
                return; // Não adicionar pedido fora do filtro
            }

            // Verificar filtro de status
            if (currentFilters.status && currentFilters.status !== 'all') {
                if (order.status !== currentFilters.status) {
                    return;
                }
            }

            // Verificar filtro de loja
            if (
                currentFilters.store_id &&
                order.store_id != currentFilters.store_id // Use != para coerção de tipo (10 == '10')
            ) {
                return;
            }

            // Verificar filtro de provider
            if (currentFilters.provider) {
                if (currentFilters.provider.includes(':')) {
                    const [provider, origin] =
                        currentFilters.provider.split(':');
                    if (
                        order.provider !== provider ||
                        order.origin !== origin
                    ) {
                        return;
                    }
                } else if (order.provider !== currentFilters.provider) {
                    return;
                }
            }

            // Pedido atende todos os filtros, adicionar/atualizar
            setLocalOrders((prev) => {
                let newOrders;
                if (isNew) {
                    // Novo pedido: adicionar no topo
                    newOrders = [order, ...prev];
                } else {
                    // Atualização: substituir existente
                    newOrders = prev.map((o) =>
                        o.id === order.id ? order : o,
                    );
                }

                // Atualizar paginação apenas para novos pedidos
                if (isNew) {
                    setLocalPagination((prevPag) => ({
                        ...prevPag,
                        total: prevPag.total + 1,
                        to: Math.min(prevPag.to + 1, prevPag.per_page),
                    }));

                    // Atualizar indicadores
                    setLocalIndicators((prevInd) => {
                        const orderNetRevenue = Number(order.net_revenue || 0);
                        const orderCMV = Number(order.total_costs || 0);
                        const orderSubtotal = calculateOrderSubtotal(order);

                        const newOrderCount = prevInd.orderCount + 1;
                        const newSubtotal = prevInd.subtotal + orderSubtotal;
                        const newCMV = prevInd.cmv + orderCMV;
                        const newNetRevenue =
                            prevInd.netRevenue + orderNetRevenue;
                        const newAverageTicket = newSubtotal / newOrderCount;

                        return {
                            ...prevInd,
                            orderCount: newOrderCount,
                            subtotal: newSubtotal,
                            cmv: newCMV,
                            netRevenue: newNetRevenue,
                            averageTicket: newAverageTicket,
                        };
                    });
                }

                return newOrders;
            });
        },
        [], // Sem dependências - usamos filtersRef para acessar valores atuais
    );

    useRealtimeOrders(auth.user?.tenant_id, handleOrderUpsert);

    // Listener para recálculo de pedidos após vincular taxa (Triagem/LinkPaymentFee)
    useEffect(() => {
        if (!auth.user?.tenant_id) return;

        const channel = (window as any).Echo?.private(
            `tenant.${auth.user.tenant_id}`,
        );

        if (!channel) {
            console.warn(
                'Echo não disponível para ouvir payment-method-linked',
            );
            return;
        }

        const handlePaymentMethodLinked = (event: any) => {
            console.log('payment-method-linked recebido:', event);

            if (event.success) {
                toast.success(
                    `✅ Recálculo concluído! ${event.orders_recalculated} pedido(s) atualizado(s).`,
                    { duration: 5000 },
                );

                // Recarregar a página para mostrar os dados atualizados
                window.location.reload();
            } else {
                toast.error(
                    `❌ Erro no recálculo: ${event.error || 'Erro desconhecido'}`,
                    { duration: 7000 },
                );
            }
        };

        channel.listen('.payment-method-linked', handlePaymentMethodLinked);

        return () => {
            channel.stopListening(
                '.payment-method-linked',
                handlePaymentMethodLinked,
            );
        };
    }, [auth.user?.tenant_id]);

    // Hook para verificar novos pedidos sincronizados (DESABILITADO - usando WebSocket)
    // const { hasNewOrders, newOrdersCount, refreshOrders } = useOrderPolling({
    //     enabled: true,
    //     interval: 30000, // Verifica a cada 30 segundos
    // });
    const hasNewOrders = false;
    const newOrdersCount = 0;
    const refreshOrders = () => {};

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Pedidos" />

            <div className="flex flex-1 flex-col">
                <div className="@container/main flex flex-1 flex-col gap-2">
                    {/* Banner de novos pedidos */}
                    {hasNewOrders && (
                        <div className="mx-4 mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4 lg:mx-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <RefreshCw className="h-5 w-5 text-blue-600" />
                                    <p className="text-sm font-medium text-blue-900">
                                        {newOrdersCount}{' '}
                                        {newOrdersCount === 1
                                            ? 'novo pedido sincronizado'
                                            : 'novos pedidos sincronizados'}
                                    </p>
                                </div>
                                <Button
                                    onClick={refreshOrders}
                                    size="sm"
                                    variant="default"
                                >
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                    Atualizar página
                                </Button>
                            </div>
                        </div>
                    )}

                    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                        <DataTable
                            data={localOrders}
                            pagination={localPagination}
                            filters={filters}
                            stores={stores}
                            providerOptions={providerOptions}
                            unmappedProductsCount={unmappedProductsCount}
                            noPaymentMethodCount={noPaymentMethodCount}
                            noPaymentInfoCount={noPaymentInfoCount}
                            internalProducts={internalProducts}
                            marginSettings={marginSettings}
                            indicators={localIndicators}
                        />
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
