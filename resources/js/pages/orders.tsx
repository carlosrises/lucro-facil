import AppLayout from '@/layouts/app-layout';
import { Head, usePage } from '@inertiajs/react';

import { index as ordersRoute } from '@/routes/orders';

import { Order } from '@/components/orders/columns';
import { DataTable } from '@/components/orders/data-table';
import { useOrderStatusListener } from '@/hooks/use-order-status-listener';
import { type BreadcrumbItem } from '@/types';

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

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Pedidos" />

            <div className="flex flex-1 flex-col">
                <div className="@container/main flex flex-1 flex-col gap-2">
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
                        />
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
