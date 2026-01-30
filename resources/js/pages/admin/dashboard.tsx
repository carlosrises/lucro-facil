import { Badge } from '@/components/ui/badge';
import {
    Card,
    CardAction,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import AppLayout from '@/layouts/app-layout';
import admin from '@/routes/admin';
import { type BreadcrumbItem } from '@/types';
import { Head, usePage } from '@inertiajs/react';
import { IconTrendingUp } from '@tabler/icons-react';
import {
    Building,
    Store,
    Ticket,
    TrendingUp,
    UserPlus,
    Users,
} from 'lucide-react';

interface AdminStats {
    total_clients: number;
    active_subscriptions: number;
    trialing_subscriptions: number;
    monthly_revenue: number;
    annual_revenue: number;
    open_tickets: number;
    total_stores: number;
    new_clients_this_month: number;
    clients_change: number;
    subscriptions_change: number;
}

interface RecentActivity {
    type: string;
    message: string;
    time: string;
    color: string;
}

interface PlanDistribution {
    name: string;
    count: number;
}

interface AdminDashboardProps {
    stats: AdminStats;
    recent_activity: RecentActivity[];
    plan_distribution: PlanDistribution[];
    [key: string]: unknown;
}

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Administração',
        href: admin.dashboard().url,
    },
    {
        title: 'Dashboard',
        href: admin.dashboard().url,
    },
];

export default function AdminDashboard() {
    const { stats, recent_activity, plan_distribution } =
        usePage<AdminDashboardProps>().props;

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
        }).format(value);
    };

    const formatPercentage = (value: number) => {
        const sign = value >= 0 ? '+' : '';
        return `${sign}${value.toFixed(1)}%`;
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Dashboard Admin" />

            <div className="flex flex-1 flex-col">
                <div className="@container/main flex flex-1 flex-col gap-2">
                    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                        {/* Cards de Estatísticas */}
                        <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
                            <Card className="@container/card">
                                <CardHeader>
                                    <CardDescription className="flex items-center gap-2">
                                        <Users className="h-4 w-4" />
                                        Total de Clientes
                                    </CardDescription>
                                    <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                                        {stats.total_clients}
                                    </CardTitle>
                                    <CardAction>
                                        <Badge
                                            variant="outline"
                                            className={
                                                stats.clients_change >= 0
                                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                                    : 'border-red-200 bg-red-50 text-red-700'
                                            }
                                        >
                                            <IconTrendingUp className="h-3 w-3" />
                                            {formatPercentage(
                                                stats.clients_change,
                                            )}
                                        </Badge>
                                    </CardAction>
                                </CardHeader>
                            </Card>

                            <Card className="@container/card">
                                <CardHeader>
                                    <CardDescription className="flex items-center gap-2">
                                        <Building className="h-4 w-4" />
                                        Assinaturas Ativas
                                    </CardDescription>
                                    <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                                        {stats.active_subscriptions}
                                    </CardTitle>
                                    <CardAction>
                                        <Badge
                                            variant="outline"
                                            className={
                                                stats.subscriptions_change >= 0
                                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                                    : 'border-red-200 bg-red-50 text-red-700'
                                            }
                                        >
                                            <IconTrendingUp className="h-3 w-3" />
                                            {formatPercentage(
                                                stats.subscriptions_change,
                                            )}
                                        </Badge>
                                    </CardAction>
                                </CardHeader>
                            </Card>

                            <Card className="@container/card">
                                <CardHeader>
                                    <CardDescription className="flex items-center gap-2">
                                        <TrendingUp className="h-4 w-4" />
                                        Receita Mensal (MRR)
                                    </CardDescription>
                                    <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                                        {formatCurrency(stats.monthly_revenue)}
                                    </CardTitle>
                                    <CardAction>
                                        <Badge
                                            variant="outline"
                                            className="text-xs"
                                        >
                                            ARR:{' '}
                                            {formatCurrency(
                                                stats.annual_revenue,
                                            )}
                                        </Badge>
                                    </CardAction>
                                </CardHeader>
                            </Card>

                            <Card className="@container/card">
                                <CardHeader>
                                    <CardDescription className="flex items-center gap-2">
                                        <UserPlus className="h-4 w-4" />
                                        Em Período Trial
                                    </CardDescription>
                                    <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                                        {stats.trialing_subscriptions}
                                    </CardTitle>
                                    <CardAction>
                                        <Badge
                                            variant="outline"
                                            className="text-xs"
                                        >
                                            {stats.new_clients_this_month} novos
                                            este mês
                                        </Badge>
                                    </CardAction>
                                </CardHeader>
                            </Card>

                            <Card className="@container/card">
                                <CardHeader>
                                    <CardDescription className="flex items-center gap-2">
                                        <Store className="h-4 w-4" />
                                        Total de Lojas
                                    </CardDescription>
                                    <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                                        {stats.total_stores}
                                    </CardTitle>
                                </CardHeader>
                            </Card>

                            <Card className="@container/card">
                                <CardHeader>
                                    <CardDescription className="flex items-center gap-2">
                                        <Ticket className="h-4 w-4" />
                                        Chamados Abertos
                                    </CardDescription>
                                    <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                                        {stats.open_tickets}
                                    </CardTitle>
                                    <CardAction>
                                        <Badge
                                            variant={
                                                stats.open_tickets > 5
                                                    ? 'destructive'
                                                    : 'outline'
                                            }
                                        >
                                            {stats.open_tickets > 5
                                                ? 'Alta demanda'
                                                : 'Normal'}
                                        </Badge>
                                    </CardAction>
                                </CardHeader>
                            </Card>
                        </div>

                        {/* Seção de Atividade Recente */}
                        <div className="px-4 lg:px-6">
                            <div className="grid gap-4 md:grid-cols-2">
                                {/* Atividade Recente */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Atividade Recente</CardTitle>
                                        <CardDescription>
                                            Últimas atividades no sistema
                                        </CardDescription>
                                    </CardHeader>
                                    <div className="p-6 pt-0">
                                        <div className="space-y-4">
                                            {recent_activity.map(
                                                (activity, index) => (
                                                    <div
                                                        key={index}
                                                        className="flex items-start gap-4"
                                                    >
                                                        <div
                                                            className={`mt-2 h-2 w-2 rounded-full bg-${activity.color}-500`}
                                                        />
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-sm leading-none font-medium">
                                                                {
                                                                    activity.message
                                                                }
                                                            </p>
                                                            <p className="mt-1 text-xs text-muted-foreground">
                                                                {activity.time}
                                                            </p>
                                                        </div>
                                                    </div>
                                                ),
                                            )}
                                        </div>
                                    </div>
                                </Card>

                                {/* Distribuição por Planos */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle>
                                            Distribuição por Planos
                                        </CardTitle>
                                        <CardDescription>
                                            Assinaturas ativas por tipo de plano
                                        </CardDescription>
                                    </CardHeader>
                                    <div className="p-6 pt-0">
                                        <div className="space-y-4">
                                            {plan_distribution.map(
                                                (plan, index) => (
                                                    <div
                                                        key={index}
                                                        className="flex items-center justify-between"
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <div className="h-2 w-2 rounded-full bg-primary" />
                                                            <span className="text-sm font-medium">
                                                                {plan.name}
                                                            </span>
                                                        </div>
                                                        <span className="text-sm text-muted-foreground">
                                                            {plan.count}
                                                        </span>
                                                    </div>
                                                ),
                                            )}
                                        </div>
                                    </div>
                                </Card>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
