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
import { ArrowUpDown, Eye, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';

export interface Client {
    id: number;
    name: string;
    email: string;
    created_at: string;
    created_at_human: string;
    stores_count: number;
    subscription?: {
        id: number;
        plan_name: string;
        status: string;
        started_on?: string;
        ends_on?: string;
        price: number;
    } | null;
    primary_user?: {
        name: string;
        email: string;
    } | null;
    status: string;
}

const handleEdit = (client: Client) => {
    // TODO: Implementar modal de edição
    console.log('Editar cliente:', client);
};

const handleDelete = (client: Client) => {
    if (confirm(`Tem certeza que deseja excluir o cliente "${client.name}"?`)) {
        router.delete(`/admin/clients/${client.id}`, {
            preserveScroll: true,
        });
    }
};

export const columns: ColumnDef<Client>[] = [
    {
        accessorKey: 'name',
        header: ({ column }) => {
            return (
                <Button
                    variant="ghost"
                    onClick={() =>
                        column.toggleSorting(column.getIsSorted() === 'asc')
                    }
                    className="h-8 px-2 lg:px-3"
                >
                    Cliente
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            );
        },
        cell: ({ row }) => {
            const client = row.original;
            return (
                <div className="flex flex-col">
                    <span className="font-medium">{client.name}</span>
                    <span className="text-sm text-muted-foreground">
                        {client.email}
                    </span>
                </div>
            );
        },
    },
    {
        accessorKey: 'primary_user',
        header: 'Usuário Principal',
        cell: ({ row }) => {
            const user = row.original.primary_user;
            return user ? (
                <div className="flex flex-col">
                    <span className="text-sm font-medium">{user.name}</span>
                    <span className="text-xs text-muted-foreground">
                        {user.email}
                    </span>
                </div>
            ) : (
                <span className="text-sm text-muted-foreground">
                    Sem usuário
                </span>
            );
        },
    },
    {
        accessorKey: 'subscription',
        header: 'Plano Atual',
        cell: ({ row }) => {
            const subscription = row.original.subscription;
            return subscription ? (
                <div className="flex flex-col">
                    <span className="text-sm font-medium">
                        {subscription.plan_name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                        R${' '}
                        {subscription.price.toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                        })}
                        /mês
                    </span>
                </div>
            ) : (
                <span className="text-sm text-muted-foreground">Sem plano</span>
            );
        },
    },
    {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => {
            const status = row.original.status;
            return (
                <Badge variant={status === 'active' ? 'default' : 'secondary'}>
                    {status === 'active' ? 'Ativo' : 'Inativo'}
                </Badge>
            );
        },
    },
    {
        accessorKey: 'stores_count',
        header: ({ column }) => {
            return (
                <Button
                    variant="ghost"
                    onClick={() =>
                        column.toggleSorting(column.getIsSorted() === 'asc')
                    }
                    className="h-8 px-2 lg:px-3"
                >
                    Lojas
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            );
        },
        cell: ({ row }) => {
            return (
                <div className="text-center">
                    <Badge variant="outline">{row.original.stores_count}</Badge>
                </div>
            );
        },
    },
    {
        accessorKey: 'created_at',
        header: ({ column }) => {
            return (
                <Button
                    variant="ghost"
                    onClick={() =>
                        column.toggleSorting(column.getIsSorted() === 'asc')
                    }
                    className="h-8 px-2 lg:px-3"
                >
                    Cadastro
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            );
        },
        cell: ({ row }) => {
            const client = row.original;
            return (
                <div className="flex flex-col">
                    <span className="text-sm">{client.created_at}</span>
                    <span className="text-xs text-muted-foreground">
                        {client.created_at_human}
                    </span>
                </div>
            );
        },
    },
    {
        id: 'actions',
        header: 'Ações',
        cell: ({ row }) => {
            const client = row.original;

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
                        <DropdownMenuItem
                            onClick={() =>
                                navigator.clipboard.writeText(client.email)
                            }
                        >
                            Copiar email
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleEdit(client)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => console.log('Ver detalhes:', client)}
                        >
                            <Eye className="mr-2 h-4 w-4" />
                            Ver detalhes
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onClick={() => handleDelete(client)}
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
