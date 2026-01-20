import AppLayout from '@/layouts/app-layout';
import { Head, usePage } from '@inertiajs/react';

import { index as ordersRoute } from '@/routes/orders';

import { Order } from '@/components/orders/columns';
import { DataTable } from '@/components/orders/data-table';
import { Button } from '@/components/ui/button';
import { useOrderPolling } from '@/hooks/use-order-polling';
import { useOrderStatusListener } from '@/hooks/use-order-status-listener';
import { type BreadcrumbItem } from '@/types';
import { RefreshCw } from 'lucide-react';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Pedidos',
        href: ordersRoute().url,
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

    // Hook para sincronização bidirecional de status (Critérios 12-13)
    // Recarrega automaticamente a lista quando há mudanças externas
    useOrderStatusListener((auth.user as any)?.tenant_id);

    // Hook para verificar novos pedidos sincronizados
    const { hasNewOrders, newOrdersCount, refreshOrders } = useOrderPolling({
        enabled: true,
        interval: 30000, // Verifica a cada 30 segundos
    });

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
                            data={orders.data}
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
