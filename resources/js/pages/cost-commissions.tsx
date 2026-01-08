import AppLayout from '@/layouts/app-layout';
import { Head, router, usePage } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

import { CostCommission } from '@/components/cost-commissions/columns';
import { DataTable } from '@/components/cost-commissions/data-table';
import { CostCommissionFormDialog } from '@/components/cost-commissions/form-drawer';
import { RecalculateProgress } from '@/components/cost-commissions/recalculate-progress';
import { startRecalculateMonitoring } from '@/components/global-recalculate-progress';
import {
    AlertDialog,
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
    const { data, pagination, filters, integratedProviders, flash } =
        usePage<CostCommissionsPageProps>().props;

    // Pegar recalculate_cache_key do flash message
    const recalculateCacheKey = (flash as any)?.recalculate_cache_key;

    const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
    const [selectedItem, setSelectedItem] =
        React.useState<CostCommission | null>(null);
    const [itemToDelete, setItemToDelete] =
        React.useState<CostCommission | null>(null);
    const [currentCacheKey, setCurrentCacheKey] = React.useState<string | null>(
        recalculateCacheKey || null,
    );

    // Atualizar cache key quando receber novo do backend
    React.useEffect(() => {
        if (recalculateCacheKey) {
            setCurrentCacheKey(recalculateCacheKey);
            // Iniciar monitoramento global
            startRecalculateMonitoring(recalculateCacheKey);
        }
    }, [recalculateCacheKey]);

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

    const confirmDelete = (recalculate: boolean) => {
        if (itemToDelete) {
            router.delete(`/cost-commissions/${itemToDelete.id}`, {
                data: { recalculate },
                onSuccess: (page) => {
                    setIsDeleteDialogOpen(false);
                    setItemToDelete(null);
                    toast.success(
                        recalculate
                            ? 'Custo/Comissão excluído! Recalculando pedidos...'
                            : 'Custo/Comissão excluído com sucesso!',
                    );

                    // Verificar se há recalculate_cache_key no flash message
                    const recalculateCacheKey =
                        page.props?.flash?.recalculate_cache_key;
                    if (recalculateCacheKey && recalculate) {
                        console.log(
                            'Starting recalculate monitoring after delete with key:',
                            recalculateCacheKey,
                        );
                        startRecalculateMonitoring(recalculateCacheKey);
                        setCurrentCacheKey(recalculateCacheKey);
                    }
                },
                onError: () => {
                    toast.error('Erro ao excluir custo/comissão');
                },
            });
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Custos & Comissões" />

            {/* Componente de progresso do recálculo */}
            <RecalculateProgress
                cacheKey={currentCacheKey}
                onComplete={() => setCurrentCacheKey(null)}
            />

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
                        <AlertDialogTitle>
                            Excluir "{itemToDelete?.name}"
                        </AlertDialogTitle>
                        <AlertDialogDescription className="space-y-3">
                            <p>
                                Esta ação não pode ser desfeita. O
                                custo/comissão será permanentemente excluído.
                            </p>
                            <p className="font-medium text-foreground">
                                O que deseja fazer com os pedidos existentes?
                            </p>
                            <ul className="space-y-2 text-sm">
                                <li>
                                    • <strong>Manter valores:</strong> Pedidos
                                    existentes continuarão com os valores
                                    calculados anteriormente
                                </li>
                                <li>
                                    • <strong>Recalcular:</strong> Remove esta
                                    taxa de todos os pedidos existentes
                                </li>
                            </ul>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2 sm:gap-0">
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <Button
                            variant="outline"
                            onClick={() => confirmDelete(false)}
                        >
                            Excluir e Manter Valores
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => confirmDelete(true)}
                        >
                            Excluir e Recalcular
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </AppLayout>
    );
}
