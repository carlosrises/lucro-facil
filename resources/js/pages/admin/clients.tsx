import { DataTable } from '@/components/admin/clients/data-table';
import AppLayout from '@/layouts/app-layout';
import admin from '@/routes/admin';
import { type BreadcrumbItem } from '@/types';
import { Head, usePage } from '@inertiajs/react';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Administração',
        href: admin.dashboard().url,
    },
    {
        title: 'Clientes',
        href: admin.clients.index().url,
    },
];

interface AdminClientsProps {
    clients: {
        data: Array<{
            id: number;
            name: string;
            email: string;
            created_at: string;
            created_at_human: string;
            stores_count: number;
            subscription?: {
                id: number;
                plan_name: string;
                status: string;
                started_on?: string;
                ends_on?: string;
                price: number;
            } | null;
            primary_user?: {
                name: string;
                email: string;
            } | null;
            status: string;
        }>;
        current_page: number;
        last_page: number;
        per_page: number;
        from: number;
        to: number;
        total: number;
        next_page_url?: string | null;
        prev_page_url?: string | null;
        links: Array<{
            url: string | null;
            label: string;
            active: boolean;
        }>;
    };
    filters: {
        search: string;
        status: string;
        plan_id: string;
        sort_by: string;
        sort_direction: string;
    };
    plans: Array<{
        id: number;
        name: string;
    }>;
    [key: string]: unknown;
}

export default function AdminClients() {
    const { clients, filters, plans } = usePage<AdminClientsProps>().props;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Clientes - Admin" />

            <div className="flex flex-1 flex-col">
                <div className="@container/main flex flex-1 flex-col gap-2">
                    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                        <DataTable
                            data={clients.data}
                            pagination={{
                                current_page: clients.current_page,
                                last_page: clients.last_page,
                                per_page: clients.per_page,
                                from: clients.from,
                                to: clients.to,
                                total: clients.total,
                                next_page_url: clients.next_page_url,
                                prev_page_url: clients.prev_page_url,
                            }}
                            filters={filters}
                            plans={plans}
                        />
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
