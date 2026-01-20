import { useState, useEffect } from 'react';
import type { Order } from '@/components/orders/columns';

/**
 * Hook para lazy loading de detalhes do pedido
 * Carrega items, mappings, sale e demais relacionamentos apenas quando necessário
 */
export function useOrderDetails(orderId: number | null, isExpanded: boolean) {
    const [orderDetails, setOrderDetails] = useState<Order | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!orderId || !isExpanded) {
            return;
        }

        // Se já carregou os detalhes, não recarregar
        if (orderDetails?.id === orderId) {
            return;
        }

        const fetchDetails = async () => {
            setIsLoading(true);
            setError(null);

            try {
                const response = await fetch(`/api/orders/${orderId}`, {
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest',
                        Accept: 'application/json',
                    },
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const data = await response.json();
                setOrderDetails(data);
            } catch (err) {
                console.error('[Order Details] Erro ao carregar detalhes:', err);
                setError(err instanceof Error ? err.message : 'Erro desconhecido');
            } finally {
                setIsLoading(false);
            }
        };

        fetchDetails();
    }, [orderId, isExpanded, orderDetails]);

    return { orderDetails, isLoading, error };
}
