import AppLayout from '@/layouts/app-layout';
import { Head, router, usePage } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import * as React from 'react';

import { CostCommission } from '@/components/cost-commissions/columns';
import { DataTable } from '@/components/cost-commissions/data-table';
import { CostCommissionFormDialog } from '@/components/cost-commissions/form-drawer';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { type BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Custos & Comissões',
        href: '/cost-commissions',
    },
];

type CostCommissionsPageProps = {
    data: CostCommission[];
    pagination: {
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
    filters: {
        search?: string;
        type?: string;
        provider?: string;
        active?: string;
    };
    providers: Array<{ value: string; label: string }>;
    integratedProviders: string[];
    paymentMethods: {
        [key: string]: Array<{ value: string; label: string }>;
    };
};

export default function CostCommissions() {
    const { data, pagination, filters, integratedProviders } =
        usePage<CostCommissionsPageProps>().props;

    const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
    const [selectedItem, setSelectedItem] =
        React.useState<CostCommission | null>(null);
    const [itemToDelete, setItemToDelete] =
        React.useState<CostCommission | null>(null);

    const handleNew = () => {
        setSelectedItem(null);
        setIsDrawerOpen(true);
    };

    const handleEdit = (item: CostCommission) => {
        setSelectedItem(item);
        setIsDrawerOpen(true);
    };

    const handleDelete = (item: CostCommission) => {
        setItemToDelete(item);
        setIsDeleteDialogOpen(true);
    };

    const handleToggle = (item: CostCommission) => {
        router.patch(
            `/cost-commissions/${item.id}/toggle`,
            {},
            {
                preserveScroll: true,
            },
        );
    };

    const confirmDelete = () => {
        if (itemToDelete) {
            router.delete(`/cost-commissions/${itemToDelete.id}`, {
                onSuccess: () => {
                    setIsDeleteDialogOpen(false);
                    setItemToDelete(null);
                },
            });
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Custos & Comissões" />

            <div className="flex flex-1 flex-col">
                <div className="@container/main flex flex-1 flex-col gap-2">
                    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 lg:px-6">
                            <div>
                                <h1 className="text-2xl font-semibold tracking-tight">
                                    Custos & Comissões
                                </h1>
                                <p className="text-sm text-muted-foreground">
                                    Configure custos fixos e comissões aplicadas
                                    nas vendas
                                </p>
                            </div>
                            <Button onClick={handleNew}>
                                <Plus className="mr-2 h-4 w-4" />
                                Novo Custo/Comissão
                            </Button>
                        </div>

                        {/* DataTable */}
                        <DataTable
                            data={data}
                            pagination={pagination}
                            filters={filters}
                            integratedProviders={integratedProviders}
                            onEdit={handleEdit}
                            onDelete={handleDelete}
                            onToggle={handleToggle}
                        />
                    </div>
                </div>
            </div>

            {/* Form Dialog */}
            <CostCommissionFormDialog
                open={isDrawerOpen}
                onOpenChange={setIsDrawerOpen}
                item={selectedItem}
            />

            {/* Delete Confirmation Dialog */}
            <AlertDialog
                open={isDeleteDialogOpen}
                onOpenChange={setIsDeleteDialogOpen}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta ação não pode ser desfeita. O custo/comissão "
                            {itemToDelete?.name}" será permanentemente excluído.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDelete}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Excluir
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </AppLayout>
    );
}
