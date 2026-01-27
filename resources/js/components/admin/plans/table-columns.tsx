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
import { Check, Edit, MoreHorizontal, Power, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

export interface Plan {
    id: number;
    code: string;
    name: string;
    description: string | null;
    price: number;
    features: string[] | null;
    stripe_product_id: string | null;
    stripe_price_id: string | null;
    active: boolean;
    created_at: string;
    subscriptions_count?: number;
}

interface ColumnsConfig {
    onEdit: (plan: Plan) => void;
}

export const createColumns = ({ onEdit }: ColumnsConfig): ColumnDef<Plan>[] => [
    {
        accessorKey: 'code',
        header: 'Código',
        cell: ({ row }) => (
            <div className="font-medium">{row.getValue('code')}</div>
        ),
    },
    {
        accessorKey: 'name',
        header: 'Nome',
        cell: ({ row }) => {
            return (
                <div className="flex flex-col">
                    <span className="font-medium">{row.getValue('name')}</span>
                    {row.original.description && (
                        <span className="text-xs text-muted-foreground">
                            {row.original.description}
                        </span>
                    )}
                </div>
            );
        },
    },
    {
        accessorKey: 'price',
        header: 'Preço',
        cell: ({ row }) => {
            const price = parseFloat(row.getValue('price'));
            const formatted = new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL',
            }).format(price);

            return <div className="font-medium">{formatted}</div>;
        },
    },
    {
        accessorKey: 'features',
        header: 'Recursos',
        cell: ({ row }) => {
            const features = row.getValue('features') as string[] | null;
            if (
                !features ||
                !Array.isArray(features) ||
                features.length === 0
            ) {
                return <span className="text-sm text-muted-foreground">—</span>;
            }

            return (
                <div className="flex flex-wrap gap-1">
                    {features.slice(0, 2).map((feature, index) => (
                        <span
                            key={index}
                            className="rounded-md bg-secondary px-2 py-0.5 text-xs"
                        >
                            {feature}
                        </span>
                    ))}
                    {features.length > 2 && (
                        <span className="rounded-md bg-secondary px-2 py-0.5 text-xs">
                            +{features.length - 2}
                        </span>
                    )}
                </div>
            );
        },
    },
    {
        accessorKey: 'subscriptions_count',
        header: 'Assinaturas',
        cell: ({ row }) => {
            const count = row.getValue('subscriptions_count') as
                | number
                | undefined;
            return (
                <div className="text-center">
                    {count !== undefined ? count : '—'}
                </div>
            );
        },
    },
    {
        accessorKey: 'active',
        header: 'Status',
        cell: ({ row }) => {
            const isActive = row.getValue('active') as boolean;
            return (
                <div className="flex items-center gap-1.5">
                    {isActive ? (
                        <>
                            <Check className="h-4 w-4 text-green-500" />
                            <span className="text-sm">Ativo</span>
                        </>
                    ) : (
                        <>
                            <X className="h-4 w-4 text-red-500" />
                            <span className="text-sm text-muted-foreground">
                                Inativo
                            </span>
                        </>
                    )}
                </div>
            );
        },
    },
    {
        accessorKey: 'stripe_product_id',
        header: 'Stripe',
        cell: ({ row }) => {
            const productId = row.getValue('stripe_product_id') as
                | string
                | null;
            const priceId = row.original.stripe_price_id;

            if (!productId) {
                return (
                    <span className="text-sm text-muted-foreground">
                        Não sincronizado
                    </span>
                );
            }

            return (
                <div className="flex flex-col text-xs text-muted-foreground">
                    <span title={productId}>
                        {productId.substring(0, 15)}...
                    </span>
                    {priceId && (
                        <span title={priceId}>
                            {priceId.substring(0, 15)}...
                        </span>
                    )}
                </div>
            );
        },
    },
    {
        id: 'actions',
        cell: ({ row }) => {
            const plan = row.original;
            const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
            const [isToggleDialogOpen, setIsToggleDialogOpen] = useState(false);

            const handleToggleActive = () => {
                router.patch(
                    `/admin/plans/${plan.id}`,
                    { active: !plan.active },
                    {
                        preserveScroll: true,
                        onSuccess: () => {
                            toast.success(
                                plan.active
                                    ? 'Plano desativado com sucesso!'
                                    : 'Plano ativado com sucesso!',
                            );
                        },
                        onError: (errors) => {
                            if (errors.error) {
                                toast.error(errors.error as string);
                            } else {
                                toast.error('Erro ao alterar status do plano.');
                            }
                        },
                    },
                );
            };

            const handleDelete = () => {
                router.delete(`/admin/plans/${plan.id}`, {
                    preserveScroll: true,
                    onSuccess: () => {
                        toast.success('Plano excluído com sucesso!');
                    },
                    onError: (errors) => {
                        if (errors.error) {
                            toast.error(errors.error as string);
                        } else {
                            toast.error('Erro ao excluir plano.');
                        }
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
                            <DropdownMenuItem onClick={() => onEdit(plan)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Editar
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                onClick={() => setIsToggleDialogOpen(true)}
                            >
                                <Power className="mr-2 h-4 w-4" />
                                {plan.active ? 'Desativar' : 'Ativar'}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => setIsDeleteDialogOpen(true)}
                                className="text-red-600"
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Excluir
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Dialog Ativar/Desativar */}
                    <AlertDialog
                        open={isToggleDialogOpen}
                        onOpenChange={setIsToggleDialogOpen}
                    >
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>
                                    Confirmar{' '}
                                    {plan.active ? 'desativação' : 'ativação'}
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                    Tem certeza que deseja{' '}
                                    {plan.active ? 'desativar' : 'ativar'} o
                                    plano <strong>{plan.name}</strong>?{' '}
                                    {plan.active
                                        ? 'Ele não poderá ser selecionado por novos clientes.'
                                        : 'Ele ficará disponível para novos clientes.'}
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={handleToggleActive}>
                                    {plan.active ? 'Desativar' : 'Ativar'}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>

                    {/* Dialog Excluir */}
                    <AlertDialog
                        open={isDeleteDialogOpen}
                        onOpenChange={setIsDeleteDialogOpen}
                    >
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>
                                    Confirmar exclusão
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                    Tem certeza que deseja excluir o plano{' '}
                                    <strong>{plan.name}</strong>? Esta ação não
                                    pode ser desfeita. O produto será arquivado
                                    no Stripe.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={handleDelete}
                                    className="bg-red-600 hover:bg-red-700"
                                >
                                    Excluir
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </>
            );
        },
    },
];
