import { columns } from '@/components/tax-categories/columns';
import { DataTable } from '@/components/tax-categories/data-table';
import { TaxCategoryFormDialog } from '@/components/tax-categories/tax-category-form-dialog';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import { Head } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import { useState } from 'react';

interface TaxCategory {
    id: number;
    name: string;
    sale_cfop: string;
    description: string | null;
    icms_origin: string;
    csosn_cst: string;
    ncm: string | null;
    tax_calculation_type: 'detailed' | 'fixed' | 'none';
    iss_rate: number | null;
    icms_rate: number | null;
    pis_rate: number | null;
    cofins_rate: number | null;
    pis_cofins_mode: 'normal' | 'monofasico' | 'isento' | null;
    icms_st: boolean;
    fixed_tax_rate: number | null;
    active: boolean;
    created_at: string;
    updated_at: string;
    total_tax_rate: number;
}

interface PaginatedTaxCategories {
    data: TaxCategory[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
}

interface Filters {
    search: string;
    active: string;
    tax_calculation_type: string;
    per_page: number;
}

interface Props {
    taxCategories: PaginatedTaxCategories;
    filters: Filters;
}

export default function TaxCategories({ taxCategories, filters }: Props) {
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

    return (
        <AppLayout>
            <Head title="Categorias Fiscais" />

            <div className="flex flex-1 flex-col">
                <div className="@container/main flex flex-1 flex-col gap-2">
                    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                        <div className="flex items-center justify-between px-4 lg:px-6">
                            <div>
                                <h1 className="text-2xl font-bold tracking-tight">
                                    Categorias Fiscais
                                </h1>
                                <p className="text-muted-foreground">
                                    Gerencie as categorias fiscais para
                                    aplicação de impostos nos produtos
                                </p>
                            </div>
                            <Button onClick={() => setIsCreateDialogOpen(true)}>
                                <Plus className="mr-2 h-4 w-4" />
                                Nova Categoria
                            </Button>
                        </div>

                        <div className="flex w-full flex-col gap-4 space-x-4 px-4 lg:px-6">
                            <DataTable
                                data={taxCategories.data}
                                columns={columns}
                                pagination={{
                                    current_page: taxCategories.current_page,
                                    last_page: taxCategories.last_page,
                                    per_page: taxCategories.per_page,
                                    total: taxCategories.total,
                                }}
                                filters={filters}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <TaxCategoryFormDialog
                open={isCreateDialogOpen}
                onOpenChange={setIsCreateDialogOpen}
            />
        </AppLayout>
    );
}
