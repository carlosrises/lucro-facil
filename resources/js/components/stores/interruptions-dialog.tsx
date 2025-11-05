import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

type Interruption = {
    id: string;
    description: string;
    start: string;
    end: string;
};

type InterruptionsDialogProps = {
    storeId: number;
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

export function InterruptionsDialog({
    storeId,
    open,
    onOpenChange,
}: InterruptionsDialogProps) {
    const [interruptions, setInterruptions] = useState<Interruption[]>([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [interruptionToDelete, setInterruptionToDelete] = useState<
        string | null
    >(null);

    const [formData, setFormData] = useState({
        description: '',
        start: '',
        end: '',
    });

    const loadInterruptions = useCallback(async () => {
        setLoading(true);
        try {
            const response = await fetch(`/stores/${storeId}/interruptions`);
            const data = await response.json();

            if (data.success) {
                setInterruptions(data.data || []);
            } else {
                toast.error('Erro ao carregar interrupções', {
                    description: data.message,
                });
            }
        } catch {
            toast.error('Erro ao carregar interrupções', {
                description: 'Ocorreu um erro inesperado',
            });
        } finally {
            setLoading(false);
        }
    }, [storeId]);

    useEffect(() => {
        if (open) {
            loadInterruptions();
        }
    }, [open, loadInterruptions]);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            // Converter datetime-local para ISO 8601
            const startISO = new Date(formData.start).toISOString();
            const endISO = new Date(formData.end).toISOString();

            const response = await fetch(`/stores/${storeId}/interruptions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN':
                        document
                            .querySelector('meta[name="csrf-token"]')
                            ?.getAttribute('content') || '',
                },
                body: JSON.stringify({
                    description: formData.description,
                    start: startISO,
                    end: endISO,
                }),
            });

            const data = await response.json();

            if (data.success) {
                toast.success('Interrupção criada', {
                    description: 'Interrupção criada com sucesso',
                });
                setFormData({ description: '', start: '', end: '' });
                loadInterruptions();
            } else {
                toast.error('Erro ao criar interrupção', {
                    description: data.message,
                });
            }
        } catch {
            toast.error('Erro ao criar interrupção', {
                description: 'Ocorreu um erro inesperado',
            });
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (interruptionId: string) => {
        setInterruptionToDelete(interruptionId);
        setDeleteDialogOpen(true);
    };

    const confirmDelete = async () => {
        if (!interruptionToDelete) return;

        try {
            const response = await fetch(
                `/stores/${storeId}/interruptions/${interruptionToDelete}`,
                {
                    method: 'DELETE',
                    headers: {
                        'X-CSRF-TOKEN':
                            document
                                .querySelector('meta[name="csrf-token"]')
                                ?.getAttribute('content') || '',
                    },
                },
            );

            const data = await response.json();

            if (data.success) {
                toast.success('Interrupção removida', {
                    description: 'Interrupção removida com sucesso',
                });
                loadInterruptions();
            } else {
                toast.error('Erro ao remover interrupção', {
                    description: data.message,
                });
            }
        } catch {
            toast.error('Erro ao remover interrupção', {
                description: 'Ocorreu um erro inesperado',
            });
        } finally {
            setDeleteDialogOpen(false);
            setInterruptionToDelete(null);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Gerenciar Interrupções</DialogTitle>
                    <DialogDescription>
                        Crie e gerencie interrupções de funcionamento da loja
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Form para criar nova interrupção */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="description">Descrição</Label>
                                <Input
                                    id="description"
                                    value={formData.description}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            description: e.target.value,
                                        })
                                    }
                                    placeholder="Ex: Manutenção programada"
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="start">Início</Label>
                                    <Input
                                        id="start"
                                        type="datetime-local"
                                        value={formData.start}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                start: e.target.value,
                                            })
                                        }
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="end">Fim</Label>
                                    <Input
                                        id="end"
                                        type="datetime-local"
                                        value={formData.end}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                end: e.target.value,
                                            })
                                        }
                                        required
                                    />
                                </div>
                            </div>
                        </div>
                        <Button
                            type="submit"
                            disabled={submitting}
                            className="w-full"
                        >
                            {submitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Criando...
                                </>
                            ) : (
                                <>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Criar Interrupção
                                </>
                            )}
                        </Button>
                    </form>

                    {/* Lista de interrupções existentes */}
                    <div className="space-y-2">
                        <h3 className="text-sm font-medium">
                            Interrupções Ativas
                        </h3>
                        {loading ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : interruptions.length === 0 ? (
                            <p className="py-8 text-center text-xs text-muted-foreground">
                                Nenhuma interrupção cadastrada
                            </p>
                        ) : (
                            <div className="overflow-y-auto rounded-md border">
                                <Table className="text-xs">
                                    <TableHeader className="sticky top-0 bg-background">
                                        <TableRow>
                                            <TableHead>Descrição</TableHead>
                                            <TableHead>Início</TableHead>
                                            <TableHead>Fim</TableHead>
                                            <TableHead></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {interruptions.map((interruption) => (
                                            <TableRow key={interruption.id}>
                                                <TableCell>
                                                    {interruption.description}
                                                </TableCell>
                                                <TableCell>
                                                    {new Date(
                                                        interruption.start,
                                                    ).toLocaleString('pt-BR', {
                                                        dateStyle: 'short',
                                                        timeStyle: 'short',
                                                    })}
                                                </TableCell>
                                                <TableCell>
                                                    {new Date(
                                                        interruption.end,
                                                    ).toLocaleString('pt-BR', {
                                                        dateStyle: 'short',
                                                        timeStyle: 'short',
                                                    })}
                                                </TableCell>
                                                <TableCell>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() =>
                                                            handleDelete(
                                                                interruption.id,
                                                            )
                                                        }
                                                    >
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        Fechar
                    </Button>
                </DialogFooter>
            </DialogContent>

            <AlertDialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                        <AlertDialogDescription>
                            Deseja realmente remover esta interrupção? Esta ação
                            não pode ser desfeita.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDelete}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Remover
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Dialog>
    );
}
