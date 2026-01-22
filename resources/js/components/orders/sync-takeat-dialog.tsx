import { Button } from '@/components/ui/button';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, CalendarIcon } from 'lucide-react';
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
    const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(
        new Date(),
    );
    const [isSyncing, setIsSyncing] = React.useState(false);
    const [isCalendarOpen, setIsCalendarOpen] = React.useState(false);

    const handleSync = async () => {
        if (!selectedDate) {
            toast.error('Selecione uma data');
            return;
        }

        setIsSyncing(true);

        try {
            const dateString = format(selectedDate, 'yyyy-MM-dd');
            const response = await fetch('/takeat/sync/date', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN':
                        document
                            .querySelector('meta[name="csrf-token"]')
                            ?.getAttribute('content') || '',
                },
                body: JSON.stringify({ date: dateString }),
            });

            // Verificar status ANTES de fazer parse JSON
            if (response.status === 419) {
                toast.error('Sessão expirada. Recarregando a página...', {
                    duration: 3000,
                });
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
                return;
            }

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Erro ao sincronizar');
            }

            toast.info('Sincronização iniciada!', {
                description:
                    'Os pedidos aparecerão automaticamente quando a sincronização terminar.',
            });
            onOpenChange(false);

            // Não recarregar - os pedidos virão via WebSocket
        } catch (error: any) {
            // Se não foi tratado acima (ex: erro de rede), mostrar mensagem genérica
            if (error.message !== 'Sessão expirada. Recarregando a página...') {
                toast.error(
                    error.message ||
                        'Erro ao sincronizar pedidos. Tente novamente.',
                );
            }
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
                        <Label>Data</Label>
                        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    className={cn(
                                        'w-full justify-start text-left font-normal',
                                        !selectedDate &&
                                            'text-muted-foreground',
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {selectedDate ? (
                                        format(
                                            selectedDate,
                                            "dd 'de' MMMM 'de' yyyy",
                                            {
                                                locale: ptBR,
                                            },
                                        )
                                    ) : (
                                        <span>Selecione uma data</span>
                                    )}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent
                                className="w-auto p-0"
                                align="start"
                            >
                                <CalendarComponent
                                    mode="single"
                                    selected={selectedDate}
                                    onSelect={(date) => {
                                        setSelectedDate(date);
                                        setIsCalendarOpen(false); // Fecha após selecionar
                                    }}
                                    disabled={(date) =>
                                        date > new Date() ||
                                        date < new Date('1900-01-01')
                                    }
                                    locale={ptBR}
                                    defaultMonth={selectedDate}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>
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
