import { Store } from '@/components/stores/columns';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export function IntegrationWarning({
    storesWithError,
}: {
    storesWithError: Store[];
}) {
    if (!storesWithError.length) return null;
    return (
        <Alert variant="destructive" className="mb-4">
            <AlertTitle>Atenção: Integração iFood</AlertTitle>
            <AlertDescription>
                Uma ou mais lojas estão com a integração iFood desativada.
                Refaça a integração para continuar recebendo pedidos
                normalmente.
            </AlertDescription>
        </Alert>
    );
}
