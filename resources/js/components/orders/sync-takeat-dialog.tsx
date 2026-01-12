import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { router } from '@inertiajs/react';
import { Calendar } from 'lucide-react';
import React from 'react';
import { toast } from 'sonner';

interface SyncTakeatDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function SyncTakeatDialog({
    open,
    onOpenChange,
}: SyncTakeatDialogProps) {
    const [selectedDate, setSelectedDate] = React.useState<string>(
        new Date().toISOString().split('T')[0],
    );
    const [isSyncing, setIsSyncing] = React.useState(false);

    const handleSync = async () => {
        if (!selectedDate) {
            toast.error('Selecione uma data');
            return;
        }

        setIsSyncing(true);

        try {
            const response = await fetch('/takeat/sync/date', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN':
                        document
                            .querySelector('meta[name="csrf-token"]')
                            ?.getAttribute('content') || '',
                },
                body: JSON.stringify({ date: selectedDate }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Erro ao sincronizar');
            }

            toast.success('Pedidos sincronizados com sucesso!');
            onOpenChange(false);

            // Recarregar a página de pedidos
            router.reload({ only: ['orders'] });
        } catch (error: any) {
            toast.error(
                error.message ||
                    'Erro ao sincronizar pedidos. Tente novamente.',
            );
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Sincronizar Pedidos Takeat</DialogTitle>
                    <DialogDescription>
                        Selecione uma data para sincronizar os pedidos do
                        Takeat. Isso pode levar alguns segundos.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="sync-date">Data</Label>
                        <div className="relative">
                            <input
                                id="sync-date"
                                type="date"
                                value={selectedDate}
                                onChange={(e) =>
                                    setSelectedDate(e.target.value)
                                }
                                max={new Date().toISOString().split('T')[0]}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                            />
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Sincroniza todos os pedidos do dia selecionado
                        </p>
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isSyncing}
                    >
                        Cancelar
                    </Button>
                    <Button onClick={handleSync} disabled={isSyncing}>
                        {isSyncing ? (
                            <>
                                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                Sincronizando...
                            </>
                        ) : (
                            <>
                                <Calendar className="mr-2 h-4 w-4" />
                                Sincronizar
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// Ícone RefreshCw para animação de loading
function RefreshCw({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
            <path d="M3 21v-5h5" />
        </svg>
    );
}
