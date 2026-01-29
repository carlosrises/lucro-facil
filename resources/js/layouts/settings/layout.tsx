import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

import { cn } from '@/lib/utils';

import { edit as appearance } from '@/routes/appearance';
import { edit as billing } from '@/routes/billing';
import { edit as general } from '@/routes/general';
import { index as integrations } from '@/routes/integrations';
import { edit as password } from '@/routes/password';
import { edit as profile } from '@/routes/profile';
import { show as twoFactorAuthentication } from '@/routes/two-factor';

import { type NavItem } from '@/types';
import { type PropsWithChildren } from 'react';

import { Link } from '@inertiajs/react';
import {
    CreditCard,
    LockKeyhole,
    RectangleEllipsis,
    Settings2,
    Shapes,
    SunMoon,
    UserPen,
} from 'lucide-react';

const sidebarNavItems: NavItem[] = [
    {
        title: 'Geral',
        href: general(),
        icon: Settings2,
    },
    {
        title: 'Informações de Perfil',
        href: profile(),
        icon: UserPen,
    },
    {
        title: 'Atualizar senha',
        href: password(),
        icon: LockKeyhole,
    },
    {
        title: '2FA',
        href: twoFactorAuthentication(),
        icon: RectangleEllipsis,
    },
    {
        title: 'Aparência',
        href: appearance(),
        icon: SunMoon,
    },
    {
        title: 'Planos e Assinatura',
        href: billing(),
        icon: CreditCard,
    },
    {
        title: 'Integrações',
        href: integrations(),
        icon: Shapes,
    },
];

export default function SettingsLayout({ children }: PropsWithChildren) {
    // When server-side rendering, we only render the layout on the client...
    if (typeof window === 'undefined') {
        return null;
    }

    const currentPath = window.location.pathname;

    return (
        <div className="px-4 py-6">
            <Heading
                title="Configurações"
                description="Gerencie seu perfil e as configurações da conta"
            />

            <div className="flex flex-col lg:flex-row lg:space-x-12">
                <aside className="w-full max-w-xl lg:w-48">
                    <nav className="flex flex-col space-y-1 space-x-0">
                        {sidebarNavItems.map((item, index) => (
                            <Button
                                key={`${typeof item.href === 'string' ? item.href : item.href.url}-${index}`}
                                size="sm"
                                variant="ghost"
                                asChild
                                className={cn('w-full justify-start', {
                                    'bg-muted':
                                        currentPath ===
                                        (typeof item.href === 'string'
                                            ? item.href
                                            : item.href.url),
                                })}
                            >
                                <Link href={item.href}>
                                    {item.icon && (
                                        <item.icon className="h-4 w-4" />
                                    )}
                                    {item.title}
                                </Link>
                            </Button>
                        ))}
                    </nav>
                </aside>

                <Separator className="my-6 lg:hidden" />

                <div className="flex-1">
                    <section className="space-y-12">{children}</section>
                </div>
            </div>
        </div>
    );
}
