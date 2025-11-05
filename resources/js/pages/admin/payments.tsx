import AppLayout from '@/layouts/app-layout';
import admin from '@/routes/admin';
import { Head } from '@inertiajs/react';
import { type BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Administração',
        href: admin.dashboard().url,
    },
    {
        title: 'Pagamentos',
        href: admin.payments().url,
    },
];

export default function AdminPayments() {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Pagamentos - Admin" />
            <div className="p-6">
                <h1 className="text-2xl font-bold mb-4">Gerenciamento de Pagamentos</h1>
                <p className="text-gray-600">
                    Aqui você pode visualizar e gerenciar todos os pagamentos da plataforma.
                </p>
            </div>
        </AppLayout>
    );
}