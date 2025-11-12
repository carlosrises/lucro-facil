import { DataTable } from '@/components/categories/data-table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';

const breadcrumbs: BreadcrumbItem[] = [
    { label: 'Cadastros IPC', href: '/categories' },
    { label: 'Categorias', href: '/categories' },
];

interface Category {
    id: number;
    name: string;
    type: string;
    color: string;
    active: boolean;
    ingredients_count?: number;
    products_count?: number;
}

interface CategoriesManageProps {
    categories: Category[];
    filters: {
        search?: string;
        type?: string;
        active?: string;
    };
}

export default function CategoriesManage({
    categories,
    filters,
}: CategoriesManageProps) {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Gerenciar Categorias" />

            <div className="flex flex-1 flex-col">
                <div className="@container/main flex flex-1 flex-col gap-2">
                    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                        <div className="flex flex-col gap-2 px-4 lg:px-6">
                            <h1 className="text-3xl font-bold tracking-tight">
                                Categorias
                            </h1>
                            <p className="text-muted-foreground">
                                Gerencie as categorias de insumos e produtos
                            </p>
                        </div>

                        <DataTable data={categories} filters={filters} />
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
