import { User } from '@/components/users/columns';
import { DataTable } from '@/components/users/data-table';
import { UserManageDialog } from '@/components/users/user-manage-dialog';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { toast } from 'sonner';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Usuários',
        href: '/users',
    },
];

interface Role {
    id: number;
    name: string;
}

interface UsersPageProps {
    users: {
        data: User[];
        current_page: number;
        last_page: number;
        per_page: number;
        from: number;
        to: number;
        total: number;
        next_page_url?: string | null;
        prev_page_url?: string | null;
    };
    filters: {
        search: string;
        role: string;
        status: string;
        show_deleted: string;
    };
    roles: Role[];
    [key: string]: unknown;
}

export default function UsersPage() {
    const { users, filters, roles } = usePage<UsersPageProps>().props;

    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);

    const handleCreateUser = () => {
        setSelectedUser(null);
        setDialogOpen(true);
    };

    const handleEditUser = (user: User) => {
        setSelectedUser(user);
        setDialogOpen(true);
    };

    const handleDeleteUser = (user: User) => {
        if (
            confirm(`Tem certeza que deseja excluir o usuário "${user.name}"?`)
        ) {
            router.delete(`/users/${user.id}`, {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success('Usuário excluído com sucesso!');
                },
                onError: () => {
                    toast.error('Erro ao excluir usuário.');
                },
            });
        }
    };

    const handleRestoreUser = (user: User) => {
        if (
            confirm(
                `Tem certeza que deseja restaurar o usuário "${user.name}"?`,
            )
        ) {
            router.post(
                `/users/${user.id}/restore`,
                {},
                {
                    preserveScroll: true,
                    onSuccess: () => {
                        toast.success('Usuário restaurado com sucesso!');
                    },
                    onError: () => {
                        toast.error('Erro ao restaurar usuário.');
                    },
                },
            );
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Usuários" />

            <div className="flex flex-1 flex-col">
                <div className="@container/main flex flex-1 flex-col gap-2">
                    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                        <DataTable
                            data={users.data}
                            pagination={{
                                current_page: users.current_page,
                                last_page: users.last_page,
                                per_page: users.per_page,
                                from: users.from,
                                to: users.to,
                                total: users.total,
                                next_page_url: users.next_page_url,
                                prev_page_url: users.prev_page_url,
                            }}
                            filters={filters}
                            roles={roles}
                            onCreateUser={handleCreateUser}
                            onEditUser={handleEditUser}
                            onDeleteUser={handleDeleteUser}
                            onRestoreUser={handleRestoreUser}
                        />
                    </div>
                </div>
            </div>

            <UserManageDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                user={selectedUser}
                roles={roles}
            />
        </AppLayout>
    );
}
