import { DashboardSectionCards } from '@/components/dashboard/section-cards';
import { DashboardSectionChart } from '@/components/dashboard/section-chart';
import { DateRangePicker } from '@/components/date-range-picker';

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

interface DashboardData {
    revenue: number;
    revenueChange: number;
    netTotal: number;
    netChange: number;
    cmv: number;
    cmvChange: number;
    deliveryFee: number;
    deliveryChange: number;
    taxes: number;
    taxesChange: number;
    fixedCosts: number;
    fixedCostsChange: number;
    grossProfit: number;
    grossProfitChange: number;
    margin: number;
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
    filters: {
        start_date: string;
        end_date: string;
    };
}

export default function Dashboard({
    dashboardData,
    chartData,
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
                        {/* Filtro de Período */}
                        <div className="px-4 lg:px-6">
                            <DateRangePicker
                                value={dateRange}
                                onChange={handleDateRangeChange}
                            />
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
