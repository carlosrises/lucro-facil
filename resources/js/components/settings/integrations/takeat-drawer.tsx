import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, LogIn, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { MarketplaceCard } from '@/components/settings/integrations/marketplace-card';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';

interface TakeatDrawerProps {
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
    excluded_channels?: string[];
    token_expired?: boolean;
    token_expiring_soon?: boolean;
}

const AVAILABLE_CHANNELS = [
    { value: 'ifood', label: 'iFood' },
    { value: '99food', label: '99Food' },
    { value: 'neemo', label: 'Neemo' },
    { value: 'keeta', label: 'Keeta' },
    { value: 'pdv', label: 'PDV/Presencial' },
    { value: 'delivery', label: 'Delivery Próprio' },
    { value: 'totem', label: 'Totem' },
];

export function TakeatDrawer({
    name,
    logo,
    description,
    available,
}: TakeatDrawerProps) {
    const [loading, setLoading] = useState(false);
    const [loadingStores, setLoadingStores] = useState(false);
    const [stores, setStores] = useState<Store[]>([]);
    const [removingId, setRemovingId] = useState<number | null>(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [storeToDelete, setStoreToDelete] = useState<Store | null>(null);
    const [loginDialogOpen, setLoginDialogOpen] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [editingStoreId, setEditingStoreId] = useState<number | null>(null);
    const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
    const [channelsDialogOpen, setChannelsDialogOpen] = useState(false);

    function openDeleteDialog(store: Store) {
        setStoreToDelete(store);
        setDeleteDialogOpen(true);
    }

    function closeDeleteDialog() {
        setStoreToDelete(null);
        setDeleteDialogOpen(false);
    }

    function openChannelsDialog(store: Store) {
        setEditingStoreId(store.id);
        setSelectedChannels(store.excluded_channels || []);
        setChannelsDialogOpen(true);
    }

    function closeChannelsDialog() {
        setEditingStoreId(null);
        setSelectedChannels([]);
        setChannelsDialogOpen(false);
    }

    async function handleRemoveStore() {
        if (!storeToDelete) return;

        try {
            setRemovingId(storeToDelete.id);

            const res = await fetch(`/api/takeat/stores/${storeToDelete.id}`, {
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
        }
    }

    async function fetchStores() {
        try {
            setLoadingStores(true);
            const res = await fetch('/api/takeat/stores');
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

    async function handleLogin() {
        if (!email || !password) {
            toast.error('Preencha email e senha.');
            return;
        }

        try {
            setLoading(true);

            const res = await fetch('/api/takeat/login', {
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
                    email,
                    password,
                }),
            });

            if (!res.ok) {
                // Erro 419: Token CSRF expirado - recarregar página
                if (res.status === 419) {
                    toast.error('Sessão expirada. Recarregando a página...', {
                        duration: 3000,
                    });
                    setTimeout(() => {
                        window.location.reload();
                    }, 1000);
                    return;
                }

                throw new Error('Falha ao autenticar');
            }

            const data = await res.json();

            toast.success('Integração concluída com sucesso!');
            fetchStores();
            setLoginDialogOpen(false);
            setEmail('');
            setPassword('');
        } catch (e) {
            console.error(e);
            toast.error('Erro ao autenticar. Verifique suas credenciais.');
        } finally {
            setLoading(false);
        }
    }

    async function handleUpdateChannels() {
        if (editingStoreId === null) return;

        try {
            setLoading(true);

            const res = await fetch(
                `/api/takeat/stores/${editingStoreId}/excluded-channels`,
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': (
                            document.querySelector(
                                'meta[name="csrf-token"]',
                            ) as HTMLMetaElement
                        ).content,
                    },
                    body: JSON.stringify({
                        excluded_channels: selectedChannels,
                    }),
                },
            );

            if (!res.ok) throw new Error('Falha ao atualizar canais');
            const data = await res.json();

            toast.success('Canais atualizados com sucesso!');

            // Atualizar store na lista
            setStores((prev) =>
                prev.map((s) =>
                    s.id === editingStoreId
                        ? { ...s, excluded_channels: selectedChannels }
                        : s,
                ),
            );

            closeChannelsDialog();
        } catch (e) {
            console.error(e);
            toast.error('Erro ao atualizar canais.');
        } finally {
            setLoading(false);
        }
    }

    function toggleChannel(channel: string) {
        setSelectedChannels((prev) =>
            prev.includes(channel)
                ? prev.filter((c) => c !== channel)
                : [...prev, channel],
        );
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
                                Conecte seu PDV Takeat para importar pedidos de
                                todos os canais de venda.
                            </DrawerDescription>
                        </DrawerHeader>

                        <div className="p-4 pb-0">
                            <div className="mb-4 rounded-lg bg-blue-50 p-3 dark:bg-blue-950/20">
                                <p className="text-sm text-blue-900 dark:text-blue-100">
                                    <strong>🔒 Reconexão automática:</strong>{' '}
                                    Suas credenciais são criptografadas e
                                    salvas. O sistema reconecta automaticamente
                                    antes da expiração (15 dias). Só será
                                    necessário reconectar manualmente se a senha
                                    for alterada.
                                </p>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                Com a integração com o Takeat você importa
                                pedidos de iFood, 99Food, Keeta, PDV e outros
                                canais em um só lugar. Configure quais canais
                                deseja filtrar para evitar duplicação.
                            </p>

                            <Separator className="my-4" />

                            <p className="mb-2 text-gray-600">
                                Restaurantes conectados:
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
                                                    : 'bg-card'
                                            }`}
                                        >
                                            <div className="flex-1">
                                                <h3 className="flex items-center gap-2 text-sm font-medium">
                                                    {store.token_expired && (
                                                        <AlertCircle className="h-4 w-4 text-red-600" />
                                                    )}
                                                    <span>
                                                        {store.display_name}
                                                    </span>
                                                </h3>
                                                {store.token_expired && (
                                                    <p className="text-xs text-red-700 dark:text-red-400">
                                                        Token expirado -
                                                        Credenciais inválidas
                                                    </p>
                                                )}
                                                {store.excluded_channels &&
                                                    store.excluded_channels
                                                        .length > 0 && (
                                                        <p className="text-xs text-muted-foreground">
                                                            Excluindo:{' '}
                                                            {store.excluded_channels
                                                                .map(
                                                                    (ch) =>
                                                                        AVAILABLE_CHANNELS.find(
                                                                            (
                                                                                c,
                                                                            ) =>
                                                                                c.value ===
                                                                                ch,
                                                                        )
                                                                            ?.label ||
                                                                        ch,
                                                                )
                                                                .join(', ')}
                                                        </p>
                                                    )}
                                            </div>

                                            <div className="flex items-center gap-1">
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => {
                                                                setLoginDialogOpen(
                                                                    true,
                                                                );
                                                                setEmail('');
                                                                setPassword('');
                                                            }}
                                                        >
                                                            <LogIn className="h-4 w-4" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>Reconectar loja</p>
                                                    </TooltipContent>
                                                </Tooltip>

                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() =>
                                                                openChannelsDialog(
                                                                    store,
                                                                )
                                                            }
                                                        >
                                                            <RotateCcw className="h-4 w-4" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>Configurar canais</p>
                                                    </TooltipContent>
                                                </Tooltip>

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
                                                        <p>Excluir</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-sm text-gray-500">
                                    Nenhum restaurante integrado ainda.
                                </p>
                            )}
                        </div>

                        <DrawerFooter>
                            <Button
                                variant="outline"
                                className="w-full"
                                onClick={() => setLoginDialogOpen(true)}
                            >
                                <Plus className="mr-2" />
                                Adicionar restaurante Takeat
                            </Button>
                        </DrawerFooter>
                    </div>
                </DrawerContent>
            </Drawer>

            {/* Dialog de Login */}
            <Dialog open={loginDialogOpen} onOpenChange={setLoginDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Login Takeat</DialogTitle>
                        <DialogDescription>
                            Entre com suas credenciais do Takeat para integrar
                            seu restaurante.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">E-mail</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="usuario@dominio.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password">Senha</Label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            onClick={handleLogin}
                            disabled={loading}
                            className="w-full"
                        >
                            <LogIn className="mr-2 h-4 w-4" />
                            {loading ? 'Autenticando...' : 'Entrar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog de Configuração de Canais */}
            <Dialog
                open={channelsDialogOpen}
                onOpenChange={setChannelsDialogOpen}
            >
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Configurar Canais</DialogTitle>
                        <DialogDescription>
                            Selecione os canais que você NÃO deseja importar do
                            Takeat (para evitar duplicação).
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {AVAILABLE_CHANNELS.map((channel) => (
                            <div
                                key={channel.value}
                                className="flex items-center space-x-2"
                            >
                                <Checkbox
                                    id={channel.value}
                                    checked={selectedChannels.includes(
                                        channel.value,
                                    )}
                                    onCheckedChange={() =>
                                        toggleChannel(channel.value)
                                    }
                                />
                                <label
                                    htmlFor={channel.value}
                                    className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                >
                                    Excluir {channel.label}
                                </label>
                            </div>
                        ))}

                        {selectedChannels.length > 0 && (
                            <div className="rounded-lg border bg-muted/50 p-3">
                                <p className="text-xs text-muted-foreground">
                                    <strong>Importante:</strong> Pedidos desses
                                    canais não serão importados do Takeat. Use
                                    isso se já integrou diretamente com esses
                                    marketplaces.
                                </p>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="outline">Cancelar</Button>
                        </DialogClose>
                        <Button
                            onClick={handleUpdateChannels}
                            disabled={loading}
                        >
                            {loading ? 'Salvando...' : 'Salvar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog de Exclusão */}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Remover restaurante</DialogTitle>
                        <DialogDescription>
                            Tem certeza que deseja remover{' '}
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
