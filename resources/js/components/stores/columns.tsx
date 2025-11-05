import { Badge } from '@/components/ui/badge';
import { ColumnDef } from '@tanstack/react-table';
import { AlertTriangle } from 'lucide-react';
import { ProviderBadge } from '../provider-badge';
import { ActionsCell } from './actions-cell';

export type Store = {
    id: number;
    provider: string;
    external_store_id: string;
    display_name: string;
    active: boolean;
    created_at: string;
    updated_at: string;
};

export const columns: ColumnDef<Store>[] = [
    {
        accessorKey: 'id',
        header: '#',
        enableSorting: true,
        cell: ({ getValue }) => (
            <span className="text-muted-foreground">{getValue<number>()}</span>
        ),
    },
    {
        accessorKey: 'display_name',
        header: 'Nome da Loja',
        enableSorting: true,
        cell: ({ getValue }) => (
            <span className="font-medium">{getValue<string>()}</span>
        ),
    },
    {
        accessorKey: 'provider',
        header: 'Canal',
        cell: ({ row }) => <ProviderBadge provider={row.original.provider} />,
    },
    {
        accessorKey: 'external_store_id',
        header: 'ID Externo',
        enableSorting: false,
        cell: ({ getValue }) => (
            <span className="font-mono text-xs text-muted-foreground">
                {getValue<string>()?.slice(0, 8)}...
            </span>
        ),
    },
    {
        accessorKey: 'active',
        header: 'Status',
        enableSorting: true,
        cell: ({ row, getValue }) => {
            const isActive = Boolean(getValue());
            const isIfood = row.original.provider === 'ifood';
            return (
                <div className="flex items-center gap-2">
                    <Badge
                        className={
                            isActive
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                        }
                    >
                        {isActive ? 'Ativa' : 'Inativa'}
                    </Badge>
                    {!isActive && isIfood && (
                        <AlertTriangle className="text-red-500" size={16} />
                    )}
                </div>
            );
        },
    },
    {
        accessorKey: 'created_at',
        header: 'Criada em',
        enableSorting: true,
        cell: ({ getValue }) => {
            const date = getValue<string>();
            if (!date) return '—';
            const formatted = new Date(date).toLocaleString('pt-BR', {
                dateStyle: 'short',
                timeStyle: 'short',
            });
            return <span className="text-muted-foreground">{formatted}</span>;
        },
    },
    {
        accessorKey: 'updated_at',
        header: 'Atualizada em',
        enableSorting: true,
        cell: ({ getValue }) => {
            const date = getValue<string>();
            if (!date) return '—';
            const formatted = new Date(date).toLocaleString('pt-BR', {
                dateStyle: 'short',
                timeStyle: 'short',
            });
            return <span className="text-muted-foreground">{formatted}</span>;
        },
    },
    {
        id: 'actions',
        header: 'Ações',
        cell: ({ row }) => {
            const store = row.original;
            const isIfood = store.provider === 'ifood';

            if (!isIfood) {
                return <span className="text-xs text-muted-foreground">—</span>;
            }

            return <ActionsCell storeId={store.id} />;
        },
    },
];
