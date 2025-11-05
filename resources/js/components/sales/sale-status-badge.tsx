import { Badge } from '@/components/ui/badge';
import {
    CircleCheckIcon,
    ClockIcon,
    PackageIcon,
    TruckIcon,
    UtensilsIcon,
    XCircleIcon,
} from 'lucide-react';

export type SaleStatus =
    | 'PLACED'
    | 'CONFIRMED'
    | 'PREPARATION_STARTED'
    | 'DISPATCHED'
    | 'READY_TO_PICKUP'
    | 'CONCLUDED'
    | 'CANCELLED';

interface Props {
    status: SaleStatus;
}

const statusConfig: Record<
    SaleStatus,
    { label: string; color: string; icon: React.ElementType }
> = {
    PLACED: {
        label: 'Novo Pedido',
        color: 'bg-yellow-500 text-white',
        icon: ClockIcon,
    },
    CONFIRMED: {
        label: 'Confirmado',
        color: 'bg-blue-500 text-white',
        icon: CircleCheckIcon,
    },
    PREPARATION_STARTED: {
        label: 'Em Preparo',
        color: 'bg-orange-500 text-white',
        icon: UtensilsIcon,
    },
    DISPATCHED: {
        label: 'Despachado',
        color: 'bg-indigo-500 text-white',
        icon: TruckIcon,
    },
    READY_TO_PICKUP: {
        label: 'Pronto para Retirada',
        color: 'bg-purple-500 text-white',
        icon: PackageIcon,
    },
    CONCLUDED: {
        label: 'Concluído',
        color: 'bg-green-600 text-white',
        icon: CircleCheckIcon,
    },
    CANCELLED: {
        label: 'Cancelado',
        color: 'bg-red-600 text-white',
        icon: XCircleIcon,
    },
};

export function SaleStatusBadge({ status }: Props) {
    const {
        label,
        color,
        icon: Icon,
    } = statusConfig[status] ?? {
        label: status,
        color: 'bg-gray-500 text-white',
        icon: CircleCheckIcon,
    };

    return (
        <Badge variant="secondary" className={`${color} text-xs`}>
            <Icon className="h-2.5 w-2.5" />
            {label}
        </Badge>
    );
}
