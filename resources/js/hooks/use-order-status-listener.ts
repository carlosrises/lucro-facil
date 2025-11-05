import { router } from '@inertiajs/react';
import { useEffect } from 'react';

type OrderStatusChangedEvent = {
    order_id: number;
    order_code: string;
    order_uuid: string;
    old_status: string;
    new_status: string;
    cancelled_by_customer: boolean;
    message: string;
};

/**
 * Hook para escutar mudanças de status de pedidos em tempo real
 *
 * Quando um pedido tem seu status alterado externamente (pelo cliente,
 * iFood ou outro app), este hook:
 * 1. Exibe uma notificação toast
 * 2. Recarrega a lista de pedidos automaticamente
 *
 * Critérios de homologação 12-13
 */
export function useOrderStatusListener(tenantId?: number) {
    useEffect(() => {
        if (!tenantId) return;

        // Configuração do Echo (Laravel Echo + Pusher/Soketi)
        // Descomente quando configurar broadcasting
        /*
        const channel = window.Echo.channel(`orders.tenant.${tenantId}`);

        channel.listen('.order.status.changed', (event: OrderStatusChangedEvent) => {
            // Exibe toast baseado no tipo de mudança
            if (event.cancelled_by_customer) {
                toast.error('Pedido Cancelado', {
                    description: event.message,
                    action: {
                        label: 'Ver pedido',
                        onClick: () => {
                            // Navega para o pedido específico ou apenas recarrega
                            router.reload({ only: ['orders'] });
                        },
                    },
                });
            } else if (event.new_status === 'CONFIRMED') {
                toast.success('Pedido Confirmado', {
                    description: event.message,
                });
            } else {
                toast.info('Status Atualizado', {
                    description: event.message,
                });
            }

            // Recarrega lista de pedidos
            router.reload({ only: ['orders'] });
        });

        return () => {
            channel.stopListening('.order.status.changed');
            window.Echo.leaveChannel(`orders.tenant.${tenantId}`);
        };
        */

        // Polling alternativo (sem broadcasting)
        // Recarrega a página a cada 30 segundos para pegar atualizações
        const interval = setInterval(() => {
            router.reload({ only: ['orders'] });
        }, 30000); // 30 segundos

        return () => clearInterval(interval);
    }, [tenantId]);
}
