import { Button } from '@/components/ui/button';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import { register } from '@/routes';
import { Link } from '@inertiajs/react';
import { ArrowRight, MessageCircle } from 'lucide-react';

export default function FinalCTA() {
    const { ref, isVisible } = useScrollAnimation();
    return (
        <section
            ref={ref}
            className={`relative overflow-hidden bg-gradient-to-br from-green-600 via-green-600 to-blue-600 py-24 lg:py-32 ${
                isVisible ? 'animate-on-scroll' : 'opacity-0'
            }`}
        >
            {/* Decorative Elements */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.1),transparent_50%)]"></div>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(255,255,255,0.1),transparent_50%)]"></div>

            <div className="relative container mx-auto px-6 lg:px-8">
                <div className="mx-auto max-w-7xl text-center">
                    <h2 className="mb-6 text-4xl font-bold text-white sm:text-5xl lg:text-6xl">
                        Pare de vender no escuro
                    </h2>

                    <p className="mb-10 text-xl text-white/90 sm:text-2xl">
                        Descubra quanto você está realmente lucrando em cada
                        pedido. <strong>Comece grátis hoje.</strong>
                    </p>

                    <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                        <Link href={register()}>
                            <Button
                                size="lg"
                                className="h-16 bg-white px-10 text-lg font-bold text-green-600 shadow-2xl transition-all hover:bg-gray-50"
                            >
                                Começar teste grátis de 7 dias
                                <ArrowRight className="ml-2 h-6 w-6" />
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
                                className="h-16 border-2 border-white bg-transparent px-10 text-lg font-bold text-white transition-all hover:bg-white/10"
                            >
                                <MessageCircle className="mr-2 h-6 w-6" />
                                Falar com consultor
                            </Button>
                        </a>
                    </div>

                    <div className="mt-10 flex flex-wrap items-center justify-center gap-8 text-sm text-white/80">
                        <div className="flex items-center gap-2">
                            ✓ <span>7 dias grátis</span>
                        </div>
                        <div className="flex items-center gap-2">
                            ✓ <span>Sem cartão de crédito</span>
                        </div>
                        <div className="flex items-center gap-2">
                            ✓ <span>Cancele quando quiser</span>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
