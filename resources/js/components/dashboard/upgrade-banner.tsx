import { Button } from '@/components/ui/button';
import { Link } from '@inertiajs/react';
import { Sparkles } from 'lucide-react';

interface UpgradeBannerProps {
    currentPlan: {
        code: string;
        name: string;
    };
    showUpgrade?: boolean;
}

export function UpgradeBanner({
    currentPlan,
    showUpgrade = true,
}: UpgradeBannerProps) {
    // Não mostrar se não for FREE ou se showUpgrade for false
    if (currentPlan.code !== 'FREE' || !showUpgrade) {
        return null;
    }

    return (
        <div className="relative overflow-hidden rounded-lg border border-purple-200 bg-gradient-to-r from-purple-50 to-blue-50 p-6 dark:border-purple-800 dark:from-purple-950 dark:to-blue-950">
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-purple-600 to-blue-600">
                        <Sparkles className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Desbloqueie todo o potencial do Lucro Fácil
                        </h3>
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                            Você está no plano{' '}
                            <span className="font-medium">
                                {currentPlan.name}
                            </span>
                            . Faça upgrade para ter pedidos ilimitados,
                            relatórios avançados e muito mais!
                        </p>
                    </div>
                </div>
                <Link href="/settings/billing">
                    <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700">
                        Ver Planos
                    </Button>
                </Link>
            </div>
        </div>
    );
}
