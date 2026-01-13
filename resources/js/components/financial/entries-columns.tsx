import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ColumnDef } from '@tanstack/react-table';
import {
    AlertTriangle,
    ArrowUpDown,
    MoreHorizontal,
    Pencil,
    Repeat,
    Trash2,
} from 'lucide-react';

export type FinanceEntry = {
    id: number;
    occurred_on: string;
    amount: string;
    reference: string | null;
    supplier: string | null;
    description: string | null;
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
    consider_business_days: boolean;
    payment_method: string | null;
    financial_account: string | null;
    competence_date: string | null;
    status: 'pending' | 'paid';
    paid_at: string | null;
    is_recurring: boolean;
    parent_entry_id: number | null;
    installment_number: number | null;
    category: {
        id: number;
        name: string;
        type: 'expense' | 'income';
        parent_id: number | null;
    };
    parent?: {
        id: number;
        recurrence_type: string;
    } | null;
};

const recurrenceLabels: Record<string, string> = {
    single: 'Única',
    weekly: 'Semanal',
    biweekly: 'Quinzenal',
    monthly: 'Mensal',
    bimonthly: 'Bimestral',
    quarterly: 'Trimestral',
    semiannual: 'Semestral',
    annual: 'Anual',
};

interface ColumnsProps {
    onEdit: (entry: FinanceEntry) => void;
    onDelete: (entry: FinanceEntry) => void;
}

export const createColumns = ({
    onEdit,
    onDelete,
}: ColumnsProps): ColumnDef<FinanceEntry>[] => [
    {
        accessorKey: 'occurred_on',
        header: ({ column }) => {
            return (
                <Button
                    variant="ghost"
                    onClick={() =>
                        column.toggleSorting(column.getIsSorted() === 'asc')
                    }
                >
                    Data
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            );
        },
        cell: ({ row }) => {
            const date = new Date(row.getValue('occurred_on'));
            return date.toLocaleDateString('pt-BR');
        },
    },
    {
        accessorKey: 'description',
        header: 'Descrição',
        cell: ({ row }) => {
            const description = row.getValue('description') as string | null;
            return (
                description || <span className="text-muted-foreground">—</span>
            );
        },
    },
    {
        accessorKey: 'category',
        header: 'Categoria',
        cell: ({ row }) => {
            const category = row.original.category;
            const isRecurring = row.original.parent_entry_id !== null;
            const installmentNumber = row.original.installment_number;
            const isTemplateWithError =
                row.original.is_recurring &&
                row.original.parent_entry_id === null;

            return (
                <div className="flex items-center gap-2">
                    <Badge
                        variant={
                            category.type === 'expense'
                                ? 'destructive'
                                : 'default'
                        }
                    >
                        {category.type === 'expense' ? 'Despesa' : 'Receita'}
                    </Badge>
                    <span>{category.name}</span>
                    {isRecurring && installmentNumber && (
                        <Badge variant="outline" className="gap-1 text-xs">
                            <Repeat className="h-3 w-3" />
                            {installmentNumber}
                        </Badge>
                    )}
                    {isTemplateWithError && (
                        <Badge
                            variant="destructive"
                            className="gap-1 text-xs"
                            title="Template com erro - Edite para corrigir a data limite"
                        >
                            <AlertTriangle className="h-3 w-3" />
                            Erro
                        </Badge>
                    )}
                </div>
            );
        },
    },
    {
        accessorKey: 'supplier',
        header: 'Fornecedor',
        cell: ({ row }) => {
            const supplier = row.getValue('supplier') as string | null;
            return supplier || <span className="text-muted-foreground">—</span>;
        },
    },
    {
        accessorKey: 'amount',
        header: ({ column }) => {
            return (
                <Button
                    variant="ghost"
                    onClick={() =>
                        column.toggleSorting(column.getIsSorted() === 'asc')
                    }
                >
                    Valor
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            );
        },
        cell: ({ row }) => {
            const amount = parseFloat(row.getValue('amount'));
            const category = row.original.category;
            const formatted = new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL',
            }).format(amount);

            return (
                <div
                    className={`font-medium ${category.type === 'expense' ? 'text-red-600' : 'text-green-600'}`}
                >
                    {category.type === 'expense' ? '-' : '+'} {formatted}
                </div>
            );
        },
    },
    {
        accessorKey: 'due_date',
        header: 'Vencimento',
        cell: ({ row }) => {
            const dueDate = row.getValue('due_date') as string | null;
            if (!dueDate) {
                return <span className="text-muted-foreground">—</span>;
            }
            const date = new Date(dueDate);
            return date.toLocaleDateString('pt-BR');
        },
    },
    {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => {
            const status = row.getValue('status') as string;
            return (
                <Badge variant={status === 'paid' ? 'default' : 'secondary'}>
                    {status === 'paid' ? 'Pago' : 'Pendente'}
                </Badge>
            );
        },
    },
    {
        accessorKey: 'recurrence_type',
        header: 'Recorrência',
        cell: ({ row }) => {
            const type = row.getValue('recurrence_type') as string;
            return (
                <Badge variant="outline">
                    {recurrenceLabels[type] || type}
                </Badge>
            );
        },
    },
    {
        accessorKey: 'reference',
        header: 'Referência',
        cell: ({ row }) => {
            const reference = row.getValue('reference') as string | null;
            return (
                reference || <span className="text-muted-foreground">—</span>
            );
        },
    },
    {
        accessorKey: 'notes',
        header: 'Histórico',
        cell: ({ row }) => {
            const notes = row.getValue('notes') as string | null;
            return notes ? (
                <span className="text-sm">{notes}</span>
            ) : (
                <span className="text-muted-foreground">—</span>
            );
        },
    },
    {
        id: 'actions',
        enableHiding: false,
        cell: ({ row }) => {
            const entry = row.original;

            return (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Abrir menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Ações</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => onEdit(entry)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => onDelete(entry)}
                            className="text-destructive focus:text-destructive"
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Excluir
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            );
        },
    },
];
