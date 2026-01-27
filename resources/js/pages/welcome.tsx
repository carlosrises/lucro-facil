import { Button } from '@/components/ui/button';
import { dashboard, login, register } from '@/routes';
import { type SharedData } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import { ArrowRight, BarChart3, Check, Zap } from 'lucide-react';

interface Plan {
    id: number;
    code: string;
    name: string;
    description: string | null;
    price_month: number;
    features: string[] | null;
}

interface WelcomeProps extends SharedData {
    plans: Plan[];
}

export default function Welcome() {
    const { auth, plans } = usePage<WelcomeProps>().props;

    return (
        <>
            <Head title="Lucro Fácil - Gestão Financeira para Restaurantes">
                <link rel="preconnect" href="https://fonts.bunny.net" />
                <link
                    href="https://fonts.bunny.net/css?family=instrument-sans:400,500,600"
                    rel="stylesheet"
                />
            </Head>

            <div className="min-h-screen bg-white dark:bg-[#0a0a0a]">
                {/* Header/Navbar */}
                <header className="fixed top-0 z-50 w-full border-b border-gray-200 bg-white/80 backdrop-blur-md dark:border-gray-800 dark:bg-[#0a0a0a]/80">
                    <nav className="container mx-auto flex items-center justify-between px-6 py-4 lg:px-8">
                        <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-blue-600 to-purple-600">
                                <BarChart3 className="h-5 w-5 text-white" />
                            </div>
                            <span className="text-xl font-semibold text-gray-900 dark:text-white">
                                Lucro Fácil
                            </span>
                        </div>

                        <div className="flex items-center gap-4">
                            {auth.user ? (
                                <Link href={dashboard()}>
                                    <Button>Ir para Dashboard</Button>
                                </Link>
                            ) : (
                                <>
                                    <Link href={login()}>
                                        <Button variant="ghost">Entrar</Button>
                                    </Link>
                                    <Link href={register()}>
                                        <Button>Começar grátis</Button>
                                    </Link>
                                </>
                            )}
                        </div>
                    </nav>
                </header>

                {/* Hero Section */}
                <section className="relative overflow-hidden pt-32 pb-20">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-blue-950/20 dark:via-purple-950/20 dark:to-pink-950/20" />

                    <div className="relative container mx-auto px-6 lg:px-8">
                        <div className="mx-auto max-w-4xl text-center">
                            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300">
                                <Zap className="h-4 w-4" />
                                Controle financeiro inteligente
                            </div>

                            <h1 className="mb-6 text-5xl font-bold tracking-tight text-gray-900 sm:text-6xl lg:text-7xl dark:text-white">
                                Gestão financeira para{' '}
                                <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                                    restaurantes
                                </span>
                            </h1>

                            <p className="mb-10 text-xl text-gray-600 dark:text-gray-400">
                                Integre suas vendas do iFood, 99Food e TakeAt.
                                Calcule custos, margens e lucro real de cada
                                pedido automaticamente.
                            </p>

                            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                                <Link href={register()}>
                                    <Button
                                        size="lg"
                                        className="group bg-gradient-to-r from-blue-600 to-purple-600 text-lg"
                                    >
                                        Começar agora
                                        <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                                    </Button>
                                </Link>
                                <Button
                                    size="lg"
                                    variant="outline"
                                    className="text-lg"
                                >
                                    Ver demonstração
                                </Button>
                            </div>

                            <div className="mt-12 flex items-center justify-center gap-8 text-sm text-gray-600 dark:text-gray-400">
                                <div className="flex items-center gap-2">
                                    <Check className="h-5 w-5 text-green-500" />
                                    Teste grátis por 14 dias
                                </div>
                                <div className="flex items-center gap-2">
                                    <Check className="h-5 w-5 text-green-500" />
                                    Sem cartão de crédito
                                </div>
                                <div className="flex items-center gap-2">
                                    <Check className="h-5 w-5 text-green-500" />
                                    Cancele quando quiser
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Features Section */}
                <section className="py-24">
                    <div className="container mx-auto px-6 lg:px-8">
                        <div className="mb-16 text-center">
                            <h2 className="mb-4 text-4xl font-bold text-gray-900 dark:text-white">
                                Tudo que você precisa
                            </h2>
                            <p className="text-xl text-gray-600 dark:text-gray-400">
                                Ferramentas poderosas para gestão financeira
                                completa
                            </p>
                        </div>

                        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                            {[
                                {
                                    icon: '🔄',
                                    title: 'Integração Automática',
                                    description:
                                        'Conecte iFood, 99Food e TakeAt. Seus pedidos são sincronizados automaticamente.',
                                },
                                {
                                    icon: '💰',
                                    title: 'Cálculo de Custos',
                                    description:
                                        'Sistema inteligente calcula o custo real de cada produto e pedido.',
                                },
                                {
                                    icon: '📊',
                                    title: 'Relatórios Detalhados',
                                    description:
                                        'Dashboards com métricas de vendas, margens e lucratividade.',
                                },
                                {
                                    icon: '🍕',
                                    title: 'Fracionamento de Pizzas',
                                    description:
                                        'Calcule custos precisos de pizzas com múltiplos sabores.',
                                },
                                {
                                    icon: '💳',
                                    title: 'Controle de Pagamentos',
                                    description:
                                        'Gerencie taxas de delivery, pagamentos e comissões.',
                                },
                                {
                                    icon: '🔐',
                                    title: 'Seguro e Confiável',
                                    description:
                                        'Seus dados protegidos com criptografia de ponta.',
                                },
                            ].map((feature, index) => (
                                <div
                                    key={index}
                                    className="group rounded-2xl border border-gray-200 bg-white p-8 transition-all hover:shadow-xl dark:border-gray-800 dark:bg-gray-900"
                                >
                                    <div className="mb-4 text-4xl">
                                        {feature.icon}
                                    </div>
                                    <h3 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">
                                        {feature.title}
                                    </h3>
                                    <p className="text-gray-600 dark:text-gray-400">
                                        {feature.description}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Stats Section */}
                <section className="bg-gradient-to-br from-blue-600 to-purple-600 py-20">
                    <div className="container mx-auto px-6 lg:px-8">
                        <div className="grid gap-8 md:grid-cols-3">
                            {[
                                { value: '10k+', label: 'Pedidos processados' },
                                { value: '99.9%', label: 'Uptime' },
                                { value: '24/7', label: 'Suporte' },
                            ].map((stat, index) => (
                                <div key={index} className="text-center">
                                    <div className="mb-2 text-5xl font-bold text-white">
                                        {stat.value}
                                    </div>
                                    <div className="text-blue-100">
                                        {stat.label}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Pricing Section */}
                {plans && plans.length > 0 && (
                    <section className="bg-gray-50 py-24 dark:bg-gray-900">
                        <div className="container mx-auto px-6 lg:px-8">
                            <div className="mb-16 text-center">
                                <h2 className="mb-4 text-4xl font-bold text-gray-900 dark:text-white">
                                    Planos e Preços
                                </h2>
                                <p className="text-xl text-gray-600 dark:text-gray-400">
                                    Escolha o plano ideal para o seu negócio
                                </p>
                            </div>

                            <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-2 lg:grid-cols-3">
                                {plans.map((plan) => (
                                    <div
                                        key={plan.id}
                                        className="group relative rounded-2xl border border-gray-200 bg-white p-8 transition-all hover:scale-105 hover:shadow-2xl dark:border-gray-800 dark:bg-gray-950"
                                    >
                                        {plan.code === 'PRO' && (
                                            <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-1 text-sm font-medium text-white">
                                                Mais Popular
                                            </div>
                                        )}

                                        <div className="mb-6">
                                            <h3 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">
                                                {plan.name}
                                            </h3>
                                            {plan.description && (
                                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                                    {plan.description}
                                                </p>
                                            )}
                                        </div>

                                        <div className="mb-6">
                                            <div className="flex items-baseline">
                                                <span className="text-5xl font-bold text-gray-900 dark:text-white">
                                                    R${' '}
                                                    {plan.price_month.toLocaleString(
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
                                        </div>

                                        <Link href={register()}>
                                            <Button
                                                className={`mb-6 w-full ${plan.code === 'PRO' ? 'bg-gradient-to-r from-blue-600 to-purple-600' : ''}`}
                                                variant={
                                                    plan.code === 'PRO'
                                                        ? 'default'
                                                        : 'outline'
                                                }
                                            >
                                                Começar agora
                                            </Button>
                                        </Link>

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
                                ))}
                            </div>
                        </div>
                    </section>
                )}

                {/* CTA Section */}
                <section className="py-24">
                    <div className="container mx-auto px-6 lg:px-8">
                        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 to-purple-600 px-8 py-16 text-center lg:px-16">
                            <div className="bg-grid-white/10 absolute inset-0" />
                            <div className="relative">
                                <h2 className="mb-4 text-4xl font-bold text-white">
                                    Pronto para começar?
                                </h2>
                                <p className="mb-8 text-xl text-blue-100">
                                    Junte-se a centenas de restaurantes que já
                                    controlam seu lucro real.
                                </p>
                                <Link href={register()}>
                                    <Button
                                        size="lg"
                                        className="bg-white text-blue-600 hover:bg-gray-100"
                                    >
                                        Começar teste grátis
                                        <ArrowRight className="ml-2 h-5 w-5" />
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Footer */}
                <footer className="border-t border-gray-200 bg-gray-50 py-12 dark:border-gray-800 dark:bg-gray-900">
                    <div className="container mx-auto px-6 lg:px-8">
                        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
                            <div className="flex items-center gap-2">
                                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-blue-600 to-purple-600">
                                    <BarChart3 className="h-5 w-5 text-white" />
                                </div>
                                <span className="text-lg font-semibold text-gray-900 dark:text-white">
                                    Lucro Fácil
                                </span>
                            </div>

                            <div className="text-center text-sm text-gray-600 dark:text-gray-400">
                                © {new Date().getFullYear()} Lucro Fácil. Todos
                                os direitos reservados.
                            </div>

                            <div className="flex items-center gap-6 text-sm text-gray-600 dark:text-gray-400">
                                <a
                                    href="#"
                                    className="hover:text-gray-900 dark:hover:text-white"
                                >
                                    Privacidade
                                </a>
                                <a
                                    href="#"
                                    className="hover:text-gray-900 dark:hover:text-white"
                                >
                                    Termos
                                </a>
                                <a
                                    href="#"
                                    className="hover:text-gray-900 dark:hover:text-white"
                                >
                                    Suporte
                                </a>
                            </div>
                        </div>
                    </div>
                </footer>
            </div>
        </>
    );
}
