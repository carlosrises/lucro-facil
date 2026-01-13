import { DataTable } from '@/components/ingredients/data-table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, usePage } from '@inertiajs/react';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Cadastros',
        href: '#',
    },
    {
        title: 'Insumos',
        href: '/ingredients',
    },
];

interface IngredientsProps {
    ingredients: {
        data: Array<{
            id: number;
            name: string;
            category_id: number | null;
            category?: {
                id: number;
                name: string;
            } | null;
            unit: string;
            unit_price: string;
            current_stock: string;
            ideal_stock: string;
            active: boolean;
        }>;
        current_page: number;
        last_page: number;
        per_page: number;
        from: number;
        to: number;
        total: number;
        next_page_url?: string | null;
        prev_page_url?: string | null;
        links: Array<{
            url: string | null;
            label: string;
            active: boolean;
        }>;
    };
    filters: {
        search: string;
        category_id: string;
        active: string;
        per_page: number;
    };
    categories: Array<{
        id: number;
        name: string;
    }>;
    [key: string]: unknown;
}

export default function Ingredients() {
    const { ingredients, filters, categories } =
        usePage<IngredientsProps>().props;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Insumos" />

            <div className="flex flex-1 flex-col">
                <div className="@container/main flex flex-1 flex-col gap-2">
                    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                        <div className="px-4 lg:px-6">
                            <h1 className="text-2xl font-bold tracking-tight">
                                Insumos
                            </h1>
                            <p className="text-muted-foreground">
                                Gerencie os insumos utilizados nos seus produtos
                            </p>
                        </div>

                        <DataTable
                            data={ingredients.data}
                            pagination={{
                                current_page: ingredients.current_page,
                                last_page: ingredients.last_page,
                                per_page: ingredients.per_page,
                                from: ingredients.from,
                                to: ingredients.to,
                                total: ingredients.total,
                                next_page_url: ingredients.next_page_url,
                                prev_page_url: ingredients.prev_page_url,
                            }}
                            filters={filters}
                            categories={categories}
                        />
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
