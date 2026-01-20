import { useEffect, useState } from 'react';
import { toast } from 'sonner';

type NewOrderEvent = {
    tenant_id: number;
    order_id: number;
    order_code: string;
    provider: string;
    total: number;
    timestamp: string;
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
 * Hook para adicionar/atualizar pedidos em tempo real sem recarregar a página
 *
 * Estratégia:
 * 1. Escuta 'order.created' - Novos pedidos sincronizados
 * 2. Escuta 'item.triaged' - Itens classificados/associados na Triagem
 * 3. Faz fetch silencioso do pedido completo
 * 4. Adiciona no topo (se novo) ou atualiza in-place (se existente)
 * 5. Toast discreto apenas para novos pedidos
 *
 * @param tenantId - ID do tenant para escutar eventos
 * @param onOrderUpsert - Callback quando pedido for criado/atualizado (recebe pedido + isNew flag)
 */
export function useRealtimeOrders(
    tenantId?: number,
    onOrderUpsert?: (order: any, isNew: boolean) => void,
) {
    const [pendingOrders, setPendingOrders] = useState<number[]>([]);

    useEffect(() => {
        if (!tenantId || !window.Echo) {
            return;
        }

        console.log(
            `[Realtime Orders] Escutando atualizações no tenant ${tenantId}`,
        );

        const channel = window.Echo.channel(`orders.tenant.${tenantId}`);

        // Função helper para buscar pedido atualizado
        const fetchOrder = async (orderId: number, isNew: boolean) => {
            setPendingOrders((prev) => [...prev, orderId]);

            try {
                const response = await fetch(`/api/orders/${orderId}`, {
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest',
                        Accept: 'application/json',
                    },
                });

                if (response.ok) {
                    const order = await response.json();

                    if (onOrderUpsert) {
                        onOrderUpsert(order, isNew);
                    }
                }
            } catch (error) {
                console.error(
                    '[Realtime Orders] Erro ao buscar pedido:',
                    error,
                );
            } finally {
                setPendingOrders((prev) => prev.filter((id) => id !== orderId));
            }
        };

        // Listener para novos pedidos
        channel.listen('.order.created', async (event: NewOrderEvent) => {
            console.log('[Realtime Orders] Novo pedido recebido:', event);

            // Toast discreto apenas para novos
            toast.success('Novo pedido recebido', {
                description: `#${event.order_code} - ${event.provider}`,
                duration: 3000,
            });

            await fetchOrder(event.order_id, true);
        });

        // Listener para itens classificados/associados na Triagem
        channel.listen('.item.triaged', async (event: ItemTriagedEvent) => {
            console.log('[Realtime Orders] Item classificado:', event);

            // Sem toast para atualizações (silencioso)
            await fetchOrder(event.order_id, false);
        });

        return () => {
            console.log('[Realtime Orders] Desconectando canal');
            channel.stopListening('.order.created');
            channel.stopListening('.item.triaged');
        };
    }, [tenantId, onOrderUpsert]);

    return {
        pendingOrders,
        hasPendingOrders: pendingOrders.length > 0,
    };
}
