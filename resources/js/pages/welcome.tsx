import { type SharedData } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import { BarChart3 } from 'lucide-react';

// Landing Page Components
import Features from '@/components/landing/features';
import FinalCTA from '@/components/landing/final-cta';
import Hero from '@/components/landing/hero';
import Integrations from '@/components/landing/integrations';
import Pricing from '@/components/landing/pricing';
import Problem from '@/components/landing/problem';
import Solution from '@/components/landing/solution';

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

interface WelcomeProps extends SharedData {
    plans: Plan[];
}

export default function Welcome() {
    const { auth, plans } = usePage<WelcomeProps>().props;

    return (
        <>
            <Head title="Lucro Fácil - Tenha seu lucro em tempo real, pedido a pedido">
                <link rel="preconnect" href="https://fonts.bunny.net" />
                <link
                    href="https://fonts.bunny.net/css?family=instrument-sans:400,500,600"
                    rel="stylesheet"
                />
            </Head>

            <div className="min-h-screen bg-white">
                {/* Landing Page Sections */}
                <main>
                    <Hero />
                    <Problem id="problema" />
                    <Solution id="solucao" />
                    <Features id="recursos" />
                    <Integrations id="integracoes" />
                    <Pricing id="planos" plans={plans} />
                    <FinalCTA />
                </main>

                {/* Footer */}
                <footer className="border-t border-gray-200 bg-gray-50 py-12">
                    <div className="container mx-auto px-6 lg:px-8">
                        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
                            <div className="flex items-center gap-2">
                                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-green-600 to-green-600">
                                    <BarChart3 className="h-5 w-5 text-white" />
                                </div>
                                <span className="text-lg font-semibold text-gray-900">
                                    Lucro Fácil
                                </span>
                            </div>

                            <p className="text-sm text-gray-600">
                                © {new Date().getFullYear()} Lucro Fácil. Todos
                                os direitos reservados.
                            </p>

                            <div className="flex gap-6 text-sm text-gray-600">
                                <Link
                                    href="/terms"
                                    className="hover:text-green-600"
                                >
                                    Termos
                                </Link>
                                <Link
                                    href="/privacy"
                                    className="hover:text-green-600"
                                >
                                    Privacidade
                                </Link>
                                <a href="#" className="hover:text-green-600">
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
