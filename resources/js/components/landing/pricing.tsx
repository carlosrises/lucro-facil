import { Button } from '@/components/ui/button';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import { register } from '@/routes';
import { Link } from '@inertiajs/react';
import { Check, Sparkles } from 'lucide-react';
import { useState } from 'react';

interface Plan {
    id: number;
    code: string;
    name: string;
    description: string | null;
    price_month: number | null;
    prices?: Array<{
        key: string;
        label: string;
        amount: number | null;
        interval?: 'month' | 'year' | 'monthly' | 'annual';
        period_label?: string;
        is_annual?: boolean;
    }>;
    is_contact_plan?: boolean;
    contact_url?: string | null;
    is_featured?: boolean;
    features: string[] | null;
}

interface PriceOption {
    key: string;
    label: string;
    amount: number | null;
    periodLabel: string;
    isAnnual: boolean;
}

interface PricingProps {
    id?: string;
    plans?: Plan[];
}

export default function Pricing({ id, plans: dbPlans }: PricingProps) {
    const { ref, isVisible } = useScrollAnimation();
    const [billingCycle, setBillingCycle] = useState('annual');
    // Fallback para planos hardcoded se não vier do banco
    const defaultPlans = [
        {
            name: 'Start',
            description: 'Para quem está começando',
            priceMonthly: 99.9,
            features: [
                'Até 500 pedidos/mês',
                'Lucro pedido a pedido',
                'CMV automático',
                'Integração com 2 marketplaces',
                'Relatórios básicos',
                'Suporte por e-mail',
            ],
            cta: 'Começar grátis',
            highlight: false,
        },
        {
            name: 'Growth',
            description: 'Mais vendido',
            priceMonthly: 299.9,
            badge: 'Mais popular',
            features: [
                'Até 2.000 pedidos/mês',
                'Lucro pedido a pedido',
                'CMV automático',
                'Integrações ilimitadas',
                'Relatórios completos',
                'Alertas inteligentes',
                'Gestão de colaboradores',
                'Suporte prioritário',
            ],
            cta: 'Começar grátis',
            highlight: true,
        },
        {
            name: 'Scale',
            description: 'Para grandes operações',
            priceMonthly: 499.9,
            features: [
                'Pedidos ilimitados',
                'Lucro pedido a pedido',
                'CMV automático',
                'Integrações ilimitadas',
                'Relatórios completos',
                'Alertas inteligentes',
                'Gestão de colaboradores',
                'API de integração',
                'Suporte VIP (WhatsApp)',
                'Onboarding personalizado',
            ],
            cta: 'Começar grátis',
            highlight: false,
        },
    ];

    const normalizeFeatures = (f: any): string[] => {
        if (Array.isArray(f)) return f;
        if (typeof f === 'string') {
            try {
                const parsed = JSON.parse(f);
                if (Array.isArray(parsed)) return parsed;
            } catch (e) {
                // fallthrough to split
            }
            return f
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);
        }
        return [];
    };

    // Usar planos do banco se disponível, senão usar os hardcoded
    const plans =
        dbPlans && dbPlans.length > 0
            ? dbPlans.map((plan) => ({
                  id: plan.id,
                  code: plan.code,
                  name: plan.name,
                  description: plan.description || '',
                  priceMonthly: plan.is_contact_plan
                      ? null
                      : Number(plan.price_month || 0),
                  prices: plan.prices,
                  features: normalizeFeatures(plan.features),
                  cta: plan.is_contact_plan
                      ? 'Falar com especialista'
                      : 'Começar grátis',
                  highlight: plan.is_featured || false,
                  contactUrl: plan.contact_url,
                  isContactPlan: plan.is_contact_plan,
              }))
            : defaultPlans.map((plan, index) => ({
                  ...plan,
                  id: index + 1,
                  code: plan.name.toLowerCase(),
                  isContactPlan: false,
              }));

    const formatPrice = (value: number | null) => {
        if (value === null || value === undefined) return '0,00';
        const numValue = typeof value === 'number' ? value : Number(value);
        if (isNaN(numValue)) return '0,00';
        return numValue.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
    };
    const getDefaultPrices = (monthly: number | null): PriceOption[] => {
        if (monthly === null) {
            return [
                {
                    key: 'contact',
                    label: 'Sob consulta',
                    amount: null,
                    periodLabel: '',
                    isAnnual: false,
                },
            ];
        }

        return [
            {
                key: 'monthly',
                label: 'Mensal',
                amount: monthly,
                periodLabel: 'por mês',
                isAnnual: false,
            },
            {
                key: 'annual',
                label: 'Anual',
                amount: monthly * 12 * 0.8,
                periodLabel: 'por ano',
                isAnnual: true,
            },
        ];
    };

    const getPlanPrices = (plan: (typeof plans)[number]): PriceOption[] => {
        if (plan.isContactPlan) {
            return [
                {
                    key: 'contact',
                    label: 'Sob consulta',
                    amount: null,
                    periodLabel: '',
                    isAnnual: false,
                },
            ];
        }

        if (plan.prices && plan.prices.length > 0) {
            return plan.prices
                .filter((price) =>
                    ['month', 'year', 'monthly', 'annual'].includes(
                        price.interval ?? '',
                    ),
                )
                .map((price) => ({
                    key: price.key,
                    label: price.label,
                    amount: price.amount,
                    periodLabel:
                        price.period_label ??
                        (price.interval === 'year' ||
                        price.interval === 'annual'
                            ? 'por ano'
                            : 'por mês'),
                    isAnnual:
                        price.is_annual ??
                        (price.interval === 'year' ||
                            price.interval === 'annual'),
                }));
        }

        return getDefaultPrices(plan.priceMonthly ?? null);
    };

    const priceKeyMap = new Map<string, { label: string }>();
    plans.forEach((plan) => {
        getPlanPrices(plan).forEach((price) => {
            if (price.key === 'contact' || price.amount === null) {
                return;
            }
            if (!priceKeyMap.has(price.key)) {
                priceKeyMap.set(price.key, { label: price.label });
            }
        });
    });

    const priceKeys = Array.from(priceKeyMap.keys());
    const activePriceKey = priceKeys.includes(billingCycle)
        ? billingCycle
        : (priceKeys[0] ?? 'monthly');

    const getActivePrice = (plan: (typeof plans)[number]) => {
        const prices = getPlanPrices(plan);
        return (
            prices.find((price) => price.key === activePriceKey) ?? prices[0]
        );
    };

    const getDisplayPrice = (plan: (typeof plans)[number]) => {
        const active = getActivePrice(plan);
        if (!active || active.amount === null) {
            return 'Sob consulta';
        }

        return formatPrice(active.amount);
    };

    const getDisplayPeriod = (plan: (typeof plans)[number]) => {
        const active = getActivePrice(plan);
        return active?.periodLabel ?? '';
    };

    const isAnnualPrice = (plan: (typeof plans)[number]) =>
        Boolean(getActivePrice(plan)?.isAnnual);

    const getPlanUrl = (plan: (typeof plans)[number]) => {
        if (plan.isContactPlan && plan.contactUrl) {
            return plan.contactUrl;
        }

        const activePrice = getActivePrice(plan);
        const priceInterval =
            activePrice?.interval === 'year' || activePrice?.isAnnual
                ? 'year'
                : 'month';

        return `${register()}?plan=${plan.id}&price_interval=${priceInterval}`;
    };

    return (
        <section
            ref={ref}
            id={id}
            className={`bg-white py-24 lg:py-32 ${
                isVisible ? 'animate-on-scroll' : 'opacity-0'
            }`}
        >
            <div className="container mx-auto px-6 lg:px-8">
                <div className="mx-auto max-w-7xl">
                    {/* Header */}
                    <div className="mb-16 text-center">
                        <h2 className="mb-4 text-4xl font-bold text-gray-900 lg:text-5xl">
                            Planos e Preços
                        </h2>
                        <p className="text-xl text-gray-600">
                            Escolha o plano ideal para o seu negócio. Todos com{' '}
                            <strong className="font-semibold text-gray-900">
                                7 dias grátis
                            </strong>
                        </p>
                        {priceKeys.length > 1 && (
                            <div className="mt-8 flex items-center justify-center">
                                <div className="inline-flex rounded-full bg-gray-100 p-1">
                                    {priceKeys.map((key) => (
                                        <button
                                            key={key}
                                            type="button"
                                            onClick={() => setBillingCycle(key)}
                                            className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                                                activePriceKey === key
                                                    ? 'bg-white text-gray-900 shadow'
                                                    : 'text-gray-600 hover:text-gray-900'
                                            }`}
                                        >
                                            {priceKeyMap.get(key)?.label ?? key}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Plans Grid */}
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                        {plans.map((plan, index) => (
                            <div
                                key={index}
                                className={`relative rounded-2xl border-2 p-8 transition-all ${
                                    plan.highlight
                                        ? 'border-green-500 bg-gradient-to-br from-green-50 to-green-50 shadow-xl ring-4 ring-green-100'
                                        : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-lg'
                                }`}
                            >
                                {plan.badge && (
                                    <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                                        <span className="inline-flex items-center gap-1 rounded-full bg-green-600 px-4 py-1 text-sm font-bold text-white shadow-lg">
                                            <Sparkles className="h-4 w-4" />
                                            🔥 {plan.badge}
                                        </span>
                                    </div>
                                )}

                                <div className="mb-6">
                                    <h3 className="text-2xl font-bold text-gray-900">
                                        {plan.name}
                                    </h3>
                                    <p className="mt-1 text-sm text-gray-600">
                                        {plan.description}
                                    </p>
                                </div>

                                <div className="mb-6">
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-sm font-semibold text-gray-900">
                                            R$
                                        </span>
                                        <span className="text-5xl font-bold text-gray-900">
                                            {getDisplayPrice(plan)}
                                        </span>
                                    </div>
                                    <p className="mt-1 text-sm text-gray-600">
                                        {getDisplayPeriod(plan)}
                                    </p>
                                </div>

                                {isAnnualPrice(plan) && !plan.isContactPlan && (
                                    <div className="relative mb-4 rounded-lg border border-orange-200 bg-orange-50 p-4 text-sm text-gray-700">
                                        <span className="absolute -top-3 -left-3 -rotate-5 text-3xl">
                                            🎁
                                        </span>
                                        <div>
                                            <em>
                                                Não sabe montar ficha técnica?
                                            </em>
                                            <br />
                                            No <em>plano anual</em>, você ganha
                                            a{' '}
                                            <strong>
                                                implantação completa da ficha
                                                técnica totalmente grátis
                                            </strong>
                                            .
                                        </div>
                                    </div>
                                )}

                                {plan.isContactPlan ? (
                                    <a
                                        href={plan.contactUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="mb-6 block"
                                    >
                                        <Button
                                            className={`w-full ${
                                                plan.highlight
                                                    ? 'bg-green-600 text-white hover:bg-green-700'
                                                    : 'bg-gray-900 text-white hover:bg-gray-800'
                                            }`}
                                            size="lg"
                                        >
                                            {plan.cta}
                                        </Button>
                                    </a>
                                ) : (
                                    <Link
                                        href={getPlanUrl(plan)}
                                        className="mb-6 block"
                                    >
                                        <Button
                                            className={`w-full ${
                                                plan.highlight
                                                    ? 'bg-green-600 text-white hover:bg-green-700'
                                                    : 'bg-gray-900 text-white hover:bg-gray-800'
                                            }`}
                                            size="lg"
                                        >
                                            {plan.cta}
                                        </Button>
                                    </Link>
                                )}

                                <ul className="space-y-3">
                                    {plan.features.map((feature, i) => (
                                        <li
                                            key={i}
                                            className="flex items-start gap-3"
                                        >
                                            <Check
                                                className={`h-5 w-5 flex-shrink-0 ${
                                                    plan.highlight
                                                        ? 'text-green-600'
                                                        : 'text-gray-600'
                                                }`}
                                            />
                                            <span className="text-sm text-gray-700">
                                                {feature}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>

                    {/* Bottom Note */}
                    <div className="mt-12 text-center">
                        <p className="text-sm text-gray-600">
                            Todos os planos incluem 7 dias de teste grátis.
                            Cancele quando quiser, sem burocracia.
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
}
