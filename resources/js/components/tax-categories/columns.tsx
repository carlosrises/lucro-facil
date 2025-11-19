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
import { router } from '@inertiajs/react';
import { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { TaxCategoryFormDialog } from './tax-category-form-dialog';

export interface TaxCategory {
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

const calculationTypeLabels = {
    detailed: '📊 Detalhado',
    fixed: '💰 Fixo',
    none: '🚫 Isento',
};

const icmsOriginLabels: Record<string, string> = {
    '0': 'Nacional',
    '1': 'Estrangeira (importação direta)',
    '2': 'Estrangeira (mercado interno)',
    '3': 'Nacional c/ 40-70% importado',
    '4': 'Nacional c/ produção em conformidade',
    '5': 'Nacional c/ <40% importado',
    '6': 'Estrangeira (importação direta sem similar)',
    '7': 'Estrangeira (mercado interno sem similar)',
    '8': 'Nacional c/ >70% importado',
};

function ActionsCell({ category }: { category: TaxCategory }) {
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    const handleDelete = () => {
        setIsDeleteDialogOpen(true);
    };

    const confirmDelete = () => {
        router.delete(`/tax-categories/${category.id}`, {
            preserveScroll: true,
            onSuccess: () => {
                toast.success('Categoria fiscal excluída com sucesso!');
                setIsDeleteDialogOpen(false);
            },
            onError: () => {
                toast.error('Erro ao excluir categoria fiscal');
            },
        });
    };

    return (
        <>
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
                    <DropdownMenuItem onClick={() => setIsEditDialogOpen(true)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        onClick={handleDelete}
                        className="text-destructive"
                    >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Excluir
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <TaxCategoryFormDialog
                open={isEditDialogOpen}
                onOpenChange={setIsEditDialogOpen}
                category={category}
            />

            <AlertDialog
                open={isDeleteDialogOpen}
                onOpenChange={setIsDeleteDialogOpen}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja excluir a categoria fiscal{' '}
                            <span className="font-semibold">
                                "{category.name}"
                            </span>
                            ? Esta ação não pode ser desfeita.
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
        </>
    );
}

export const columns: ColumnDef<TaxCategory>[] = [
    {
        accessorKey: 'name',
        header: 'Nome',
        enableHiding: false,
        cell: ({ row }) => {
            const isActive = row.original.active;
            return (
                <div className="flex items-center gap-2">
                    <span
                        className={
                            !isActive
                                ? 'text-muted-foreground line-through'
                                : ''
                        }
                    >
                        {row.getValue('name')}
                    </span>
                    {!isActive && (
                        <Badge variant="secondary" className="text-xs">
                            Inativo
                        </Badge>
                    )}
                </div>
            );
        },
    },
    {
        accessorKey: 'sale_cfop',
        header: 'CFOP Venda',
        cell: ({ row }) => (
            <span className="font-mono">{row.getValue('sale_cfop')}</span>
        ),
    },
    {
        accessorKey: 'csosn_cst',
        header: 'CSOSN/CST',
        cell: ({ row }) => (
            <span className="font-mono">{row.getValue('csosn_cst')}</span>
        ),
    },
    {
        accessorKey: 'ncm',
        header: 'NCM',
        cell: ({ row }) => {
            const ncm = row.getValue('ncm') as string | null;
            return ncm ? (
                <span className="font-mono">{ncm}</span>
            ) : (
                <span className="text-muted-foreground">—</span>
            );
        },
    },
    {
        accessorKey: 'icms_origin',
        header: 'Origem ICMS',
        cell: ({ row }) => {
            const origin = row.getValue('icms_origin') as string;
            return (
                <span className="text-xs" title={icmsOriginLabels[origin]}>
                    {origin} - {icmsOriginLabels[origin]?.substring(0, 20)}
                    {icmsOriginLabels[origin]?.length > 20 ? '...' : ''}
                </span>
            );
        },
    },
    {
        accessorKey: 'tax_calculation_type',
        header: 'Tipo de Cálculo',
        cell: ({ row }) => {
            const type = row.getValue(
                'tax_calculation_type',
            ) as keyof typeof calculationTypeLabels;
            return <span>{calculationTypeLabels[type]}</span>;
        },
    },
    {
        accessorKey: 'total_tax_rate',
        header: 'Total de Impostos',
        cell: ({ row }) => {
            const type = row.original.tax_calculation_type;
            const total = row.getValue('total_tax_rate') as
                | number
                | null
                | undefined;

            if (type === 'none') {
                return <span className="text-muted-foreground">Isento</span>;
            }

            if (total === null || total === undefined) {
                return <span className="text-muted-foreground">—</span>;
            }

            return <span className="font-semibold">{total.toFixed(2)}%</span>;
        },
    },
    {
        id: 'actions',
        header: 'Ações',
        enableHiding: false,
        cell: ({ row }) => <ActionsCell category={row.original} />,
    },
];
