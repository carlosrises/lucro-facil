import { useCallback, useState } from 'react';

type OrderDetails = {
    items?: any[];
    sale?: any;
    // Adicione outros campos conforme necessário
};

/**
 * Hook para lazy loading de detalhes do pedido ao expandir
 * Evita carregar relacionamentos pesados de todos os pedidos
 */
export function useOrderLazyLoad() {
    const [loadedOrders, setLoadedOrders] = useState<Map<number, OrderDetails>>(
        new Map(),
    );
    const [loadingOrders, setLoadingOrders] = useState<Set<number>>(new Set());

    const loadOrderDetails = useCallback(
        async (orderId: number) => {
            // Se já está carregado ou carregando, não fazer nada
            if (loadedOrders.has(orderId) || loadingOrders.has(orderId)) {
                return loadedOrders.get(orderId);
            }

            setLoadingOrders((prev) => new Set(prev).add(orderId));

            try {
                const response = await fetch(`/api/orders/${orderId}`, {
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest',
                        Accept: 'application/json',
                    },
                });

                if (response.ok) {
                    const details = await response.json();

                    setLoadedOrders((prev) => {
                        const newMap = new Map(prev);
                        newMap.set(orderId, details);
                        return newMap;
                    });

                    return details;
                }
            } catch (error) {
                console.error('Erro ao carregar detalhes do pedido:', error);
            } finally {
                setLoadingOrders((prev) => {
                    const newSet = new Set(prev);
                    newSet.delete(orderId);
                    return newSet;
                });
            }

            return null;
        },
        [loadedOrders, loadingOrders],
    );

    const getOrderDetails = useCallback(
        (orderId: number) => loadedOrders.get(orderId),
        [loadedOrders],
    );

    const isLoading = useCallback(
        (orderId: number) => loadingOrders.has(orderId),
        [loadingOrders],
    );

    return {
        loadOrderDetails,
        getOrderDetails,
        isLoading,
    };
}
