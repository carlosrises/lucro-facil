import { DashboardSectionCards } from '@/components/dashboard/section-cards';
import { DashboardSectionChart } from '@/components/dashboard/section-chart';
import { DateRangePicker } from '@/components/date-range-picker';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

import AppLayout from '@/layouts/app-layout';

import { dashboard } from '@/routes';

import { type BreadcrumbItem } from '@/types';

import { Head, router } from '@inertiajs/react';
import { useState } from 'react';
import { DateRange } from 'react-day-picker';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Dashboard',
        href: dashboard().url,
    },
];

interface Store {
    id: number;
    name: string;
    provider: string;
}

interface Provider {
    value: string;
    label: string;
}

interface DashboardData {
    revenue: number;
    revenueChange: number;
    revenueAfterDeductions: number; // Líquido Pós Venda (novo nome)
    revenueAfterDeductionsChange: number;
    cmv: number;
    cmvChange: number;
    deliveryFee: number;
    deliveryChange: number;
    taxes: number;
    taxesChange: number;
    fixedCosts: number; // Agora vem de movimentações financeiras
    fixedCostsChange: number;
    contributionMargin: number; // Lucro Bruto (MC)
    contributionMarginChange: number;
    netProfit: number; // Lucro Líquido
    netProfitChange: number;
    orderCount: number;
}

interface ChartDataPoint {
    date: string;
    revenue: number;
    cmv: number;
    taxes: number;
    commissions: number;
    costs: number;
    paymentFees: number;
    netTotal: number;
}

interface DashboardProps {
    dashboardData: DashboardData;
    chartData: ChartDataPoint[];
    stores: Store[];
    providers: Provider[];
    filters: {
        start_date: string;
        end_date: string;
        store_id?: number;
        provider?: string;
    };
}

export default function Dashboard({
    dashboardData,
    chartData,
    stores,
    providers,
    filters,
}: DashboardProps) {
    const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
        if (filters.start_date && filters.end_date) {
            return {
                from: new Date(filters.start_date + 'T12:00:00'),
                to: new Date(filters.end_date + 'T12:00:00'),
            };
        }
        return undefined;
    });

    const [selectedStore, setSelectedStore] = useState<string>(
        filters.store_id ? String(filters.store_id) : 'all',
    );

    const [selectedProvider, setSelectedProvider] = useState<string>(
        filters.provider || 'all',
    );

    const handleDateRangeChange = (range: DateRange | undefined) => {
        setDateRange(range);
        router.get(
            '/dashboard',
            {
                start_date: range?.from
                    ? range.from.toISOString().split('T')[0]
                    : undefined,
                end_date: range?.to
                    ? range.to.toISOString().split('T')[0]
                    : undefined,
                store_id: selectedStore !== 'all' ? selectedStore : undefined,
                provider:
                    selectedProvider !== 'all' ? selectedProvider : undefined,
            },
            {
                preserveState: true,
                preserveScroll: true,
            },
        );
    };

    const handleStoreChange = (value: string) => {
        setSelectedStore(value);
        router.get(
            '/dashboard',
            {
                start_date: dateRange?.from
                    ? dateRange.from.toISOString().split('T')[0]
                    : undefined,
                end_date: dateRange?.to
                    ? dateRange.to.toISOString().split('T')[0]
                    : undefined,
                store_id: value !== 'all' ? value : undefined,
                provider:
                    selectedProvider !== 'all' ? selectedProvider : undefined,
            },
            {
                preserveState: true,
                preserveScroll: true,
            },
        );
    };

    const handleProviderChange = (value: string) => {
        setSelectedProvider(value);
        router.get(
            '/dashboard',
            {
                start_date: dateRange?.from
                    ? dateRange.from.toISOString().split('T')[0]
                    : undefined,
                end_date: dateRange?.to
                    ? dateRange.to.toISOString().split('T')[0]
                    : undefined,
                store_id: selectedStore !== 'all' ? selectedStore : undefined,
                provider: value !== 'all' ? value : undefined,
            },
            {
                preserveState: true,
                preserveScroll: true,
            },
        );
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Dashboard" />

            <div className="flex flex-1 flex-col">
                <div className="@container/main flex flex-1 flex-col gap-2">
                    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                        {/* Filtros */}
                        <div className="flex flex-col gap-4 px-4 sm:flex-row lg:px-6">
                            <DateRangePicker
                                value={dateRange}
                                onChange={handleDateRangeChange}
                            />

                            <Select
                                value={selectedStore}
                                onValueChange={handleStoreChange}
                            >
                                <SelectTrigger className="w-full sm:w-[240px]">
                                    <SelectValue placeholder="Todas as lojas" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">
                                        Todas as lojas
                                    </SelectItem>
                                    {stores.map((store) => (
                                        <SelectItem
                                            key={store.id}
                                            value={String(store.id)}
                                        >
                                            {store.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Select
                                value={selectedProvider}
                                onValueChange={handleProviderChange}
                            >
                                <SelectTrigger className="w-full sm:w-[200px]">
                                    <SelectValue placeholder="Todos os marketplaces" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">
                                        Todos os marketplaces
                                    </SelectItem>
                                    {providers.map((provider) => (
                                        <SelectItem
                                            key={provider.value}
                                            value={provider.value}
                                        >
                                            {provider.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <DashboardSectionCards data={dashboardData} />

                        <div className="px-4 lg:px-6">
                            <DashboardSectionChart data={chartData} />
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
