import { NavAdmin } from '@/components/nav-admin';
import { NavFooter } from '@/components/nav-footer';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';

import { dashboard } from '@/routes';
import admin from '@/routes/admin';
import { edit as appearance } from '@/routes/appearance';
import { edit as general } from '@/routes/general';
import { index as integrations } from '@/routes/integrations';
import { index as orders } from '@/routes/orders';
import { edit as password } from '@/routes/password';
import { edit as profile } from '@/routes/profile';
import { index as sales } from '@/routes/sales';
import { index as stores } from '@/routes/stores';
import { show as twoFactorAuthentication } from '@/routes/two-factor';

import { type NavGroup, NavItem, type SharedData } from '@/types';

import { Link, usePage } from '@inertiajs/react';
import {
    Boxes,
    ChartBarBig,
    ClipboardList,
    CreditCard,
    DollarSign,
    FileText,
    LayoutGrid,
    LifeBuoy,
    LineChart,
    PieChart,
    Send,
    Settings,
    Store,
    Ticket,
    Users,
    Wallet,
} from 'lucide-react';
import Logo from './logo';

export const mainNavItems: (NavGroup | NavItem)[] = [
    {
        title: 'Dashboard',
        href: dashboard(),
        icon: LayoutGrid,
    },
    {
        title: 'Pedidos',
        href: orders(),
        icon: ChartBarBig,
    },
    {
        title: 'Vendas',
        href: sales(),
        icon: DollarSign,
    },
    {
        title: 'Lojas',
        href: stores(),
        icon: Store,
    },
    {
        title: 'Custos & Comissões',
        href: '/cost-commissions',
        icon: Wallet,
    },
    {
        title: 'Fluxo de Caixa',
        href: '#',
        icon: LineChart,
    },
    {
        title: 'Estoque',
        icon: Boxes,
        items: [
            {
                title: 'Inventário',
                href: '#',
            },
            {
                title: 'Compras',
                href: '#',
            },
            {
                title: 'Análise',
                href: '#',
            },
            {
                title: 'Lista de Produção',
                href: '#',
            },
            {
                title: 'Movimentação',
                href: '#',
            },
        ],
    },
    {
        title: 'Cadastros IPC',
        icon: ClipboardList,
        items: [
            {
                title: 'Insumos',
                href: '#',
            },
            {
                title: 'Produtos',
                href: '#',
            },
            {
                title: 'Combos',
                href: '#',
            },
        ],
    },
    {
        title: 'Análises',
        icon: PieChart,
        items: [
            {
                title: 'Curva ABC',
                href: '#',
            },
            {
                title: 'DRE',
                href: '#',
            },
            {
                title: 'Análise CMV',
                href: '#',
            },
            {
                title: 'Ponto de Equilíbrio',
                href: '#',
            },
        ],
    },
    {
        title: 'Configuração',
        icon: Settings,
        items: [
            {
                title: 'Geral',
                href: general(),
            },
            {
                title: 'Informações de Perfil',
                href: profile(),
            },
            {
                title: 'Atualizar senha',
                href: password(),
            },
            {
                title: '2FA',
                href: twoFactorAuthentication(),
            },
            {
                title: 'Aparência',
                href: appearance(),
            },
            {
                title: 'Integrações',
                href: integrations(),
            },
        ],
    },
    {
        title: 'Custos Fixos',
        href: '#',
        icon: Wallet,
    },
    {
        title: 'Relatórios',
        href: '#',
        icon: FileText,
    },
];

const footerNavItems: NavItem[] = [
    {
        title: 'Suporte',
        href: '#',
        icon: LifeBuoy,
    },
    {
        title: 'Feedback',
        href: '#',
        icon: Send,
    },
];

export function AppSidebar() {
    const { auth } = usePage<SharedData>().props;
    // Considera qualquer role que comece com 'admin' (ex: 'admin', 'admin:system', 'admin:tenant')
    const isAdmin = (auth.user?.roles ?? []).some((r: string) => r?.toString?.().startsWith?.('admin'));

    // Itens admin como array simples para o NavAdmin
    const adminNavItems: NavItem[] = [
        {
            title: 'Dashboard Admin',
            href: admin.dashboard(),
            icon: LayoutGrid,
        },
        {
            title: 'Clientes',
            href: admin.clients.index(),
            icon: Users,
        },
        {
            title: 'Planos',
            href: admin.plans(),
            icon: ClipboardList,
        },
        {
            title: 'Pagamentos',
            href: admin.payments(),
            icon: CreditCard,
        },
        {
            title: 'Chamados',
            href: admin.tickets(),
            icon: Ticket,
        },
    ];

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href={dashboard()} prefetch>
                                <Logo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                {isAdmin && <NavAdmin items={adminNavItems} />}
                <NavMain items={mainNavItems} />
            </SidebarContent>

            <SidebarFooter>
                <NavFooter items={footerNavItems} className="mt-auto" />
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
