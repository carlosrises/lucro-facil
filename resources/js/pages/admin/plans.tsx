import AppLayout from '@/layouts/app-layout';
import admin from '@/routes/admin';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Administração',
        href: admin.dashboard().url,
    },
    {
        title: 'Planos',
        href: admin.plans().url,
    },
];

export default function AdminPlans() {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Planos - Admin" />
            <div className="p-6">
                <h1 className="mb-4 text-2xl font-bold">
                    Gerenciamento de Planos
                </h1>
                <p className="text-gray-600">
                    Aqui você pode visualizar e gerenciar os planos disponíveis
                    na plataforma.
                </p>
            </div>
        </AppLayout>
    );
}
