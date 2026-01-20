import { router } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

interface UseOrderPollingOptions {
    enabled?: boolean;
    interval?: number; // em milissegundos
    onNewOrders?: (count: number) => void;
}

export function useOrderPolling({
    enabled = true,
    interval = 30000, // 30 segundos por padrão
    onNewOrders,
}: UseOrderPollingOptions = {}) {
    const [hasNewOrders, setHasNewOrders] = useState(false);
    const [newOrdersCount, setNewOrdersCount] = useState(0);
    const lastCheckRef = useRef<string>(new Date().toISOString());
    const intervalIdRef = useRef<NodeJS.Timeout | null>(null);

    const checkForNewOrders = async () => {
        try {
            const response = await fetch(
                `/orders/check-new?last_check=${encodeURIComponent(lastCheckRef.current)}`,
                {
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                },
            );

            if (!response.ok) return;

            const data = await response.json();

            if (data.has_new) {
                setHasNewOrders(true);
                setNewOrdersCount(data.count);
                onNewOrders?.(data.count);

                // Mostrar notificação
                toast.info(
                    `${data.count} ${data.count === 1 ? 'novo pedido' : 'novos pedidos'} sincronizado${data.count === 1 ? '' : 's'}!`,
                    {
                        action: {
                            label: 'Atualizar',
                            onClick: () => refreshOrders(),
                        },
                        duration: 10000,
                    },
                );
            }

            // Atualizar timestamp para próxima verificação
            lastCheckRef.current = data.timestamp;
        } catch (error) {
            console.error('Erro ao verificar novos pedidos:', error);
        }
    };

    const refreshOrders = () => {
        setHasNewOrders(false);
        setNewOrdersCount(0);
        router.reload({ only: ['orders', 'pagination'] });
    };

    const resetCheck = () => {
        lastCheckRef.current = new Date().toISOString();
        setHasNewOrders(false);
        setNewOrdersCount(0);
    };

    useEffect(() => {
        if (!enabled) {
            if (intervalIdRef.current) {
                clearInterval(intervalIdRef.current);
                intervalIdRef.current = null;
            }
            return;
        }

        // Primeira verificação imediata
        checkForNewOrders();

        // Configurar polling
        intervalIdRef.current = setInterval(checkForNewOrders, interval);

        // Cleanup
        return () => {
            if (intervalIdRef.current) {
                clearInterval(intervalIdRef.current);
            }
        };
    }, [enabled, interval]);

    // Resetar quando o usuário navega ou atualiza manualmente
    useEffect(() => {
        const handleNavigate = () => resetCheck();
        router.on('navigate', handleNavigate);

        return () => {
            router.off('navigate', handleNavigate);
        };
    }, []);

    return {
        hasNewOrders,
        newOrdersCount,
        refreshOrders,
        resetCheck,
    };
}
