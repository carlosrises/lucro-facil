import { DataTable } from '@/components/products/data-table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, usePage } from '@inertiajs/react';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Cadastros',
        href: '#',
    },
    {
        title: 'Produtos',
        href: '/products',
    },
];

interface ProductsProps {
    products: {
        data: Array<{
            id: number;
            name: string;
            sku: string | null;
            type: string;
            unit: string;
            unit_cost: string;
            sale_price: string;
            category: string | null;
            active: boolean;
            costs_count: number;
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
        type: string;
        active: string;
        per_page: number;
    };
    [key: string]: unknown;
}

export default function Products() {
    const { products, filters } = usePage<ProductsProps>().props;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Produtos" />

            <div className="flex flex-1 flex-col">
                <div className="@container/main flex flex-1 flex-col gap-2">
                    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                        <DataTable
                            data={products.data}
                            pagination={{
                                current_page: products.current_page,
                                last_page: products.last_page,
                                per_page: products.per_page,
                                from: products.from,
                                to: products.to,
                                total: products.total,
                                next_page_url: products.next_page_url,
                                prev_page_url: products.prev_page_url,
                            }}
                            filters={filters}
                        />
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
