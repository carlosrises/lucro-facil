import { Button } from '@/components/ui/button';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import { dashboard, login, register } from '@/routes';
import { type SharedData } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { ArrowRight, BarChart3, Check, Target } from 'lucide-react';

export default function Hero() {
    const { auth } = usePage<SharedData>().props;
    const { ref, isVisible } = useScrollAnimation();

    return (
        <section className="relative overflow-hidden bg-gray-50">
            <div className="hero-aurora absolute inset-0"></div>
            <div className="hero-aurora-2 absolute inset-0"></div>

            {/* Header/Navbar Integrado */}
            <header className="relative z-50 w-full">
                <nav className="container mx-auto flex items-center justify-between px-6 py-6 lg:px-8">
                    <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-green-600 to-green-600">
                            <BarChart3 className="h-5 w-5 text-white" />
                        </div>
                        <span className="text-xl font-semibold text-gray-900">
                            Lucro Fácil
                        </span>
                    </div>

                    {/* Links de Navegação */}
                    <div className="hidden items-center gap-8 md:flex">
                        <a
                            href="#problema"
                            className="text-sm font-medium text-gray-700 transition-colors hover:text-green-600"
                        >
                            Problema
                        </a>
                        <a
                            href="#solucao"
                            className="text-sm font-medium text-gray-700 transition-colors hover:text-green-600"
                        >
                            Solução
                        </a>
                        <a
                            href="#recursos"
                            className="text-sm font-medium text-gray-700 transition-colors hover:text-green-600"
                        >
                            Recursos
                        </a>
                        <a
                            href="#integracoes"
                            className="text-sm font-medium text-gray-700 transition-colors hover:text-green-600"
                        >
                            Integrações
                        </a>
                        <a
                            href="#planos"
                            className="text-sm font-medium text-gray-700 transition-colors hover:text-green-600"
                        >
                            Planos
                        </a>
                    </div>

                    <div className="flex items-center gap-4">
                        {auth.user ? (
                            <Link href={dashboard()}>
                                <Button className="bg-green-600 hover:bg-green-700">
                                    Ir para Dashboard
                                </Button>
                            </Link>
                        ) : (
                            <>
                                <Link href={login()}>
                                    <Button
                                        variant="ghost"
                                        className="hidden sm:inline-flex"
                                    >
                                        Entrar
                                    </Button>
                                </Link>
                                <Link href={register()}>
                                    <Button className="bg-green-600 hover:bg-green-700">
                                        Começar grátis
                                    </Button>
                                </Link>
                            </>
                        )}
                    </div>
                </nav>
            </header>

            <div className="relative container mx-auto px-6 py-12 lg:px-8 lg:py-20">
                <div
                    ref={ref}
                    className={`grid items-center gap-16 lg:grid-cols-2 ${
                        isVisible ? 'animate-on-scroll' : 'opacity-0'
                    }`}
                >
                    {/* Coluna Esquerda - Conteúdo */}
                    <div className="max-w-2xl space-y-8">
                        <div className="inline-flex items-center gap-2 rounded-full border border-green-200 bg-white px-4 py-2 text-sm font-medium text-green-700 shadow-sm">
                            <Target className="h-4 w-4" />
                            Lucro em tempo real. Pedido a pedido.
                        </div>

                        <h1 className="text-5xl leading-tight font-bold tracking-tight text-gray-900 sm:text-6xl lg:text-7xl">
                            Tenha seu lucro em tempo real, não apenas
                            faturamento
                        </h1>

                        <div className="space-y-4">
                            <p className="text-2xl font-semibold text-gray-900">
                                Você sabe quanto lucrou nesse pedido?
                            </p>

                            <p className="text-lg leading-relaxed text-gray-600">
                                Descubra taxas escondidas do iFood e 99 e pare
                                de vender no escuro. A única plataforma que
                                mostra o{' '}
                                <strong className="font-semibold text-gray-900">
                                    lucro real
                                </strong>{' '}
                                de cada venda, incluindo CMV, impostos e todas
                                as taxas.
                            </p>
                        </div>

                        <div className="flex flex-col gap-4 sm:flex-row">
                            <Link href={register()}>
                                <Button
                                    size="lg"
                                    className="h-14 bg-green-600 px-8 text-base font-semibold text-white shadow-lg transition-all hover:bg-green-700"
                                >
                                    Começar teste grátis de 7 dias
                                    <ArrowRight className="ml-2 h-5 w-5" />
                                </Button>
                            </Link>
                            <a
                                href="https://wa.me/5511999999999"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <Button
                                    size="lg"
                                    variant="outline"
                                    className="h-14 border-2 border-gray-300 bg-white px-8 text-base font-semibold text-gray-700 hover:bg-gray-50"
                                >
                                    Falar com consultor
                                </Button>
                            </a>
                        </div>

                        <div className="flex flex-wrap gap-6 pt-2 text-sm text-gray-600">
                            <div className="flex items-center gap-2">
                                <Check className="h-5 w-5 text-green-600" />
                                <span className="font-medium">
                                    7 dias de teste grátis
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Check className="h-5 w-5 text-green-600" />
                                <span className="font-medium">
                                    Sem cartão de crédito
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Check className="h-5 w-5 text-green-600" />
                                <span className="font-medium">
                                    Cancele quando quiser
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Coluna Direita - Demo do Sistema */}
                    <div className="relative flex items-center justify-center lg:block">
                        <div className="relative w-full max-w-[600px] xl:max-w-[1000px]">
                            {/* Badge Flutuante */}
                            <div
                                className="absolute -top-6 -right-14 z-40 animate-bounce rounded-full bg-gradient-to-r from-green-500 to-emerald-500 px-5 py-2.5 text-sm font-bold text-white shadow-xl"
                                style={{ animationDuration: '3s' }}
                            >
                                💰 Lucro Real Visível
                            </div>

                            {/* Desktop Mockup */}
                            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl select-none">
                                {/* Browser Chrome */}
                                <div className="mb-4 flex items-center gap-2 border-b border-gray-200 pb-3">
                                    <div className="flex gap-1.5">
                                        <div className="h-3 w-3 rounded-full bg-red-400"></div>
                                        <div className="h-3 w-3 rounded-full bg-yellow-400"></div>
                                        <div className="h-3 w-3 rounded-full bg-green-400"></div>
                                    </div>
                                    <div className="ml-3 flex-1 rounded-md bg-gray-100 px-3 py-1.5 text-center text-xs text-gray-600">
                                        lucrofacil.com/orders
                                    </div>
                                </div>

                                {/* Page Header */}
                                <div className="mb-4">
                                    <div className="mb-1.5 flex items-center gap-1.5 text-xs text-gray-500">
                                        <span>Dashboard</span>
                                        <span>›</span>
                                        <span className="font-semibold text-gray-900">
                                            Pedidos
                                        </span>
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-900">
                                        Pedidos
                                    </h3>
                                </div>

                                {/* Summary Cards */}
                                <div className="mb-5 grid grid-cols-4 gap-2.5">
                                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                                        <div className="mb-1 text-xs font-semibold tracking-wide text-gray-500 uppercase">
                                            Subtotal
                                        </div>
                                        <div className="text-lg font-bold text-gray-900">
                                            R$ 13k
                                        </div>
                                    </div>
                                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                                        <div className="mb-1 text-xs font-semibold tracking-wide text-gray-500 uppercase">
                                            CMV
                                        </div>
                                        <div className="text-lg font-bold text-gray-900">
                                            R$ 1,5k
                                        </div>
                                    </div>
                                    <div className="rounded-xl border border-orange-200 bg-orange-50 p-3">
                                        <div className="mb-1 text-xs font-semibold tracking-wide text-orange-600 uppercase">
                                            Taxas
                                        </div>
                                        <div className="text-lg font-bold text-orange-600">
                                            R$ 2,1k
                                        </div>
                                    </div>
                                    <div className="rounded-xl border border-green-200 bg-green-50 p-3">
                                        <div className="mb-1 text-xs font-semibold tracking-wide text-green-600 uppercase">
                                            Líquido
                                        </div>
                                        <div className="text-lg font-bold text-green-600">
                                            R$ 8,4k
                                        </div>
                                    </div>
                                </div>

                                {/* Orders Table */}
                                <div className="overflow-hidden rounded-lg border border-gray-200">
                                    <div className="grid grid-cols-6 gap-2 border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold tracking-wide text-gray-600 uppercase">
                                        <div>Hora</div>
                                        <div>Canal</div>
                                        <div className="text-right">Total</div>
                                        <div className="text-right">CMV</div>
                                        <div className="col-span-2 text-right">
                                            Líquido
                                        </div>
                                    </div>

                                    <div className="divide-y divide-gray-100 bg-white">
                                        {[
                                            {
                                                time: '22:24',
                                                channel: 'iFood',
                                                logo: '/images/ifood.svg',
                                                total: '88',
                                                cmv: '14',
                                                profit: '46',
                                                margin: '84%',
                                                profitColor: 'green',
                                            },
                                            {
                                                time: '18:43',
                                                channel: '99Food',
                                                logo: '/images/99food.svg',
                                                total: '58',
                                                cmv: '14',
                                                profit: '0,4',
                                                margin: '1,5%',
                                                profitColor: 'red',
                                            },
                                            {
                                                time: '21:52',
                                                channel: 'Takeat',
                                                logo: '/images/takeat.svg',
                                                total: '83',
                                                cmv: '14',
                                                profit: '42',
                                                margin: '84%',
                                                profitColor: 'green',
                                            },
                                            {
                                                time: '20:15',
                                                channel: 'iFood',
                                                logo: '/images/ifood.svg',
                                                total: '124',
                                                cmv: '18',
                                                profit: '67',
                                                margin: '73%',
                                                profitColor: 'green',
                                            },
                                        ].map((row, i) => (
                                            <div
                                                key={i}
                                                className="grid grid-cols-6 gap-2 px-3 py-2.5 text-sm"
                                            >
                                                <div className="font-medium text-gray-900">
                                                    {row.time}
                                                </div>
                                                <div className="flex items-center">
                                                    <img
                                                        src={row.logo}
                                                        alt={row.channel}
                                                        className="h-5 w-auto object-contain"
                                                        title={row.channel}
                                                    />
                                                </div>
                                                <div className="text-right text-gray-900">
                                                    R$ {row.total}
                                                </div>
                                                <div className="text-right text-orange-600">
                                                    R$ {row.cmv}
                                                </div>
                                                <div className="col-span-2 flex items-center justify-end gap-1.5">
                                                    <span
                                                        className={`font-bold text-${row.profitColor}-600`}
                                                    >
                                                        R$ {row.profit}
                                                    </span>
                                                    <span
                                                        className={`rounded-full bg-${row.profitColor}-100 px-1.5 py-0.5 text-xs font-bold text-${row.profitColor}-700`}
                                                    >
                                                        {row.margin}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                                    <div className="flex items-center gap-1.5">
                                        <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500"></div>
                                        <span>Atualizado agora</span>
                                    </div>
                                    <span>163 pedidos</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="mt-12 flex justify-center">
                    <div className="flex flex-col items-center gap-2 text-xs text-gray-500">
                        <div className="scroll-indicator">
                            <span className="scroll-indicator-dot" />
                        </div>
                        <span>Role para ver mais</span>
                    </div>
                </div>
            </div>
        </section>
    );
}
