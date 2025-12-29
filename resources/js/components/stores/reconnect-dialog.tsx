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

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);

        try {
            let endpoint = '';

            if (provider === 'takeat') {
                endpoint = '/api/takeat/login';
            } else if (provider === 'ifood') {
                endpoint = '/api/ifood/auth';
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
            onOpenChange(false);
            setEmail('');
            setPassword('');

            // Recarregar a página para atualizar os dados
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

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
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

                <form onSubmit={handleSubmit} className="space-y-4">
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
                            onClick={() => onOpenChange(false)}
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
