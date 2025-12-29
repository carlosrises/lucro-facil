import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogFooter as DialogFooterUI,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
} from '@/components/ui/drawer';
import { Separator } from '@/components/ui/separator';
import {
    AlertCircle,
    ExternalLink,
    Plus,
    RectangleEllipsis,
    RotateCcw,
    Trash2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { MarketplaceCard } from '@/components/settings/integrations/marketplace-card';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';

interface NineNineFoodDrawerProps {
    name: string;
    logo: string;
    description: string;
    available: boolean;
}

interface Store {
    id: number;
    display_name: string;
    external_store_id: string;
    active: boolean;
    token_expired?: boolean;
    token_expiring_soon?: boolean;
}

export function NineNineFoodDrawer({
    name,
    logo,
    description,
    available,
}: NineNineFoodDrawerProps) {
    const [loading, setLoading] = useState(false);
    const [loadingStores, setLoadingStores] = useState(false);
    const [stores, setStores] = useState<Store[]>([]);
    const [removingId, setRemovingId] = useState<number | null>(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [storeToDelete, setStoreToDelete] = useState<Store | null>(null);
    const [authData, setAuthData] = useState<{
        userCode?: string;
        verificationUrl?: string;
        verificationUrlComplete?: string;
        authorizationCodeVerifier?: string;
        expiresIn?: number;
    } | null>(null);
    const [authorizationCode, setAuthorizationCode] = useState('');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [step, setStep] = useState<'initial' | 'instructions'>('initial');

    useEffect(() => {
        const handler = (e: CustomEvent) => {
            if (e.detail?.provider === name.toLowerCase()) {
                setDialogOpen(true);
            }
        };
        window.addEventListener(
            'openIntegrationDrawer',
            handler as EventListener,
        );
        return () => {
            window.removeEventListener(
                'openIntegrationDrawer',
                handler as EventListener,
            );
        };
    }, [name]);

    function handleDialogChange(open: boolean) {
        setDialogOpen(open);
        if (!open) {
            setStep('initial');
            setAuthorizationCode('');
            setAuthData(null);
        }
    }

    function openDeleteDialog(store: Store) {
        setStoreToDelete(store);
        setDeleteDialogOpen(true);
    }

    function closeDeleteDialog() {
        setStoreToDelete(null);
        setDeleteDialogOpen(false);
    }

    async function handleRemoveStore() {
        if (!storeToDelete) return;

        try {
            setRemovingId(storeToDelete.id);

            const res = await fetch(`/api/99food/stores/${storeToDelete.id}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': (
                        document.querySelector(
                            'meta[name="csrf-token"]',
                        ) as HTMLMetaElement
                    ).content,
                },
            });

            if (!res.ok) throw new Error('Falha ao remover loja');
            toast.success('Loja removida com sucesso!');

            setStores((prev) => prev.filter((s) => s.id !== storeToDelete.id));
            closeDeleteDialog();
        } catch (e) {
            console.error(e);
            toast.error('Erro ao remover loja.');
        } finally {
            setRemovingId(null);
            setStep('initial');
        }
    }

    async function fetchStores() {
        try {
            setLoadingStores(true);
            const res = await fetch('/api/99food/stores');
            if (!res.ok) throw new Error('Falha ao carregar lojas');
            const data = await res.json();
            setStores(data.stores || []);
        } catch (e) {
            console.error(e);
            toast.error('Erro ao carregar lojas integradas.');
        } finally {
            setLoadingStores(false);
        }
    }

    async function handleGenerateCode() {
        try {
            setLoading(true);

            const res = await fetch('/api/99food/oauth/userCode', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': (
                        document.querySelector(
                            'meta[name="csrf-token"]',
                        ) as HTMLMetaElement
                    ).content,
                },
            });

            if (!res.ok) throw new Error('Falha na requisição');

            const data = await res.json();
            setAuthData(data);

            setStep('instructions');
            toast.success('Código de autenticação gerado com sucesso!');
        } catch (e) {
            console.error(e);
            toast.error('Erro ao gerar código. Tente novamente.');
        } finally {
            setLoading(false);
        }
    }

    async function handleFinishIntegration() {
        if (!authorizationCode) {
            toast.error('Informe o código de autorização.');
            return;
        }

        try {
            setLoading(true);

            const res = await fetch('/api/99food/oauth/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': (
                        document.querySelector(
                            'meta[name="csrf-token"]',
                        ) as HTMLMetaElement
                    ).content,
                },
                body: JSON.stringify({
                    authorization_code: authorizationCode,
                }),
            });

            if (!res.ok) throw new Error('Falha ao concluir integração');
            const data = await res.json();

            toast.success('Integração concluída com sucesso!');
            fetchStores();
            setDialogOpen(false);
            console.log('Loja integrada:', data.store);
        } catch (e) {
            console.error(e);
            toast.error('Erro ao concluir integração.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <>
            <Drawer onOpenChange={(open) => open && fetchStores()}>
                <DrawerTrigger asChild>
                    <MarketplaceCard
                        name={name}
                        logo={logo}
                        description={description}
                        available={available}
                    />
                </DrawerTrigger>

                <DrawerContent>
                    <div className="mx-auto w-full max-w-md">
                        <DrawerHeader>
                            <DrawerTitle>
                                <div className="flex items-center justify-center">
                                    <img
                                        src={logo}
                                        alt={name}
                                        className="h-16 w-16 rounded-md object-contain"
                                    />
                                </div>
                            </DrawerTitle>
                            <DrawerDescription>
                                Conecte sua loja do 99Food para receber pedidos
                                diretamente no sistema.
                            </DrawerDescription>
                        </DrawerHeader>

                        <div className="p-4 pb-0">
                            <p className="text-sm text-muted-foreground">
                                Com a integração com o 99Food você tem o
                                controle dos seus pedidos em um só lugar sem
                                precisar acessar múltiplas plataformas.
                            </p>

                            <Separator className="my-4" />

                            <p className="mb-2 text-gray-600">
                                Lojas conectadas:
                            </p>
                            {loadingStores ? (
                                <div className="my-4 flex items-center justify-between rounded-md">
                                    <div className="flex items-center space-x-4">
                                        <div className="space-y-2">
                                            <Skeleton className="h-3 w-sm" />
                                            <Skeleton className="h-3 w-xs" />
                                        </div>
                                    </div>
                                </div>
                            ) : stores.length > 0 ? (
                                <ul className="space-y-2">
                                    {stores.map((store) => (
                                        <li
                                            key={store.id}
                                            className={`flex items-center justify-between rounded-md border px-3 py-2 ${
                                                store.token_expired
                                                    ? 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20'
                                                    : !store.active
                                                        ? 'border-red-500 bg-card'
                                                        : 'bg-card'
                                            }`}
                                        >
                                            <div>
                                                <h3 className="flex items-center gap-2 text-sm font-medium">
                                                    {(store.token_expired ||
                                                        !store.active) && (
                                                        <AlertCircle className="h-4 w-4 text-red-600" />
                                                    )}
                                                    <span
                                                        className={`${!store.active ? 'text-muted-foreground' : ''}`}
                                                    >
                                                        {store.display_name}
                                                    </span>
                                                </h3>
                                                {store.token_expired && (
                                                    <p className="text-xs text-red-700 dark:text-red-400">
                                                        Token expirado -
                                                        Credenciais inválidas
                                                    </p>
                                                )}
                                                {!store.active &&
                                                    !store.token_expired &&
                                                    !store.token_expiring_soon && (
                                                        <p className="text-xs text-red-700">
                                                            Necessita integração
                                                        </p>
                                                    )}
                                                <p
                                                    className={`text-xs text-muted-foreground`}
                                                >
                                                    {store.external_store_id}
                                                </p>
                                            </div>

                                            <div className="flex items-center gap-1">
                                                {!store.active && (
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => {
                                                                    setDialogOpen(
                                                                        true,
                                                                    );
                                                                    setStep(
                                                                        'initial',
                                                                    );
                                                                    setAuthorizationCode(
                                                                        '',
                                                                    );
                                                                    setAuthData(
                                                                        null,
                                                                    );
                                                                }}
                                                            >
                                                                <RotateCcw className="h-4 w-4" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p>
                                                                Reintegrar loja
                                                            </p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                )}

                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            disabled={
                                                                removingId ===
                                                                store.id
                                                            }
                                                            onClick={() =>
                                                                openDeleteDialog(
                                                                    store,
                                                                )
                                                            }
                                                        >
                                                            <Trash2
                                                                className={`h-4 w-4 ${
                                                                    removingId ===
                                                                    store.id
                                                                        ? 'animate-pulse text-gray-400'
                                                                        : 'text-red-500'
                                                                }`}
                                                            />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>Excluir loja</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-sm text-gray-500">
                                    Nenhuma loja integrada ainda.
                                </p>
                            )}
                        </div>

                        <DrawerFooter>
                            <Dialog
                                open={dialogOpen}
                                onOpenChange={handleDialogChange}
                            >
                                <DialogTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className="w-full"
                                    >
                                        <Plus className="mr-2" />
                                        Adicionar loja 99Food
                                    </Button>
                                </DialogTrigger>

                                <DialogContent className="sm:max-w-[425px]">
                                    {step === 'initial' ? (
                                        <>
                                            <DialogHeader>
                                                <DialogTitle>
                                                    Adicionar loja do 99Food
                                                </DialogTitle>
                                                <DialogDescription>
                                                    Clique no botão abaixo para
                                                    iniciar o processo de
                                                    autorização.
                                                </DialogDescription>
                                            </DialogHeader>
                                            <DialogFooterUI>
                                                <div className="flex w-full flex-col gap-3">
                                                    <Button
                                                        variant="default"
                                                        onClick={
                                                            handleGenerateCode
                                                        }
                                                        disabled={loading}
                                                        className="w-full"
                                                    >
                                                        <RectangleEllipsis className="mr-2" />
                                                        {loading
                                                            ? 'Gerando...'
                                                            : 'Gerar código de autenticação'}
                                                    </Button>
                                                    <DialogClose asChild>
                                                        <Button
                                                            variant="outline"
                                                            className="w-full"
                                                        >
                                                            Cancelar
                                                        </Button>
                                                    </DialogClose>
                                                </div>
                                            </DialogFooterUI>
                                        </>
                                    ) : (
                                        <>
                                            <DialogHeader>
                                                <DialogTitle>
                                                    Adicionar loja do 99Food
                                                </DialogTitle>
                                                <DialogDescription>
                                                    Passos para a integração:
                                                </DialogDescription>
                                            </DialogHeader>

                                            <div className="space-y-4">
                                                <ol className="list-inside list-decimal space-y-2 text-sm text-muted-foreground">
                                                    <li>
                                                        Clique no botão abaixo
                                                        para ir ao Portal do
                                                        99Food e autorizar a
                                                        integração.
                                                    </li>
                                                    <li>
                                                        Verifique as informações
                                                        e autorize no Portal.
                                                    </li>
                                                    <li>
                                                        Copie o{' '}
                                                        <strong>
                                                            código de
                                                            autorização
                                                        </strong>{' '}
                                                        que irá aparecer.
                                                    </li>
                                                    <li>
                                                        Cole o código no campo
                                                        abaixo e clique em{' '}
                                                        <em>
                                                            Concluir integração
                                                        </em>
                                                        .
                                                    </li>
                                                </ol>

                                                {authData?.verificationUrlComplete && (
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        className="w-full"
                                                        onClick={() =>
                                                            window.open(
                                                                authData.verificationUrlComplete,
                                                                '_blank',
                                                            )
                                                        }
                                                    >
                                                        <ExternalLink className="mr-2" />
                                                        Autorizar integração
                                                    </Button>
                                                )}

                                                <div className="space-y-1">
                                                    <label
                                                        htmlFor="authorizationCode"
                                                        className="text-sm font-medium"
                                                    >
                                                        Código de autorização
                                                    </label>
                                                    <input
                                                        id="authorizationCode"
                                                        type="text"
                                                        value={
                                                            authorizationCode
                                                        }
                                                        onChange={(e) =>
                                                            setAuthorizationCode(
                                                                e.target.value,
                                                            )
                                                        }
                                                        placeholder="Cole o código aqui"
                                                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
                                                    />
                                                </div>
                                            </div>

                                            <DialogFooterUI>
                                                <Button
                                                    onClick={
                                                        handleFinishIntegration
                                                    }
                                                    disabled={loading}
                                                    className="w-full"
                                                >
                                                    {loading
                                                        ? 'Concluindo...'
                                                        : 'Concluir integração'}
                                                </Button>
                                            </DialogFooterUI>
                                        </>
                                    )}
                                </DialogContent>
                            </Dialog>
                        </DrawerFooter>
                    </div>
                </DrawerContent>
            </Drawer>

            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Remover loja</DialogTitle>
                        <DialogDescription>
                            Tem certeza que deseja remover a loja{' '}
                            <strong>{storeToDelete?.display_name}</strong>?
                            <br />
                            Esta ação não poderá ser desfeita.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button
                                variant="outline"
                                onClick={closeDeleteDialog}
                            >
                                Cancelar
                            </Button>
                        </DialogClose>
                        <Button
                            variant="destructive"
                            onClick={handleRemoveStore}
                            disabled={removingId === storeToDelete?.id}
                        >
                            {removingId === storeToDelete?.id
                                ? 'Removendo...'
                                : 'Remover'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
