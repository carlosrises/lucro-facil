import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import {
    BarChart3,
    Bell,
    Calculator,
    FileText,
    Layers,
    Sparkles,
    TrendingUp,
    Users,
    Zap,
} from 'lucide-react';

interface FeaturesProps {
    id?: string;
}

export default function Features({ id }: FeaturesProps) {
    const { ref, isVisible } = useScrollAnimation();
    const features = [
        {
            icon: Sparkles,
            title: 'Lucro Pedido a Pedido',
            description:
                'Veja em tempo real quanto você realmente ganhou em cada venda, descontando tudo.',
            highlight: true,
        },
        {
            icon: Calculator,
            title: 'CMV Automático',
            description:
                'Custo de mercadoria vendida calculado automaticamente por produto e ingrediente.',
        },
        {
            icon: Layers,
            title: 'Todas as Taxas Visíveis',
            description:
                'iFood, 99, Rappi, cartão, PIX, promoções. Tudo detalhado e transparente.',
        },
        {
            icon: TrendingUp,
            title: 'Análise de Margem',
            description:
                'Identifique quais produtos têm melhor margem e quais estão dando prejuízo.',
        },
        {
            icon: FileText,
            title: 'Relatórios Gerenciais',
            description:
                'Relatórios completos de vendas, custos, DRE simplificado e análise de canais.',
        },
        {
            icon: Users,
            title: 'Gestão de Colaboradores',
            description:
                'Controle de acesso por função, histórico de ações e auditoria completa.',
        },
        {
            icon: Bell,
            title: 'Alertas Inteligentes',
            description:
                'Notificações quando um pedido der prejuízo ou quando as margens caírem.',
        },
        {
            icon: BarChart3,
            title: 'Dashboards em Tempo Real',
            description:
                'Métricas atualizadas automaticamente: vendas, lucro, ticket médio e muito mais.',
        },
        {
            icon: Zap,
            title: 'Integrações Automáticas',
            description:
                'Conecta com iFood, 99Food, Takeat, Saipos e importa pedidos automaticamente.',
        },
    ];

    return (
        <section
            ref={ref}
            id={id}
            className={`relative bg-white py-24 lg:py-32 ${
                isVisible ? 'animate-on-scroll' : 'opacity-0'
            }`}
        >
            <div className="container mx-auto px-6 lg:px-8">
                <div className="mx-auto max-w-7xl">
                    {/* Header */}
                    <div className="mb-16 text-center">
                        <h2 className="mb-4 text-4xl font-bold text-gray-900 lg:text-5xl">
                            Funcionalidades Completas
                        </h2>
                        <p className="text-xl text-gray-600">
                            Tudo que você precisa para ter controle real do seu
                            negócio
                        </p>
                    </div>

                    {/* Features Grid */}
                    <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                        {features.map((feature, index) => {
                            const Icon = feature.icon;
                            return (
                                <div
                                    key={index}
                                    className={`rounded-xl border p-6 transition-all hover:shadow-lg ${
                                        feature.highlight
                                            ? 'border-green-300 bg-gradient-to-br from-green-50 to-green-50 ring-2 ring-green-200'
                                            : 'border-gray-200 bg-white hover:border-gray-300'
                                    }`}
                                >
                                    <div
                                        className={`mb-4 inline-flex items-center justify-center rounded-lg p-3 ${
                                            feature.highlight
                                                ? 'bg-green-600'
                                                : 'bg-gray-100'
                                        }`}
                                    >
                                        <Icon
                                            className={`h-6 w-6 ${feature.highlight ? 'text-white' : 'text-gray-600'}`}
                                        />
                                    </div>
                                    <h3 className="mb-2 text-lg font-semibold text-gray-900">
                                        {feature.title}
                                        {feature.highlight && (
                                            <span className="ml-2 text-xs font-bold text-green-600">
                                                DESTAQUE
                                            </span>
                                        )}
                                    </h3>
                                    <p className="text-sm leading-relaxed text-gray-600">
                                        {feature.description}
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
