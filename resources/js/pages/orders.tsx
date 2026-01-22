import AppLayout from '@/layouts/app-layout';
import { Head, usePage } from '@inertiajs/react';

import { Order } from '@/components/orders/columns';
import { DataTable } from '@/components/orders/data-table';
import { Button } from '@/components/ui/button';
import { useOrderStatusListener } from '@/hooks/use-order-status-listener';
import { useRealtimeOrders } from '@/hooks/use-realtime-orders';
import { type BreadcrumbItem } from '@/types';
import { RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

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

    // Sincronizar estado local quando os dados da página mudarem (filtros, navegação)
    // Isso garante que o skeleton apareça apenas em navegações/filtros
    useEffect(() => {
        setLocalOrders(orders.data);
        console.log('[Orders] Filtros atualizados:', {
            start_date: filters.start_date,
            end_date: filters.end_date,
            status: filters.status,
        });
    }, [orders.data, filters]);

    // Hook para sincronização bidirecional de status (Critérios 12-13)
    // Recarrega automaticamente a lista quando há mudanças externas
    useOrderStatusListener((auth.user as any)?.tenant_id);

    // Hook para atualizações em tempo real (novos pedidos + itens classificados)
    // Atualiza a lista silenciosamente sem skeleton/reload
    const handleOrderUpsert = useCallback(
        (order: Order, isNew: boolean) => {
            // Validar se o pedido atende os filtros ativos antes de adicionar
            // IMPORTANTE: placed_at vem em UTC do banco
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

            console.log('[Realtime] Verificando filtro de data', {
                order_id: order.id,
                order_code: order.code,
                placed_at_utc: order.placed_at,
                placed_at_utc_obj: orderDateUTC.toISOString(),
                order_date_br: orderDateOnly,
                filter_start: filters.start_date,
                filter_end: filters.end_date,
                will_pass:
                    orderDateOnly >= filters.start_date &&
                    orderDateOnly <= filters.end_date,
            });

            // Verificar se o pedido está dentro do período filtrado
            if (
                orderDateOnly < filters.start_date ||
                orderDateOnly > filters.end_date
            ) {
                console.warn(
                    '[Realtime] ❌ Pedido fora do período filtrado, ignorando',
                    {
                        order_id: order.id,
                        order_code: order.code,
                        order_date_only: orderDateOnly,
                        filter_start: filters.start_date,
                        filter_end: filters.end_date,
                    },
                );
                return; // Não adicionar pedido fora do filtro
            }

            // Verificar filtro de status
            if (filters.status && filters.status !== 'all') {
                if (order.status !== filters.status) {
                    console.log(
                        '[Realtime] Pedido com status diferente do filtro, ignorando',
                        { order_status: order.status, filter: filters.status },
                    );
                    return;
                }
            }

            // Verificar filtro de loja
            if (filters.store_id && order.store_id !== filters.store_id) {
                return;
            }

            // Verificar filtro de provider
            if (filters.provider) {
                if (filters.provider.includes(':')) {
                    const [provider, origin] = filters.provider.split(':');
                    if (
                        order.provider !== provider ||
                        order.origin !== origin
                    ) {
                        return;
                    }
                } else if (order.provider !== filters.provider) {
                    return;
                }
            }

            // Pedido atende todos os filtros, adicionar/atualizar
            setLocalOrders((prev) => {
                if (isNew) {
                    // Novo pedido: adicionar no topo
                    return [order, ...prev];
                } else {
                    // Atualização: substituir existente
                    return prev.map((o) => (o.id === order.id ? order : o));
                }
            });
        },
        [filters],
    );

    useRealtimeOrders((auth.user as any)?.tenant_id, handleOrderUpsert);

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
                            pagination={{
                                current_page: orders.current_page,
                                last_page: orders.last_page,
                                per_page: orders.per_page,
                                from: orders.from,
                                to: orders.to,
                                total: orders.total,
                                next_page_url: orders.next_page_url,
                                prev_page_url: orders.prev_page_url,
                            }}
                            filters={filters}
                            stores={stores}
                            providerOptions={providerOptions}
                            unmappedProductsCount={unmappedProductsCount}
                            noPaymentMethodCount={noPaymentMethodCount}
                            noPaymentInfoCount={noPaymentInfoCount}
                            internalProducts={internalProducts}
                            marginSettings={marginSettings}
                            indicators={indicators}
                        />
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
