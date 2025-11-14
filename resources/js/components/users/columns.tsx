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
    ArrowUpDown,
    MoreHorizontal,
    Pencil,
    RotateCcw,
    Trash2,
} from 'lucide-react';

export interface User {
    id: number;
    name: string;
    email: string;
    created_at: string;
    created_at_human: string;
    deleted_at: string | null;
    deleted_at_human: string | null;
    is_deleted: boolean;
    roles: string[];
    primary_role: string;
}

interface ColumnsProps {
    onEdit: (user: User) => void;
    onDelete: (user: User) => void;
    onRestore: (user: User) => void;
}

export const createColumns = ({
    onEdit,
    onDelete,
    onRestore,
}: ColumnsProps): ColumnDef<User>[] => [
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
                    Nome
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            );
        },
        cell: ({ row }) => {
            const user = row.original;
            return (
                <div className="flex flex-col">
                    <span
                        className={`font-medium ${user.is_deleted ? 'text-muted-foreground line-through' : ''}`}
                    >
                        {user.name}
                    </span>
                    <span className="text-sm text-muted-foreground">
                        {user.email}
                    </span>
                </div>
            );
        },
    },
    {
        accessorKey: 'primary_role',
        header: 'Função',
        cell: ({ row }) => {
            const role = row.original.primary_role;
            const roleLabels: Record<string, string> = {
                gerente: 'Gerente',
                vendedor: 'Vendedor',
                cozinha: 'Cozinha',
                admin: 'Administrador',
            };
            return (
                <Badge variant="secondary">{roleLabels[role] || role}</Badge>
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
                    Cadastrado em
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            );
        },
        cell: ({ row }) => {
            const user = row.original;
            return (
                <div className="flex flex-col">
                    <span className="text-sm">{user.created_at}</span>
                    <span className="text-xs text-muted-foreground">
                        {user.created_at_human}
                    </span>
                </div>
            );
        },
    },
    {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => {
            const user = row.original;
            if (user.is_deleted) {
                return (
                    <div className="flex flex-col">
                        <Badge variant="destructive">Excluído</Badge>
                        {user.deleted_at_human && (
                            <span className="mt-1 text-xs text-muted-foreground">
                                {user.deleted_at_human}
                            </span>
                        )}
                    </div>
                );
            }
            return <Badge variant="default">Ativo</Badge>;
        },
    },
    {
        id: 'actions',
        cell: ({ row }) => {
            const user = row.original;

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
                        {!user.is_deleted ? (
                            <>
                                <DropdownMenuItem onClick={() => onEdit(user)}>
                                    <Pencil className="mr-2 h-4 w-4" />
                                    Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => onDelete(user)}
                                    className="text-red-600"
                                >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Excluir
                                </DropdownMenuItem>
                            </>
                        ) : (
                            <DropdownMenuItem onClick={() => onRestore(user)}>
                                <RotateCcw className="mr-2 h-4 w-4" />
                                Restaurar
                            </DropdownMenuItem>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            );
        },
    },
];
