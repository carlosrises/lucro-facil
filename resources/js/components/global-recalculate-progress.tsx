import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { router } from '@inertiajs/react';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

interface ProgressData {
    status: 'idle' | 'processing' | 'completed' | 'error';
    total?: number;
    processed?: number;
    percentage?: number;
    started_at?: string;
    completed_at?: string;
    message?: string;
}

const STORAGE_KEY = 'global_recalculate_cache_key';
const LAST_CHECK_KEY = 'global_recalculate_last_check';

export function GlobalRecalculateProgress() {
    const [progress, setProgress] = useState<ProgressData | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [cacheKey, setCacheKey] = useState<string | null>(null);

    // Carregar cache key do localStorage ao montar
    useEffect(() => {
        const storedCacheKey = localStorage.getItem(STORAGE_KEY);
        if (storedCacheKey) {
            setCacheKey(storedCacheKey);
        }
    }, []);

    // Listener para mudanças no localStorage (quando outra aba/página inicia um recálculo)
    useEffect(() => {
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === STORAGE_KEY && e.newValue) {
                setCacheKey(e.newValue);
            }
        };

        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    // Polling do progresso
    useEffect(() => {
        if (!cacheKey) {
            setIsVisible(false);
            return;
        }

        setIsVisible(true);

        const fetchProgress = async () => {
            try {
                const url = `/cost-commissions/recalculate-progress?cache_key=${encodeURIComponent(cacheKey)}`;
                const response = await fetch(url);
                const data = await response.json();

                setProgress(data);

                // Se idle (não encontrado), limpar
                if (data.status === 'idle') {
                    localStorage.removeItem(STORAGE_KEY);
                    localStorage.removeItem(LAST_CHECK_KEY);
                    setCacheKey(null);
                    return false;
                }

                // Se completou ou deu erro, parar o polling após 3 segundos
                if (data.status === 'completed' || data.status === 'error') {
                    setTimeout(() => {
                        setIsVisible(false);
                        localStorage.removeItem(STORAGE_KEY);
                        localStorage.removeItem(LAST_CHECK_KEY);
                        setCacheKey(null);

                        // Recarregar apenas se estiver em páginas relevantes
                        const currentPath = window.location.pathname;
                        if (
                            currentPath.includes('/orders') ||
                            currentPath.includes('/cost-commissions') ||
                            currentPath.includes('/sales')
                        ) {
                            router.reload({
                                only: ['data', 'orders', 'pagination'],
                            });
                        }
                    }, 3000);
                    return false;
                }

                // Atualizar timestamp da última verificação
                localStorage.setItem(LAST_CHECK_KEY, Date.now().toString());
                return true;
            } catch (error) {
                console.error('Erro ao buscar progresso:', error);
                return true;
            }
        };

        // Executar imediatamente
        fetchProgress();

        // Polling a cada 2 segundos
        const interval = setInterval(async () => {
            const shouldContinue = await fetchProgress();
            if (!shouldContinue) {
                clearInterval(interval);
            }
        }, 2000);

        return () => clearInterval(interval);
    }, [cacheKey]);

    if (!isVisible || !progress || progress.status === 'idle') {
        return null;
    }

    return (
        <div className="fixed right-4 bottom-4 z-50 w-96 animate-in slide-in-from-bottom-2">
            {progress.status === 'processing' && (
                <Alert className="border-blue-200 bg-blue-50 shadow-lg dark:border-blue-800 dark:bg-blue-950">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
                    <AlertDescription className="ml-2">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                                    Recalculando custos dos pedidos...
                                </span>
                                <span className="text-xs text-blue-700 dark:text-blue-300">
                                    {progress.processed}/{progress.total}
                                </span>
                            </div>
                            <Progress
                                value={progress.percentage || 0}
                                className="h-2"
                            />
                            <div className="text-xs text-blue-600 dark:text-blue-400">
                                {progress.percentage?.toFixed(1)}% concluído
                            </div>
                        </div>
                    </AlertDescription>
                </Alert>
            )}

            {progress.status === 'completed' && (
                <Alert className="border-green-200 bg-green-50 shadow-lg dark:border-green-800 dark:bg-green-950">
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <AlertDescription className="ml-2">
                        <div className="space-y-1">
                            <div className="text-sm font-medium text-green-900 dark:text-green-100">
                                Recálculo concluído!
                            </div>
                            <div className="text-xs text-green-700 dark:text-green-300">
                                {progress.processed} pedidos recalculados com
                                sucesso
                            </div>
                        </div>
                    </AlertDescription>
                </Alert>
            )}

            {progress.status === 'error' && (
                <Alert className="border-red-200 bg-red-50 shadow-lg dark:border-red-800 dark:bg-red-950">
                    <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                    <AlertDescription className="ml-2">
                        <div className="space-y-1">
                            <div className="text-sm font-medium text-red-900 dark:text-red-100">
                                Erro no recálculo
                            </div>
                            <div className="text-xs text-red-700 dark:text-red-300">
                                {progress.message ||
                                    'Ocorreu um erro durante o recálculo'}
                            </div>
                        </div>
                    </AlertDescription>
                </Alert>
            )}
        </div>
    );
}

// Função helper para iniciar o monitoramento de um novo recálculo
export function startRecalculateMonitoring(cacheKey: string) {
    localStorage.setItem(STORAGE_KEY, cacheKey);
    localStorage.setItem(LAST_CHECK_KEY, Date.now().toString());

    // Disparar evento personalizado para notificar todas as abas
    window.dispatchEvent(
        new CustomEvent('recalculate-started', { detail: { cacheKey } }),
    );
}
