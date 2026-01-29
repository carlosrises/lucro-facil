import { Head, Link } from '@inertiajs/react';
import { CheckCircle2 } from 'lucide-react';

import HeadingSmall from '@/components/heading-small';
import { Button } from '@/components/ui/button';
import { type BreadcrumbItem } from '@/types';

import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Assinatura',
        href: '/settings/billing',
    },
    {
        title: 'Sucesso',
        href: '/settings/billing/success',
    },
];

export default function BillingSuccess() {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Pagamento Confirmado" />

            <SettingsLayout>
                <div className="flex flex-col items-center justify-center py-12">
                    <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                        <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400" />
                    </div>

                    <HeadingSmall
                        title="Pagamento Confirmado!"
                        description="Seu upgrade foi processado com sucesso. Você já pode aproveitar todos os recursos do seu novo plano."
                    />

                    <div className="mt-8 flex gap-4">
                        <Link href="/dashboard">
                            <Button>Ir para Dashboard</Button>
                        </Link>
                        <Link href="/settings/billing">
                            <Button variant="outline">
                                Ver Detalhes da Assinatura
                            </Button>
                        </Link>
                    </div>

                    <div className="mt-12 rounded-lg border border-blue-200 bg-blue-50 p-6 dark:border-blue-800 dark:bg-blue-950/20">
                        <h3 className="mb-2 font-semibold text-gray-900 dark:text-white">
                            Próximos Passos
                        </h3>
                        <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                            <li>
                                • Você receberá um email de confirmação em breve
                            </li>
                            <li>• Seu plano estará ativo imediatamente</li>
                            <li>• A cobrança será automática todo mês</li>
                            <li>• Você pode cancelar a qualquer momento</li>
                        </ul>
                    </div>
                </div>
            </SettingsLayout>
        </AppLayout>
    );
}
