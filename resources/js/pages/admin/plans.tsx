import { Plan } from '@/components/admin/plans/columns';
import { DataTable } from '@/components/admin/plans/data-table';
import { PlanFormDialog } from '@/components/admin/plans/plan-form-dialog';
import AppLayout from '@/layouts/app-layout';
import admin from '@/routes/admin';
import { type BreadcrumbItem } from '@/types';
import { Head, usePage } from '@inertiajs/react';
import { useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Administração',
        href: admin.dashboard().url,
    },
    {
        title: 'Planos',
        href: admin.plans.index().url,
    },
];

interface AdminPlansProps {
    plans: {
        data: Array<{
            id: number;
            code: string;
            name: string;
            description: string | null;
            price?: number | null;
            prices?: Array<{
                id?: number;
                key: string;
                label: string;
                amount: number | null;
                interval?: string | null;
                period_label?: string | null;
                is_annual?: boolean | null;
                stripe_price_id?: string | null;
                active?: boolean | null;
            }>;
            features: string[] | null;
            stripe_product_id: string | null;
            stripe_price_id: string | null;
            active: boolean;
            is_visible?: boolean;
            is_contact_plan?: boolean;
            contact_url?: string | null;
            created_at: string;
            subscriptions_count?: number;
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
        active: string;
    };
    [key: string]: unknown;
}

export default function AdminPlans() {
    const { plans, filters } = usePage<AdminPlansProps>().props;

    const [formDialogOpen, setFormDialogOpen] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);

    const handleCreatePlan = () => {
        setSelectedPlan(null);
        setFormDialogOpen(true);
    };

    const handleEditPlan = (plan: Plan) => {
        setSelectedPlan(plan);
        setFormDialogOpen(true);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Planos de Assinatura" />

            <div className="flex flex-1 flex-col">
                <div className="@container/main flex flex-1 flex-col gap-2">
                    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                        <div className="flex w-full flex-col gap-4 space-x-4 px-4 lg:px-6">
                            <DataTable
                                data={plans.data}
                                pagination={{
                                    currentPage: plans.current_page,
                                    lastPage: plans.last_page,
                                    perPage: plans.per_page,
                                    from: plans.from,
                                    to: plans.to,
                                    total: plans.total,
                                }}
                                filters={filters}
                                onCreatePlan={handleCreatePlan}
                                onEditPlan={handleEditPlan}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <PlanFormDialog
                open={formDialogOpen}
                onOpenChange={setFormDialogOpen}
                plan={selectedPlan}
            />
        </AppLayout>
    );
}
