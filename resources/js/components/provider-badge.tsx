import { UtensilsCrossedIcon } from 'lucide-react';

type Provider = 'ifood' | 'takeat' | '99food' | string;

interface Props {
    provider: Provider;
}

const providerConfig: Record<
    string,
    { label: string; style: string; logo?: string }
> = {
    ifood: {
        label: 'iFood',
        style: 'h-5 w-auto',
        logo: '/images/ifood.svg',
    },
    takeat: {
        label: 'Takeat',
        style: 'h-4 w-auto',
        logo: '/images/takeat.svg',
    },
    '99food': {
        label: '99Food',
        style: 'h-3 w-auto',
        logo: '/images/99food.png',
    },
};

export function ProviderBadge({ provider }: Props) {
    const config = providerConfig[provider] ?? {
        label: provider,
        color: 'bg-gray-500 text-white',
    };

    return (
        <>
            {config.logo ? (
                <img
                    src={config.logo}
                    alt={config.label}
                    className={config.style}
                />
            ) : (
                <UtensilsCrossedIcon className="h-3 w-3" />
            )}
        </>
    );
}
