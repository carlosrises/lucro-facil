import { Head, usePage } from '@inertiajs/react';

import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';

import HeadingSmall from '@/components/heading-small';

import { type BreadcrumbItem } from '@/types';

import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { index as integrations } from '@/routes/integrations';
import { AlertCircle } from 'lucide-react';
import { NineNineFoodDrawer } from '../../components/settings/integrations/99food-drawer';
import { IntegrationDrawer } from '../../components/settings/integrations/integration-drawer';
import { MarketplaceCard } from '../../components/settings/integrations/marketplace-card';
import { TakeatDrawer } from '../../components/settings/integrations/takeat-drawer';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Integrações',
        href: integrations().url,
    },
];

const marketplaces = [
    {
        name: 'iFood',
        logo: '/images/integrations/ifood.svg',
        description: 'Integração com pedidos iFood',
        available: true,
    },
    {
        name: 'Takeat',
        logo: '/images/integrations/takeat.svg',
        description: 'Integração com pedidos Takeat',
        available: true,
    },
    {
        name: '99Food',
        logo: '/images/integrations/99food.jpg',
        description: 'Integração com pedidos 99Food',
        available: false,
    },
    {
        name: 'Keeta',
        logo: '/images/integrations/keeta.png',
        description: 'Integração com pedidos Keeta',
        available: false,
    },

    {
        name: 'Saipos',
        logo: '/images/integrations/saipos.png',
        description: 'Integração com pedidos Saipos',
        available: false,
    },
    {
        name: 'Cardápio Web',
        logo: '/images/integrations/cardapioweb.webp',
        description: 'Integração com pedidos Cardápio Web',
        available: false,
    },
    {
        name: 'Anota AI',
        logo: '/images/integrations/anotaai.png',
        description: 'Integração com pedidos Anota AI',
        available: false,
    },
    {
        name: 'aiqfome',
        logo: '/images/integrations/aiqfome.png',
        description: 'Integração com pedidos aiqfome',
        available: false,
    },
];

export default function Integration() {
    // Espera props do backend
    const {
        storesWithError = [],
        storesWithExpiredToken = [],
        storesWithTokenExpiringSoon = [],
    } = usePage<{
        storesWithError?: import('@/components/stores/columns').Store[];
        storesWithExpiredToken?: Array<{
            id: number;
            display_name: string;
            provider: string;
        }>;
        storesWithTokenExpiringSoon?: Array<{
            id: number;
            display_name: string;
            provider: string;
            expires_at: string;
        }>;
    }>().props;
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Integrações" />
            <SettingsLayout>
                <div className="space-y-6">
                    <HeadingSmall
                        title="Integrações"
                        description="Integre seus marketplaces de delivery."
                    />

                    {/* Alerta de tokens expirados */}
                    {storesWithExpiredToken.length > 0 && (
                        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                            <div className="flex items-start gap-3">
                                <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
                                <div className="flex-1">
                                    <h3 className="font-semibold text-red-900">
                                        Tokens de autenticação expirados
                                    </h3>
                                    <p className="mt-1 text-sm text-red-700">
                                        As seguintes lojas precisam ser
                                        reconectadas (credenciais inválidas):
                                    </p>
                                    <ul className="mt-2 space-y-1">
                                        {storesWithExpiredToken.map((store) => (
                                            <li
                                                key={store.id}
                                                className="text-sm text-red-700"
                                            >
                                                • {store.display_name} (
                                                {store.provider})
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {marketplaces.map((market) => {
                            const showAlert =
                                market.name.toLowerCase() === 'ifood' &&
                                storesWithError.length > 0;

                            // Renderiza drawer específico para 99Food
                            if (market.name === '99Food' && market.available) {
                                return (
                                    <NineNineFoodDrawer
                                        key={market.name}
                                        name={market.name}
                                        logo={market.logo}
                                        description={market.description}
                                        available={market.available}
                                    />
                                );
                            }

                            // Renderiza drawer específico para Takeat
                            if (market.name === 'Takeat' && market.available) {
                                return (
                                    <TakeatDrawer
                                        key={market.name}
                                        name={market.name}
                                        logo={market.logo}
                                        description={market.description}
                                        available={market.available}
                                    />
                                );
                            }

                            return market.available ? (
                                <div className="relative" key={market.name}>
                                    {showAlert && (
                                        <span
                                            className="absolute top-2 right-2 z-10"
                                            title="Há lojas iFood que necessitam reintegração"
                                        >
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <AlertCircle
                                                        size={22}
                                                        className="text-red-500"
                                                    />
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>
                                                        Loja com necessidade de
                                                        integração
                                                    </p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </span>
                                    )}
                                    <IntegrationDrawer
                                        name={market.name}
                                        logo={market.logo}
                                        description={market.description}
                                        available={market.available}
                                    />
                                </div>
                            ) : (
                                <MarketplaceCard
                                    key={market.name}
                                    name={market.name}
                                    logo={market.logo}
                                    description="Integração em breve"
                                    available={market.available}
                                    showAlert={showAlert}
                                />
                            );
                        })}
                    </div>
                </div>
            </SettingsLayout>
        </AppLayout>
    );
}
// ...
