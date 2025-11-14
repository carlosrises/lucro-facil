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
import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

interface PasswordDisplayDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    email: string;
    password: string;
}

export function PasswordDisplayDialog({
    open,
    onOpenChange,
    email,
    password,
}: PasswordDisplayDialogProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(password);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-[550px]">
                <DialogHeader>
                    <DialogTitle>Cliente Criado com Sucesso!</DialogTitle>
                    <DialogDescription>
                        Anote a senha gerada. Ela não será mostrada novamente.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 overflow-y-auto pr-2">
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
                        <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                            ⚠️ Importante
                        </p>
                        <p className="text-sm text-amber-700 dark:text-amber-300">
                            Copie e envie esta senha para o cliente. Por
                            segurança, ela não será exibida novamente.
                        </p>
                    </div>

                    <div className="grid gap-2">
                        <Label>E-mail de acesso</Label>
                        <Input value={email} readOnly className="font-mono" />
                    </div>

                    <div className="grid gap-2">
                        <Label>Senha temporária</Label>
                        <div className="flex gap-2">
                            <Input
                                value={password}
                                readOnly
                                className="font-mono"
                            />
                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={handleCopy}
                            >
                                {copied ? (
                                    <Check className="h-4 w-4 text-green-600" />
                                ) : (
                                    <Copy className="h-4 w-4" />
                                )}
                            </Button>
                        </div>
                    </div>

                    <div className="rounded-lg border p-4">
                        <p className="text-sm text-muted-foreground">
                            O cliente deve fazer login em{' '}
                            <span className="font-mono font-medium">
                                {window.location.origin}/login
                            </span>{' '}
                            usando o e-mail e senha acima. Recomendamos que ele
                            altere a senha no primeiro acesso.
                        </p>
                    </div>
                </div>

                <DialogFooter>
                    <Button onClick={() => onOpenChange(false)}>Entendi</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
