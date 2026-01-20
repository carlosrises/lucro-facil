import { router } from '@inertiajs/react';
import { useEffect } from 'react';
import { toast } from 'sonner';

type OrderStatusChangedEvent = {
    order_id: number;
    order_code: string;
    order_uuid: string;
    old_status: string;
    new_status: string;
    cancelled_by_customer: boolean;
    message: string;
};

type ItemTriagedEvent = {
    tenant_id: number;
    order_id: number;
    order_code: string;
    item_id: number;
    item_name: string;
    internal_product_id: number | null;
    item_type: string | null;
    action: 'classified' | 'mapped';
    timestamp: string;
};

/**
 * Hook para escutar mudanças em tempo real via WebSockets
 *
 * Eventos escutados:
 * 1. order.status.changed - Status de pedido alterado externamente
 * 2. item.triaged - Item classificado ou associado na Triagem
 *
 * Atualiza a página automaticamente quando detecta mudanças
 */
export function useOrderStatusListener(tenantId?: number) {
    useEffect(() => {
        if (!tenantId || !window.Echo) {
            return;
        }

        const channel = window.Echo.channel(`orders.tenant.${tenantId}`);

        // Listener para mudanças de status de pedidos
        channel.listen(
            '.order.status.changed',
            (event: OrderStatusChangedEvent) => {
                if (event.cancelled_by_customer) {
                    toast.error('Pedido Cancelado', {
                        description: `Pedido ${event.order_code} foi cancelado pelo cliente`,
                        action: {
                            label: 'Ver pedido',
                            onClick: () => {
                                router.reload({ only: ['orders'] });
                            },
                        },
                    });
                } else if (event.new_status === 'CONFIRMED') {
                    toast.success('Pedido Confirmado', {
                        description: `Pedido ${event.order_code} foi confirmado`,
                    });
                } else {
                    toast.info('Status Atualizado', {
                        description: event.message,
                    });
                }

                // Recarrega lista de pedidos
                router.reload({ only: ['orders'] });
            },
        );

        // Listener mantido para possíveis notificações específicas da triagem
        channel.listen('.item.triaged', (_event: ItemTriagedEvent) => {
            // Sem efeito adicional: atualizações são tratadas pelo useRealtimeOrders
        });

        return () => {
            channel.stopListening('.order.status.changed');
            channel.stopListening('.item.triaged');
            window.Echo.leaveChannel(`orders.tenant.${tenantId}`);
        };
    }, [tenantId]);
}
