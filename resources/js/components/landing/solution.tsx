import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import {
    AlertTriangle,
    BarChart3,
    Clock,
    Shield,
    TrendingUp,
    Zap,
} from 'lucide-react';

interface SolutionProps {
    id?: string;
}

export default function Solution({ id }: SolutionProps) {
    const { ref, isVisible } = useScrollAnimation();
    const benefits = [
        {
            icon: Zap,
            title: 'Lucro pedido a pedido',
            description:
                'Saiba instantaneamente se cada venda deu lucro ou prejuízo, com CMV, taxas e impostos calculados automaticamente.',
        },
        {
            icon: TrendingUp,
            title: 'Aumente sua margem em até 40%',
            description:
                'Identifique produtos não lucrativos, ajuste preços e negocie melhor com os marketplaces.',
        },
        {
            icon: Shield,
            title: 'Descubra taxas escondidas',
            description:
                'Todas as cobranças do iFood, 99, Rappi, taxas de cartão e promoções ficam visíveis e detalhadas.',
        },
        {
            icon: BarChart3,
            title: 'Dashboards gerenciais completos',
            description:
                'Veja métricas em tempo real: ticket médio, CMV por produto, análise de canais e muito mais.',
        },
        {
            icon: Clock,
            title: 'Integração automática',
            description:
                'Conecta com iFood, 99, Takeat e outros. Dados sincronizados automaticamente, sem digitação manual.',
        },
        {
            icon: AlertTriangle,
            title: 'Alertas de prejuízo',
            description:
                'Receba notificações quando um pedido der prejuízo e entenda o motivo imediatamente.',
        },
    ];

    return (
        <section
            ref={ref}
            id={id}
            className={`bg-gradient-to-b from-gray-50 to-white py-24 lg:py-32 ${
                isVisible ? 'animate-on-scroll' : 'opacity-0'
            }`}
        >
            <div className="container mx-auto px-6 lg:px-8">
                <div className="mx-auto max-w-7xl">
                    {/* Header */}
                    <div className="mb-16 text-center">
                        <h2 className="mb-4 text-4xl font-bold text-gray-900 lg:text-5xl">
                            A solução que você precisava
                        </h2>
                        <p className="text-xl text-gray-600">
                            O Lucro Fácil mostra o{' '}
                            <strong className="font-semibold text-gray-900">
                                lucro real
                            </strong>{' '}
                            que sobra realmente na sua conta.
                        </p>
                    </div>

                    {/* Benefits Grid */}
                    <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                        {benefits.map((benefit, index) => {
                            const Icon = benefit.icon;
                            return (
                                <div
                                    key={index}
                                    className="group relative rounded-xl border border-gray-200 bg-white p-6 transition-all hover:border-green-300 hover:shadow-lg"
                                >
                                    <div className="mb-4 inline-flex items-center justify-center rounded-lg bg-green-100 p-3">
                                        <Icon className="h-6 w-6 text-green-600" />
                                    </div>
                                    <h3 className="mb-2 text-lg font-semibold text-gray-900">
                                        {benefit.title}
                                    </h3>
                                    <p className="text-sm leading-relaxed text-gray-600">
                                        {benefit.description}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </section>
    );
}
