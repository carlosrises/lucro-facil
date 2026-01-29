import { Button } from '@/components/ui/button';
import { Head, Link } from '@inertiajs/react';
import { XCircle } from 'lucide-react';

export default function Cancel() {
    return (
        <>
            <Head title="Checkout Cancelado" />

            <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
                <div className="mx-4 w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-800">
                    <div className="mb-6 flex justify-center">
                        <XCircle className="h-20 w-20 text-red-500" />
                    </div>

                    <h1 className="mb-4 text-3xl font-bold text-gray-900 dark:text-white">
                        Checkout Cancelado
                    </h1>

                    <p className="mb-8 text-gray-600 dark:text-gray-400">
                        O processo de pagamento foi cancelado. Você pode tentar
                        novamente quando quiser.
                    </p>

                    <div className="flex flex-col gap-3">
                        <Link href="/#pricing">
                            <Button className="w-full bg-gradient-to-r from-blue-600 to-purple-600">
                                Ver Planos
                            </Button>
                        </Link>
                        <Link href="/">
                            <Button variant="outline" className="w-full">
                                Voltar ao Início
                            </Button>
                        </Link>
                    </div>
                </div>
            </div>
        </>
    );
}
