import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { router } from '@inertiajs/react';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

interface RecalculateProgressProps {
    cacheKey: string | null;
    onComplete?: () => void;
}

interface ProgressData {
    status: 'idle' | 'processing' | 'completed' | 'error';
    total?: number;
    processed?: number;
    percentage?: number;
    started_at?: string;
    completed_at?: string;
    message?: string;
}

export function RecalculateProgress({
    cacheKey,
    onComplete,
}: RecalculateProgressProps) {
    const [progress, setProgress] = useState<ProgressData | null>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (!cacheKey) {
            setIsVisible(false);
            return;
        }

        setIsVisible(true);

        // Fazer primeira requisição imediatamente
        const fetchProgress = async () => {
            try {
                const url = `/cost-commissions/recalculate-progress?cache_key=${encodeURIComponent(cacheKey)}`;
                const response = await fetch(url);
                const data = await response.json();

                setProgress(data);

                // Se completou ou deu erro, parar o polling
                if (data.status === 'completed' || data.status === 'error') {
                    // Aguardar 3 segundos antes de esconder
                    setTimeout(() => {
                        setIsVisible(false);
                        onComplete?.();

                        // Recarregar a página para atualizar os dados
                        router.reload({ only: ['data'] });
                    }, 3000);
                    return false; // Indica que deve parar o polling
                }
                return true; // Continuar polling
            } catch (error) {
                console.error('Erro ao buscar progresso:', error);
                return true; // Continuar tentando
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
    }, [cacheKey, onComplete]);

    if (!isVisible || !progress || progress.status === 'idle') {
        return null;
    }

    return (
        <div className="fixed right-4 bottom-4 z-50 w-96">
            {progress.status === 'processing' && (
                <Alert className="border-blue-200 bg-blue-50">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                    <AlertDescription className="ml-2">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-blue-900">
                                    Recalculando custos dos pedidos...
                                </span>
                                <span className="text-xs text-blue-700">
                                    {progress.processed}/{progress.total}
                                </span>
                            </div>
                            <Progress
                                value={progress.percentage || 0}
                                className="h-2"
                            />
                            <div className="text-xs text-blue-600">
                                {progress.percentage?.toFixed(1)}% concluído
                            </div>
                        </div>
                    </AlertDescription>
                </Alert>
            )}

            {progress.status === 'completed' && (
                <Alert className="border-green-200 bg-green-50">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertDescription className="ml-2">
                        <div className="space-y-1">
                            <div className="text-sm font-medium text-green-900">
                                Recálculo concluído!
                            </div>
                            <div className="text-xs text-green-700">
                                {progress.processed} pedidos recalculados com
                                sucesso
                            </div>
                        </div>
                    </AlertDescription>
                </Alert>
            )}

            {progress.status === 'error' && (
                <Alert className="border-red-200 bg-red-50">
                    <XCircle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="ml-2">
                        <div className="space-y-1">
                            <div className="text-sm font-medium text-red-900">
                                Erro no recálculo
                            </div>
                            <div className="text-xs text-red-700">
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
