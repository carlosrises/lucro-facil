import { Head } from '@inertiajs/react';

import HeadingSmall from '@/components/heading-small';
import { type BreadcrumbItem } from '@/types';

import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';

import { edit as general } from '@/routes/general';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Integrações',
        href: general().url,
    },
];

export default function General() {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Geral" />

            <SettingsLayout>
                <div className="space-y-6">
                    <HeadingSmall
                        title="Geral"
                        description="Configurações gerais aqui."
                    />
                </div>
            </SettingsLayout>
        </AppLayout>
    );
}
