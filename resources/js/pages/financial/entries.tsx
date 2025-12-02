import { DataTable } from '@/components/financial/entries-data-table';
import { EntryFormDialog } from '@/components/financial/entry-form-dialog';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, usePage } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import React from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Financeiro',
        href: '#',
    },
    {
        title: 'Movimentações Operacionais',
        href: '/financial/entries',
    },
];

interface FinanceCategory {
    id: number;
    name: string;
    type: 'expense' | 'income';
    parent_id: number | null;
}

interface FinanceEntry {
    id: number;
    occurred_on: string;
    amount: string;
    reference: string | null;
    supplier: string | null;
    notes: string | null;
    due_date: string | null;
    recurrence_type:
        | 'single'
        | 'weekly'
        | 'biweekly'
        | 'monthly'
        | 'bimonthly'
        | 'quarterly'
        | 'semiannual'
        | 'annual';
    recurrence_end_date: string | null;
    payment_method: string | null;
    financial_account: string | null;
    competence_date: string | null;
    status: 'pending' | 'paid';
    paid_at: string | null;
    category: FinanceCategory;
}

interface EntriesProps {
    entries: {
        data: FinanceEntry[];
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
    categories: FinanceCategory[];
    filters: {
        search: string;
        category_id: string;
        type: string;
        status: string;
        month: string;
        per_page: number;
    };
    [key: string]: unknown;
}

export default function Entries() {
    const { entries, categories, filters } = usePage<EntriesProps>().props;

    const [formDialogOpen, setFormDialogOpen] = React.useState(false);
    const [entryType, setEntryType] = React.useState<'expense' | 'income'>(
        'expense',
    );
    const [selectedEntry, setSelectedEntry] =
        React.useState<FinanceEntry | null>(null);

    const handleEdit = (entry: FinanceEntry) => {
        setSelectedEntry(entry);
        setEntryType(entry.category.type);
        setFormDialogOpen(true);
    };

    const handleOpenDialog = (type: 'expense' | 'income') => {
        setEntryType(type);
        setSelectedEntry(null);
        setFormDialogOpen(true);
    };

    const handleCloseDialog = () => {
        setFormDialogOpen(false);
        setSelectedEntry(null);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Movimentações Operacionais" />
            <div className="flex flex-1 flex-col">
                <div className="@container/main flex flex-1 flex-col gap-2">
                    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                        <div className="flex w-full flex-col gap-4 px-4 lg:px-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h1 className="text-2xl font-bold tracking-tight">
                                        Movimentações Operacionais
                                    </h1>
                                    <p className="text-sm text-muted-foreground">
                                        Gerencie suas despesas e receitas
                                        operacionais
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        className="border-green-600 text-green-600 hover:bg-green-50"
                                        onClick={() =>
                                            handleOpenDialog('income')
                                        }
                                    >
                                        <Plus className="mr-2 h-4 w-4" />
                                        Nova Receita
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="border-red-600 text-red-600 hover:bg-red-50"
                                        onClick={() =>
                                            handleOpenDialog('expense')
                                        }
                                    >
                                        <Plus className="mr-2 h-4 w-4" />
                                        Nova Despesa
                                    </Button>
                                </div>
                            </div>

                            <DataTable
                                data={entries.data}
                                pagination={{
                                    current_page: entries.current_page,
                                    last_page: entries.last_page,
                                    per_page: entries.per_page,
                                    from: entries.from,
                                    to: entries.to,
                                    total: entries.total,
                                }}
                                filters={filters}
                                categories={categories}
                                onEdit={handleEdit}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <EntryFormDialog
                open={formDialogOpen}
                onOpenChange={handleCloseDialog}
                entry={selectedEntry}
                entryType={entryType}
                categories={categories}
            />
        </AppLayout>
    );
}
