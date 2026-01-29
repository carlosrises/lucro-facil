import { DashboardSectionCards } from '@/components/dashboard/section-cards';
import { DashboardSectionChart } from '@/components/dashboard/section-chart';
import { UpgradeBanner } from '@/components/dashboard/upgrade-banner';
import { DateRangePicker } from '@/components/date-range-picker';
import { Button } from '@/components/ui/button';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';

import AppLayout from '@/layouts/app-layout';

import { dashboard } from '@/routes';

import { type BreadcrumbItem } from '@/types';

import { cn } from '@/lib/utils';
import { Head, router } from '@inertiajs/react';
import { Check, ChevronsUpDown, Store as StoreIcon } from 'lucide-react';
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

interface Plan {
    code: string;
    name: string;
}

interface DashboardProps {
    dashboardData: DashboardData;
    chartData: ChartDataPoint[];
    stores: Store[];
    providerOptions: Provider[];
    currentPlan?: Plan;
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
    providerOptions,
    currentPlan,
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

    const [openStoreCombo, setOpenStoreCombo] = useState(false);
    const [openProviderCombo, setOpenProviderCombo] = useState(false);

    // Mapear logos dos marketplaces
    const getMarketplaceLogo = (provider: string) => {
        const logoMap: Record<string, { src: string; alt: string }> = {
            ifood: {
                src: '/images/ifood.svg',
                alt: 'iFood',
            },
            takeat: {
                src: '/images/takeat.svg',
                alt: 'Takeat',
            },
            '99food': {
                src: '/images/99food.png',
                alt: '99Food',
            },
            rappi: {
                src: '/images/rappi.svg',
                alt: 'Rappi',
            },
            neemo: {
                src: '/images/neemo.png',
                alt: 'Neemo',
            },
        };
        return logoMap[provider] || null;
    };

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
                        {/* Banner de Upgrade (apenas se FREE) */}
                        {currentPlan && (
                            <div className="px-4 lg:px-6">
                                <UpgradeBanner currentPlan={currentPlan} />
                            </div>
                        )}

                        {/* Filtros */}
                        <div className="flex flex-col gap-4 px-4 sm:flex-row lg:px-6">
                            <DateRangePicker
                                value={dateRange}
                                onChange={handleDateRangeChange}
                            />

                            {/* Filtro de Lojas com Combobox */}
                            <Popover
                                open={openStoreCombo}
                                onOpenChange={setOpenStoreCombo}
                            >
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={openStoreCombo}
                                        className="h-9 w-full justify-between sm:w-[280px]"
                                    >
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            {selectedStore === 'all' ? (
                                                <>
                                                    <StoreIcon className="h-4 w-4 shrink-0" />
                                                    <span className="truncate">
                                                        Todas as lojas
                                                    </span>
                                                </>
                                            ) : (
                                                (() => {
                                                    const store = stores.find(
                                                        (s) =>
                                                            String(s.id) ===
                                                            selectedStore,
                                                    );
                                                    const logo =
                                                        store &&
                                                        getMarketplaceLogo(
                                                            store.provider,
                                                        );
                                                    return (
                                                        <>
                                                            {logo ? (
                                                                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded border bg-background">
                                                                    <img
                                                                        src={
                                                                            logo.src
                                                                        }
                                                                        alt={
                                                                            logo.alt
                                                                        }
                                                                        className="h-4 w-4 object-contain"
                                                                    />
                                                                </div>
                                                            ) : (
                                                                <StoreIcon className="h-4 w-4 shrink-0" />
                                                            )}
                                                            <span className="truncate">
                                                                {store?.name ||
                                                                    'Selecionar...'}
                                                            </span>
                                                        </>
                                                    );
                                                })()
                                            )}
                                        </div>
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent
                                    className="w-[280px] p-0"
                                    align="start"
                                >
                                    <Command>
                                        <CommandInput
                                            placeholder="Buscar loja..."
                                            className="h-9"
                                        />
                                        <CommandList>
                                            <CommandEmpty>
                                                Nenhuma loja encontrada.
                                            </CommandEmpty>
                                            <CommandGroup>
                                                <CommandItem
                                                    value="all"
                                                    keywords={[
                                                        'todas',
                                                        'all',
                                                        'lojas',
                                                    ]}
                                                    onSelect={() => {
                                                        handleStoreChange(
                                                            'all',
                                                        );
                                                        setOpenStoreCombo(
                                                            false,
                                                        );
                                                    }}
                                                >
                                                    <StoreIcon className="mr-2 h-4 w-4" />
                                                    Todas as lojas
                                                    <Check
                                                        className={cn(
                                                            'ml-auto h-4 w-4',
                                                            selectedStore ===
                                                                'all'
                                                                ? 'opacity-100'
                                                                : 'opacity-0',
                                                        )}
                                                    />
                                                </CommandItem>
                                                {stores.map((store) => {
                                                    const logo =
                                                        getMarketplaceLogo(
                                                            store.provider,
                                                        );
                                                    return (
                                                        <CommandItem
                                                            key={store.id}
                                                            value={store.name}
                                                            keywords={[
                                                                store.name,
                                                                store.provider,
                                                                String(
                                                                    store.id,
                                                                ),
                                                            ]}
                                                            onSelect={() => {
                                                                handleStoreChange(
                                                                    String(
                                                                        store.id,
                                                                    ),
                                                                );
                                                                setOpenStoreCombo(
                                                                    false,
                                                                );
                                                            }}
                                                        >
                                                            {logo ? (
                                                                <div className="mr-2 flex h-6 w-6 shrink-0 items-center justify-center rounded border bg-background">
                                                                    <img
                                                                        src={
                                                                            logo.src
                                                                        }
                                                                        alt={
                                                                            logo.alt
                                                                        }
                                                                        className="h-4 w-4 object-contain"
                                                                    />
                                                                </div>
                                                            ) : (
                                                                <StoreIcon className="mr-2 h-4 w-4" />
                                                            )}
                                                            {store.name}
                                                            <Check
                                                                className={cn(
                                                                    'ml-auto h-4 w-4',
                                                                    selectedStore ===
                                                                        String(
                                                                            store.id,
                                                                        )
                                                                        ? 'opacity-100'
                                                                        : 'opacity-0',
                                                                )}
                                                            />
                                                        </CommandItem>
                                                    );
                                                })}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>

                            {/* Filtro de Marketplaces com Combobox */}
                            <Popover
                                open={openProviderCombo}
                                onOpenChange={setOpenProviderCombo}
                            >
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={openProviderCombo}
                                        className="h-9 w-full justify-between sm:w-[280px]"
                                    >
                                        <span className="truncate">
                                            {selectedProvider === 'all'
                                                ? 'Todos os marketplaces'
                                                : providerOptions.find(
                                                      (p) =>
                                                          p.value ===
                                                          selectedProvider,
                                                  )?.label || 'Selecionar...'}
                                        </span>
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent
                                    className="w-[280px] p-0"
                                    align="start"
                                >
                                    <Command>
                                        <CommandInput
                                            placeholder="Buscar marketplace..."
                                            className="h-9"
                                        />
                                        <CommandList>
                                            <CommandEmpty>
                                                Nenhum marketplace encontrado.
                                            </CommandEmpty>
                                            <CommandGroup>
                                                <CommandItem
                                                    value="all"
                                                    keywords={[
                                                        'todos',
                                                        'all',
                                                        'marketplaces',
                                                    ]}
                                                    onSelect={() => {
                                                        handleProviderChange(
                                                            'all',
                                                        );
                                                        setOpenProviderCombo(
                                                            false,
                                                        );
                                                    }}
                                                >
                                                    Todos os marketplaces
                                                    <Check
                                                        className={cn(
                                                            'ml-auto h-4 w-4',
                                                            selectedProvider ===
                                                                'all'
                                                                ? 'opacity-100'
                                                                : 'opacity-0',
                                                        )}
                                                    />
                                                </CommandItem>
                                                {providerOptions.map(
                                                    (provider) => (
                                                        <CommandItem
                                                            key={provider.value}
                                                            value={
                                                                provider.label
                                                            }
                                                            keywords={[
                                                                provider.label,
                                                                provider.value,
                                                            ]}
                                                            onSelect={() => {
                                                                handleProviderChange(
                                                                    provider.value,
                                                                );
                                                                setOpenProviderCombo(
                                                                    false,
                                                                );
                                                            }}
                                                        >
                                                            {provider.label}
                                                            <Check
                                                                className={cn(
                                                                    'ml-auto h-4 w-4',
                                                                    selectedProvider ===
                                                                        provider.value
                                                                        ? 'opacity-100'
                                                                        : 'opacity-0',
                                                                )}
                                                            />
                                                        </CommandItem>
                                                    ),
                                                )}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
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
