import { Button } from '@/components/ui/button';
import { Head, Link } from '@inertiajs/react';
import { CheckCircle } from 'lucide-react';

interface SuccessProps {
    sessionId?: string;
}

export default function Success({ sessionId }: SuccessProps) {
    return (
        <>
            <Head title="Pagamento Confirmado" />

            <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
                <div className="mx-4 w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-800">
                    <div className="mb-6 flex justify-center">
                        <CheckCircle className="h-20 w-20 text-green-500" />
                    </div>

                    <h1 className="mb-4 text-3xl font-bold text-gray-900 dark:text-white">
                        Pagamento Confirmado!
                    </h1>

                    <p className="mb-8 text-gray-600 dark:text-gray-400">
                        Sua assinatura foi criada com sucesso. Você já pode
                        começar a usar o Lucro Fácil!
                    </p>

                    <Link href="/dashboard">
                        <Button className="w-full bg-gradient-to-r from-blue-600 to-purple-600">
                            Ir para o Dashboard
                        </Button>
                    </Link>

                    {sessionId && (
                        <p className="mt-6 text-xs text-gray-500">
                            ID da sessão: {sessionId}
                        </p>
                    )}
                </div>
            </div>
        </>
    );
}
