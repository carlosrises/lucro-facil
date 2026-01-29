import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import {
    AlertCircle,
    DollarSign,
    Eye,
    Target,
    TrendingDown,
} from 'lucide-react';

interface ProblemProps {
    id?: string;
}

export default function Problem({ id }: ProblemProps) {
    const { ref, isVisible } = useScrollAnimation();
    const problems = [
        {
            icon: TrendingDown,
            title: 'Não sabe em qual pedido ganha ou perde dinheiro',
            description:
                'Muitos restaurantes só descobrem o prejuízo no fim do mês, quando já é tarde demais.',
        },
        {
            icon: DollarSign,
            title: 'Taxas escondidas corroem o lucro',
            description:
                'iFood, 99, taxas de cartão, promoções e CMV mal calculado destroem sua margem.',
        },
        {
            icon: Eye,
            title: 'Fatura R$ 100 mil, mas não sobra nada',
            description:
                'Alto faturamento não significa lucro. Sem controle, você trabalha de graça.',
        },
        {
            icon: Target,
            title: 'Decisões no escuro',
            description:
                'Sem saber o lucro por pedido, como decidir quais produtos vender mais?',
        },
    ];

    return (
        <section
            ref={ref}
            id={id}
            className={`relative bg-white py-20 lg:py-32 ${
                isVisible ? 'animate-on-scroll' : 'opacity-0'
            }`}
        >
            <div className="container mx-auto px-6 lg:px-8">
                <div className="mx-auto max-w-7xl">
                    {/* Header */}
                    <div className="mb-16 text-center">
                        <div className="mb-6 inline-flex items-center justify-center rounded-full bg-red-100 p-4">
                            <AlertCircle className="h-8 w-8 text-red-600" />
                        </div>
                        <h2 className="mb-4 text-4xl font-bold text-gray-900 lg:text-5xl">
                            Você está vendendo no escuro?
                        </h2>
                        <p className="text-xl text-gray-600">
                            <strong className="font-semibold text-gray-900">
                                Faturamento é vaidade. Lucro é sanidade.
                            </strong>
                        </p>
                    </div>

                    {/* Problems Grid */}
                    <div className="grid gap-6 md:grid-cols-2">
                        {problems.map((problem, index) => {
                            const Icon = problem.icon;
                            return (
                                <div
                                    key={index}
                                    className="rounded-xl border-2 border-red-200 bg-red-50 p-6 transition-all hover:border-red-300 hover:shadow-md"
                                >
                                    <div className="mb-4 flex items-center gap-3">
                                        <Icon className="h-6 w-6 flex-shrink-0 text-red-600" />
                                        <h3 className="font-semibold text-gray-900">
                                            {problem.title}
                                        </h3>
                                    </div>
                                    <p className="text-sm leading-relaxed text-gray-600">
                                        {problem.description}
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
