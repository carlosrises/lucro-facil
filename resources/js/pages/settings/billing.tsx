import { Head, usePage } from '@inertiajs/react';
import axios from 'axios';
import { Check, Loader2, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import HeadingSmall from '@/components/heading-small';
import { Button } from '@/components/ui/button';
import { type BreadcrumbItem } from '@/types';

import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';

interface Plan {
    id: number;
    code: string;
    name: string;
    description: string | null;
    price_month: number | null;
    features: string[] | null;
    is_contact_plan: boolean;
    contact_url: string | null;
}

interface Subscription {
    id: number;
    plan_id: number;
    status: string;
    started_on: string;
    ends_on: string | null;
}

interface BillingProps {
    plans: Plan[];
    currentPlan: Plan | null;
    subscription: Subscription | null;
}

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Assinatura e Pagamento',
        href: '/settings/billing',
    },
];

export default function Billing() {
    const { plans, currentPlan, subscription } = usePage<BillingProps>().props;
    const [loadingPlanId, setLoadingPlanId] = useState<number | null>(null);

    const handleUpgrade = async (planId: number) => {
        setLoadingPlanId(planId);
        try {
            const response = await axios.post('/settings/billing/checkout', {
                plan_id: planId,
            });

            // Redirecionar para o Stripe Checkout
            if (response.data.checkout_url) {
                window.location.href = response.data.checkout_url;
            }
        } catch (error) {
            console.error('Checkout error:', error);
            toast.error('Erro ao iniciar checkout. Tente novamente.');
            setLoadingPlanId(null);
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Assinatura e Pagamento" />

            <SettingsLayout>
                <div className="space-y-6">
                    <HeadingSmall
                        title="Assinatura e Pagamento"
                        description="Gerencie seu plano e forma de pagamento"
                    />

                    {/* Plano Atual */}
                    <div className="rounded-lg border border-purple-200 bg-gradient-to-r from-purple-50 to-blue-50 p-6 dark:border-purple-800 dark:from-purple-950 dark:to-blue-950">
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-purple-600 to-blue-600">
                                    <Sparkles className="h-5 w-5 text-white" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                        {currentPlan
                                            ? `Plano Atual: ${currentPlan.name}`
                                            : 'Plano Atual: Free'}
                                    </h3>
                                    {currentPlan &&
                                    currentPlan.price_month !== null ? (
                                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                                            R${' '}
                                            {currentPlan.price_month.toLocaleString(
                                                'pt-BR',
                                                {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2,
                                                },
                                            )}{' '}
                                            /mês
                                        </p>
                                    ) : (
                                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                                            Plano gratuito
                                        </p>
                                    )}
                                    {subscription && subscription.ends_on && (
                                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
                                            Renovação em:{' '}
                                            {new Date(
                                                subscription.ends_on,
                                            ).toLocaleDateString('pt-BR')}
                                        </p>
                                    )}
                                    {subscription && !subscription.ends_on && (
                                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
                                            Status: {subscription.status} •
                                            Iniciado em:{' '}
                                            {new Date(
                                                subscription.started_on,
                                            ).toLocaleDateString('pt-BR')}
                                        </p>
                                    )}
                                    {!subscription && (
                                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
                                            Sem assinatura ativa
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Lista de Planos */}
                    <div>
                        <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
                            Planos Disponíveis
                        </h3>

                        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                            {plans.map((plan) => {
                                const isCurrentPlan =
                                    currentPlan?.id === plan.id;
                                const isUpgrade =
                                    currentPlan &&
                                    plan.price_month !== null &&
                                    currentPlan.price_month !== null
                                        ? plan.price_month >
                                          currentPlan.price_month
                                        : !currentPlan &&
                                          plan.price_month !== null;

                                return (
                                    <div
                                        key={plan.id}
                                        className={`relative overflow-hidden rounded-lg border p-6 transition-all ${
                                            isCurrentPlan
                                                ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/30'
                                                : plan.code === 'PRO'
                                                  ? 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20'
                                                  : 'border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900'
                                        }`}
                                    >
                                        {isCurrentPlan && (
                                            <div className="absolute top-2 -right-8 rotate-45 bg-purple-600 px-8 py-1 text-xs font-medium text-white">
                                                Atual
                                            </div>
                                        )}

                                        {plan.code === 'PRO' &&
                                            !isCurrentPlan && (
                                                <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-1 text-sm font-medium text-white">
                                                    Recomendado
                                                </div>
                                            )}

                                        <div className="mb-4">
                                            <h4 className="text-2xl font-bold text-gray-900 dark:text-white">
                                                {plan.name}
                                            </h4>
                                            {plan.description && (
                                                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                                                    {plan.description}
                                                </p>
                                            )}
                                        </div>

                                        <div className="mb-6">
                                            {plan.is_contact_plan ? (
                                                <div className="text-center">
                                                    <span className="text-2xl font-bold text-gray-900 dark:text-white">
                                                        Sob Consulta
                                                    </span>
                                                </div>
                                            ) : (
                                                <div className="flex items-baseline">
                                                    <span className="text-4xl font-bold text-gray-900 dark:text-white">
                                                        R${' '}
                                                        {plan.price_month?.toLocaleString(
                                                            'pt-BR',
                                                            {
                                                                minimumFractionDigits: 2,
                                                                maximumFractionDigits: 2,
                                                            },
                                                        )}
                                                    </span>
                                                    <span className="ml-2 text-gray-600 dark:text-gray-400">
                                                        /mês
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {!isCurrentPlan && (
                                            <Button
                                                className={`mb-6 w-full ${isUpgrade ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700' : ''}`}
                                                variant={
                                                    isUpgrade
                                                        ? 'default'
                                                        : 'outline'
                                                }
                                                onClick={() =>
                                                    plan.is_contact_plan &&
                                                    plan.contact_url
                                                        ? window.open(
                                                              plan.contact_url,
                                                              '_blank',
                                                          )
                                                        : handleUpgrade(plan.id)
                                                }
                                                disabled={
                                                    loadingPlanId !== null &&
                                                    !plan.is_contact_plan
                                                }
                                            >
                                                {plan.is_contact_plan ? (
                                                    'Entrar em Contato'
                                                ) : loadingPlanId ===
                                                  plan.id ? (
                                                    <>
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                        Carregando...
                                                    </>
                                                ) : isUpgrade ? (
                                                    'Fazer Upgrade'
                                                ) : (
                                                    'Selecionar Plano'
                                                )}
                                            </Button>
                                        )}

                                        {plan.features &&
                                            plan.features.length > 0 && (
                                                <ul className="space-y-3">
                                                    {plan.features.map(
                                                        (feature, index) => (
                                                            <li
                                                                key={index}
                                                                className="flex items-start gap-3"
                                                            >
                                                                <Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-500" />
                                                                <span className="text-sm text-gray-600 dark:text-gray-400">
                                                                    {feature}
                                                                </span>
                                                            </li>
                                                        ),
                                                    )}
                                                </ul>
                                            )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </SettingsLayout>
        </AppLayout>
    );
}
