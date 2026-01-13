import { DataTable } from '@/components/products/data-table';
import { ProductAssociateDialog } from '@/components/products/product-associate-dialog';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, usePage } from '@inertiajs/react';
import React from 'react';

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

interface ProductMapping {
    id: number;
    external_item_id: string;
    external_item_name: string;
    provider: string;
}

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
            mappings?: ProductMapping[];
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
    marginSettings: {
        margin_excellent: number;
        margin_good_min: number;
        margin_good_max: number;
        margin_poor: number;
    };
    filters: {
        search: string;
        type: string;
        active: string;
        per_page: number;
    };
    externalItems?: Array<{
        sku: string;
        name: string;
        unit_price: number;
        mapped: boolean;
    }>;
    [key: string]: unknown;
}

export default function Products() {
    const { products, filters, marginSettings, externalItems } =
        usePage<ProductsProps>().props;

    // Garante valores padrão para marginSettings
    const safeMarginSettings = React.useMemo(
        () => ({
            margin_excellent: marginSettings?.margin_excellent ?? 100.0,
            margin_good_min: marginSettings?.margin_good_min ?? 30.0,
            margin_good_max: marginSettings?.margin_good_max ?? 99.99,
            margin_poor: marginSettings?.margin_poor ?? 0.0,
        }),
        [marginSettings],
    );

    const [associateDialogOpen, setAssociateDialogOpen] = React.useState(false);
    const [selectedProductId, setSelectedProductId] = React.useState<
        number | null
    >(null);

    // Buscar o produto atualizado da lista sempre que os dados mudarem
    const selectedProduct = React.useMemo(() => {
        if (!selectedProductId) return null;
        const product = products.data.find((p) => p.id === selectedProductId);
        return product
            ? { id: product.id, name: product.name, mappings: product.mappings }
            : null;
    }, [selectedProductId, products.data]);

    const handleAssociate = (product: { id: number; name: string }) => {
        setSelectedProductId(product.id);
        setAssociateDialogOpen(true);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Produtos" />

            <div className="flex flex-1 flex-col">
                <div className="@container/main flex flex-1 flex-col gap-2">
                    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                        <div className="px-4 lg:px-6">
                            <h1 className="text-2xl font-bold tracking-tight">
                                Produtos
                            </h1>
                            <p className="text-muted-foreground">
                                Gerencie seus produtos e suas composições
                            </p>
                        </div>

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
                            marginSettings={safeMarginSettings}
                            onAssociate={handleAssociate}
                        />
                    </div>
                </div>
            </div>

            <ProductAssociateDialog
                open={associateDialogOpen}
                onOpenChange={setAssociateDialogOpen}
                product={selectedProduct}
                externalItems={externalItems || []}
            />
        </AppLayout>
    );
}
