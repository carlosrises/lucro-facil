import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { router } from '@inertiajs/react';
import { ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

type ReconnectDialogProps = {
    storeId: number;
    provider: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

export function ReconnectDialog({
    storeId,
    provider,
    open,
    onOpenChange,
}: ReconnectDialogProps) {
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    // Estados para fluxo OAuth do iFood
    const [authData, setAuthData] = useState<{
        userCode: string;
        verificationUrl: string;
        verificationUrlComplete: string;
        authorizationCodeVerifier: string;
    } | null>(null);
    const [authorizationCode, setAuthorizationCode] = useState('');
    const [step, setStep] = useState<'initial' | 'instructions'>('initial');

    // Reset ao fechar
    function handleOpenChange(open: boolean) {
        if (!open) {
            setStep('initial');
            setAuthData(null);
            setAuthorizationCode('');
            setEmail('');
            setPassword('');
        }
        onOpenChange(open);
    }

    // Fluxo OAuth iFood (Step 1: Gerar userCode)
    async function handleIfoodOAuth() {
        setLoading(true);
        try {
            const res = await fetch(
                '/api/ifood/authentication/v1.0/oauth/userCode',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': (
                            document.querySelector(
                                'meta[name="csrf-token"]',
                            ) as HTMLMetaElement
                        ).content,
                    },
                },
            );

            const data = await res.json();

            if (!res.ok || !data.userCode) {
                throw new Error(
                    data.message || 'Erro ao gerar código de autorização',
                );
            }

            setAuthData({
                userCode: data.userCode,
                verificationUrl: data.verificationUrl,
                verificationUrlComplete: data.verificationUrlComplete,
                authorizationCodeVerifier: data.authorizationCodeVerifier,
            });
            setStep('instructions');

            // Abrir URL automaticamente
            window.open(data.verificationUrlComplete, '_blank');
        } catch (error) {
            console.error(error);
            toast.error(
                error instanceof Error
                    ? error.message
                    : 'Erro ao iniciar reconexão iFood',
            );
        } finally {
            setLoading(false);
        }
    }

    // Fluxo OAuth iFood (Step 2: Finalizar com código)
    async function handleIfoodFinalize() {
        if (!authorizationCode || !authData) {
            toast.error('Código de autorização não informado');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(
                '/api/ifood/authentication/v1.0/oauth/token',
                {
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
                        code_verifier: authData.authorizationCodeVerifier,
                    }),
                },
            );

            const data = await res.json();

            if (!res.ok || !data.success) {
                throw new Error(data.message || 'Erro ao reconectar');
            }

            toast.success('Loja iFood reconectada com sucesso!');
            handleOpenChange(false);
            router.reload();
        } catch (error) {
            console.error(error);
            toast.error(
                error instanceof Error
                    ? error.message
                    : 'Erro ao reconectar. Verifique o código.',
            );
        } finally {
            setLoading(false);
        }
    }

    // Fluxo email/senha para Takeat e 99food
    async function handleEmailPasswordSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);

        try {
            let endpoint = '';

            if (provider === 'takeat') {
                endpoint = '/api/takeat/login';
            } else if (provider === '99food') {
                endpoint = '/api/99food/login';
            } else {
                toast.error('Provider não suportado');
                return;
            }

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': (
                        document.querySelector(
                            'meta[name="csrf-token"]',
                        ) as HTMLMetaElement
                    ).content,
                },
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
                throw new Error(data.message || 'Erro ao reconectar');
            }

            toast.success('Loja reconectada com sucesso!');
            handleOpenChange(false);
            setEmail('');
            setPassword('');
            router.reload();
        } catch (error) {
            console.error(error);
            toast.error(
                error instanceof Error
                    ? error.message
                    : 'Erro ao reconectar. Verifique suas credenciais.',
            );
        } finally {
            setLoading(false);
        }
    }

    // Renderizar conteúdo baseado no provider
    if (provider === 'ifood') {
        if (step === 'initial') {
            return (
                <Dialog open={open} onOpenChange={handleOpenChange}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Reconectar iFood</DialogTitle>
                            <DialogDescription>
                                Clique no botão abaixo para iniciar o processo
                                de reconexão via OAuth.
                            </DialogDescription>
                        </DialogHeader>

                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => handleOpenChange(false)}
                                disabled={loading}
                            >
                                Cancelar
                            </Button>
                            <Button
                                onClick={handleIfoodOAuth}
                                disabled={loading}
                            >
                                {loading
                                    ? 'Gerando código...'
                                    : 'Iniciar reconexão'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            );
        }

        // Step: instructions (OAuth)
        return (
            <Dialog open={open} onOpenChange={handleOpenChange}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Autorizar iFood</DialogTitle>
                        <DialogDescription>
                            Siga as instruções abaixo para reconectar sua loja
                            iFood
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="rounded-lg border bg-muted/50 p-4">
                            <h4 className="mb-2 font-semibold">
                                Passo 1: Acesse o site do iFood
                            </h4>
                            <p className="mb-3 text-sm text-muted-foreground">
                                Clique no botão abaixo para abrir a página de
                                autorização do iFood. Uma nova aba será aberta.
                            </p>
                            <Button
                                variant="outline"
                                className="w-full"
                                onClick={() =>
                                    window.open(
                                        authData?.verificationUrlComplete,
                                        '_blank',
                                    )
                                }
                            >
                                <ExternalLink className="mr-2 h-4 w-4" />
                                Abrir página do iFood
                            </Button>
                        </div>

                        <div className="rounded-lg border bg-muted/50 p-4">
                            <h4 className="mb-2 font-semibold">
                                Passo 2: Insira o código
                            </h4>
                            <p className="mb-3 text-sm text-muted-foreground">
                                Na página do iFood, insira o código abaixo
                                quando solicitado:
                            </p>
                            <div className="flex items-center gap-2">
                                <code className="flex-1 rounded bg-background px-3 py-2 text-center font-mono text-xl font-bold tracking-wider">
                                    {authData?.userCode}
                                </code>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        navigator.clipboard.writeText(
                                            authData?.userCode || '',
                                        );
                                        toast.success('Código copiado!');
                                    }}
                                >
                                    Copiar
                                </Button>
                            </div>
                        </div>

                        <div className="rounded-lg border bg-muted/50 p-4">
                            <h4 className="mb-2 font-semibold">
                                Passo 3: Cole o código de autorização
                            </h4>
                            <p className="mb-3 text-sm text-muted-foreground">
                                Após autorizar no site do iFood, você receberá
                                um código de autorização. Cole-o abaixo:
                            </p>
                            <Input
                                placeholder="Cole o código de autorização aqui"
                                value={authorizationCode}
                                onChange={(e) =>
                                    setAuthorizationCode(e.target.value)
                                }
                                className="font-mono"
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setStep('initial');
                                setAuthData(null);
                                setAuthorizationCode('');
                            }}
                            disabled={loading}
                        >
                            Voltar
                        </Button>
                        <Button
                            onClick={handleIfoodFinalize}
                            disabled={loading || !authorizationCode}
                        >
                            {loading ? 'Conectando...' : 'Finalizar reconexão'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    }

    // Fluxo padrão para Takeat e 99food (email/senha)
    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        Reconectar {provider.toUpperCase()}
                    </DialogTitle>
                    <DialogDescription>
                        Faça login novamente para atualizar o token de
                        autenticação da loja.
                    </DialogDescription>
                </DialogHeader>

                <form
                    onSubmit={handleEmailPasswordSubmit}
                    className="space-y-4"
                >
                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="seu@email.com"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="password">Senha</Label>
                        <Input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleOpenChange(false)}
                            disabled={loading}
                        >
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? 'Conectando...' : 'Reconectar'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
