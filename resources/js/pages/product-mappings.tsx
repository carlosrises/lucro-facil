import { createColumns } from '@/components/product-mappings/columns';
import { DataTable } from '@/components/product-mappings/data-table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';

interface InternalProduct {
    id: number;
    name: string;
    unit_cost: number;
}

interface ExternalItem {
    sku: string;
    name: string;
    unit_price: number;
    mapped: boolean;
    mapping: {
        id: number;
        internal_product_id: number;
        internal_product_name: string;
        internal_product_cost: number;
    } | null;
}

interface ProductMappingsProps {
    externalItems: ExternalItem[];
    internalProducts: InternalProduct[];
    filters: {
        search: string;
        mapping_status: string;
    };
}

export default function ProductMappings({
    externalItems,
    internalProducts,
    filters,
}: ProductMappingsProps) {
    const columns = createColumns({ internalProducts });

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Produtos', href: '/products' },
        { title: 'Mapeamentos', href: '/product-mappings' },
    ];

    return (
        <>
            <Head title="Mapeamento de Produtos" />
            <AppLayout breadcrumbs={breadcrumbs}>
                <div className="flex flex-1 flex-col">
                    <div className="@container/main flex flex-1 flex-col gap-2">
                        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                            <div className="flex flex-col gap-1 px-4 lg:px-6">
                                <h1 className="text-2xl font-bold">
                                    Mapeamento de Produtos
                                </h1>
                                <p className="text-muted-foreground">
                                    Associe produtos dos marketplaces com seus
                                    produtos internos para cálculo de custos
                                </p>
                            </div>

                            <DataTable
                                columns={columns}
                                data={externalItems}
                                filters={filters}
                            />
                        </div>
                    </div>
                </div>
            </AppLayout>
        </>
    );
}
