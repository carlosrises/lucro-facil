import { useScrollAnimation } from '@/hooks/useScrollAnimation';

interface IntegrationsProps {
    id?: string;
}

export default function Integrations({ id }: IntegrationsProps) {
    const { ref, isVisible } = useScrollAnimation();
    const integrations = [
        { name: 'iFood', logo: '/images/ifood.svg' },
        { name: '99Food', logo: '/images/99food.svg' },
        { name: 'Takeat', logo: '/images/takeat.svg' },
        { name: 'Neemo', logo: '/images/neemo.png' },
    ];

    return (
        <section
            ref={ref}
            id={id}
            className={`border-t border-gray-200 bg-gray-50 py-20 ${
                isVisible ? 'animate-on-scroll' : 'opacity-0'
            }`}
        >
            <div className="container mx-auto px-6 lg:px-8">
                <div className="mx-auto max-w-7xl text-center">
                    <p className="mb-12 text-sm font-semibold tracking-wide text-gray-500 uppercase">
                        Integre com os principais marketplaces
                    </p>

                    <div className="flex flex-wrap items-center justify-center gap-x-16 gap-y-12">
                        {integrations.map((item) => (
                            <div
                                key={item.name}
                                className="opacity-70 grayscale transition-all hover:opacity-100 hover:grayscale-0"
                            >
                                <img
                                    src={item.logo}
                                    alt={item.name}
                                    className="h-12 w-auto object-contain"
                                />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
