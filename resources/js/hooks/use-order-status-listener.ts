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
 * Quando um pedido tem seu status alterado externalmente (pelo cliente,
 * iFood ou outro app), este hook:
 * 1. Exibe uma notificação toast
 * 2. Recarrega a lista de pedidos automaticamente
 *
 * Critérios de homologação 12-13
 *
 * NOTA: Hook temporariamente desabilitado para evitar timeouts/loops
 */
export function useOrderStatusListener(tenantId?: number) {
    useEffect(() => {
        // Hook desabilitado para evitar recarregamentos automáticos
        // que podem causar timeout na página
        return;

        /* CÓDIGO ORIGINAL COMENTADO PARA REFERÊNCIA FUTURA
        if (!tenantId) return;

        // Configuração do Echo (Laravel Echo + Pusher/Soketi)
        // Descomente quando configurar broadcasting
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

        // Alternativa usando Page Visibility API
        // Recarrega apenas quando o usuário retorna para a aba
        const handleVisibilityChange = () => {
            // Quando a aba fica visível novamente, recarrega os dados
            if (document.visibilityState === 'visible') {
                router.reload({ only: ['orders'] });
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener(
                'visibilitychange',
                handleVisibilityChange,
            );
        };
        */
    }, [tenantId]);
}
