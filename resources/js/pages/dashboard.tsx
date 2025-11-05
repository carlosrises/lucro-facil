import { DashboardSectionCards } from '@/components/dashboard/section-cards';
import { DashboardSectionChart } from '@/components/dashboard/section-chart';

import AppLayout from '@/layouts/app-layout';

import { dashboard } from '@/routes';

import { type BreadcrumbItem } from '@/types';

import { Head } from '@inertiajs/react';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Dashboard',
        href: dashboard().url,
    },
];

export default function Dashboard() {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Dashboard" />

            <div className="flex flex-1 flex-col">
                <div className="@container/main flex flex-1 flex-col gap-2">
                    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                        {/* <div className="flex flex-col gap-4 px-4 lg:px-6">
                            <Alert variant="default">
                                <Clock />
                                <AlertTitle>
                                    Assinatura expirará em breve.
                                </AlertTitle>
                                <AlertDescription>
                                    <p>
                                        Seu plano atual expirará em 3 dias.
                                        Renove agora para evitar a interrupção
                                        do serviço e continuar acessando os
                                        recursos premium.
                                    </p>
                                    <div className="mt-2 flex gap-2">
                                        <Button>Renovar agora</Button>
                                        <Button variant="ghost">
                                            Ver planos
                                        </Button>
                                    </div>
                                </AlertDescription>
                            </Alert>
                            <Alert variant="destructive">
                                <AlertCircleIcon />
                                <AlertTitle>
                                    Não foi possível processar seu pagamento.
                                </AlertTitle>
                                <AlertDescription>
                                    <p>
                                        Verifique suas informações de cobrança e
                                        tente novamente.
                                    </p>
                                    <ul className="list-inside list-disc text-sm">
                                        <li>
                                            Verifique os dados do seu cartão
                                        </li>
                                        <li>Garanta fundos suficientes</li>
                                        <li>
                                            Verifique o endereço de cobrança
                                        </li>
                                    </ul>
                                </AlertDescription>
                            </Alert>
                        </div> */}

                        <DashboardSectionCards />

                        <div className="px-4 lg:px-6">
                            <DashboardSectionChart />
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
