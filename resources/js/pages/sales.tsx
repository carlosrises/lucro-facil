import AppLayout from '@/layouts/app-layout';
import { Head, usePage } from '@inertiajs/react';

import { index as salesRoute } from '@/routes/sales';

import { Sale } from '@/components/sales/columns';
import { DataTable } from '@/components/sales/data-table';
import { type BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Vendas',
        href: salesRoute().url,
    },
];

type Store = {
    id: number;
    name: string;
};

type SalesPageProps = {
    sales: {
        data: Sale[];
        current_page: number;
        last_page: number;
        per_page: number;
        from: number;
        to: number;
        total: number;
        next_page_url?: string | null;
        prev_page_url?: string | null;
    };
    filters: Record<string, unknown>;
    stores: Store[];
};

export default function Sales() {
    const { sales, filters, stores } = usePage<SalesPageProps>().props;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Vendas" />

            <div className="flex flex-1 flex-col">
                <div className="@container/main flex flex-1 flex-col gap-2">
                    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                        <DataTable
                            data={sales.data}
                            pagination={{
                                current_page: sales.current_page,
                                last_page: sales.last_page,
                                per_page: sales.per_page,
                                from: sales.from,
                                to: sales.to,
                                total: sales.total,
                                next_page_url: sales.next_page_url,
                                prev_page_url: sales.prev_page_url,
                            }}
                            filters={filters}
                            stores={stores}
                        />
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
