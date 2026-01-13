import { DataTable } from '@/components/categories/data-table';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Cadastros', href: '#' },
    { title: 'Insumos', href: '/ingredients' },
    { title: 'Categorias', href: '/categories' },
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
    categories: {
        data: Category[];
        current_page: number;
        last_page: number;
        per_page: number;
        from: number;
        to: number;
        total: number;
    };
    filters: {
        search?: string;
        active?: string;
        page?: number;
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
                        <div className="flex flex-col gap-4 px-4 lg:px-6">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => router.get('/ingredients')}
                                className="w-fit"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                <span className="ml-2">
                                    Voltar para Insumos
                                </span>
                            </Button>
                            <div>
                                <h1 className="text-2xl font-bold tracking-tight">
                                    Categorias de Insumos
                                </h1>
                                <p className="text-muted-foreground">
                                    Gerencie as categorias dos seus insumos
                                </p>
                            </div>
                        </div>

                        <DataTable
                            data={categories.data}
                            pagination={{
                                current_page: categories.current_page,
                                last_page: categories.last_page,
                                per_page: categories.per_page,
                                from: categories.from,
                                to: categories.to,
                                total: categories.total,
                            }}
                            filters={filters}
                        />
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
