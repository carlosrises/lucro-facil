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
        title: 'Chamados',
        href: admin.tickets().url,
    },
];

export default function AdminTickets() {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Chamados - Admin" />
            <div className="p-6">
                <h1 className="text-2xl font-bold mb-4">Gerenciamento de Chamados</h1>
                <p className="text-gray-600">
                    Aqui você pode visualizar e gerenciar todos os chamados de suporte.
                </p>
            </div>
        </AppLayout>
    );
}