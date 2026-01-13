import { IntegrationWarning } from '@/components/settings/integrations/integration-warning';
import { Store } from '@/components/stores/columns';
import { DataTable } from '@/components/stores/data-table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, usePage } from '@inertiajs/react';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Lojas', href: '/stores' }];

type StoresPageProps = {
    stores: {
        data: Store[];
        current_page: number;
        last_page: number;
        per_page: number;
        from: number;
        to: number;
        total: number;
        next_page_url?: string | null;
        prev_page_url?: string | null;
    };
    filters: { [key: string]: string | number | undefined };
    storesWithError?: Store[];
};

export default function Stores() {
    const {
        stores,
        filters,
        storesWithError = [],
    } = usePage<StoresPageProps>().props;
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Lojas" />
            <div className="flex flex-col gap-6 py-6">
                <div className="px-4 lg:px-6">
                    <h1 className="text-2xl font-bold tracking-tight">Lojas</h1>
                    <p className="text-muted-foreground">
                        Gerencie suas lojas integradas e suas configurações
                    </p>
                </div>
                <div className="flex w-full flex-col gap-4 px-4 lg:px-6">
                    <IntegrationWarning storesWithError={storesWithError} />
                    <DataTable
                        data={stores.data}
                        pagination={{
                            current_page: stores.current_page,
                            last_page: stores.last_page,
                            per_page: stores.per_page,
                            from: stores.from,
                            to: stores.to,
                            total: stores.total,
                            next_page_url: stores.next_page_url,
                            prev_page_url: stores.prev_page_url,
                        }}
                        filters={filters}
                    />
                </div>
            </div>
        </AppLayout>
    );
}
// ...
