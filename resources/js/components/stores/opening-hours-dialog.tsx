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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Loader2, Save } from 'lucide-react';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

type DayOfWeek =
    | 'MONDAY'
    | 'TUESDAY'
    | 'WEDNESDAY'
    | 'THURSDAY'
    | 'FRIDAY'
    | 'SATURDAY'
    | 'SUNDAY';

type Shift = {
    dayOfWeek: DayOfWeek;
    openingTime: string;
    closingTime: string;
};

type ApiShift = {
    dayOfWeek: DayOfWeek;
    start: string;
    duration: number;
};

type OpeningHoursDialogProps = {
    storeId: number;
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

const daysOfWeekMap: Record<DayOfWeek, string> = {
    MONDAY: 'Segunda-feira',
    TUESDAY: 'Terça-feira',
    WEDNESDAY: 'Quarta-feira',
    THURSDAY: 'Quinta-feira',
    FRIDAY: 'Sexta-feira',
    SATURDAY: 'Sábado',
    SUNDAY: 'Domingo',
};

const daysOrder: DayOfWeek[] = [
    'MONDAY',
    'TUESDAY',
    'WEDNESDAY',
    'THURSDAY',
    'FRIDAY',
    'SATURDAY',
    'SUNDAY',
];

export function OpeningHoursDialog({
    storeId,
    open,
    onOpenChange,
}: OpeningHoursDialogProps) {
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const loadOpeningHours = useCallback(async () => {
        setLoading(true);
        try {
            const response = await fetch(`/stores/${storeId}/opening-hours`);
            const data = await response.json();

            if (data.success) {
                // Converter formato da API (start/duration) para formato do frontend (openingTime/closingTime)
                const shiftsFromApi = data.data?.shifts || [];
                const convertedShifts = shiftsFromApi.map((shift: ApiShift) => {
                    // Remover segundos do start se existirem
                    const start = shift.start.substring(0, 5); // "14:00:00" -> "14:00"

                    // Calcular closingTime baseado em start + duration
                    const [startHour, startMin] = start.split(':').map(Number);
                    const startMinutes = startHour * 60 + startMin;
                    const closeMinutes = startMinutes + shift.duration;

                    const closeHour = Math.floor(closeMinutes / 60);
                    const closeMin = closeMinutes % 60;
                    const closingTime = `${String(closeHour).padStart(2, '0')}:${String(closeMin).padStart(2, '0')}`;

                    return {
                        dayOfWeek: shift.dayOfWeek,
                        openingTime: start,
                        closingTime: closingTime,
                    };
                });

                setShifts(convertedShifts);
            } else {
                toast.error('Erro ao carregar horários', {
                    description: data.message,
                });
            }
        } catch {
            toast.error('Erro ao carregar horários', {
                description: 'Ocorreu um erro inesperado',
            });
        } finally {
            setLoading(false);
        }
    }, [storeId]);

    useEffect(() => {
        if (open) {
            loadOpeningHours();
        }
    }, [open, loadOpeningHours]);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            // Converter formato de openingTime/closingTime para start/duration
            const shiftsForApi = shifts.map((shift) => {
                const [openHour, openMin] = shift.openingTime
                    .split(':')
                    .map(Number);
                const [closeHour, closeMin] = shift.closingTime
                    .split(':')
                    .map(Number);

                // Calcular duração em minutos
                const openMinutes = openHour * 60 + openMin;
                const closeMinutes = closeHour * 60 + closeMin;
                const duration = closeMinutes - openMinutes;

                return {
                    dayOfWeek: shift.dayOfWeek,
                    start: `${shift.openingTime}:00`, // Adicionar segundos
                    duration: duration,
                };
            });

            const response = await fetch(`/stores/${storeId}/opening-hours`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN':
                        document
                            .querySelector('meta[name="csrf-token"]')
                            ?.getAttribute('content') || '',
                },
                body: JSON.stringify({ shifts: shiftsForApi }),
            });

            const data = await response.json();

            if (data.success) {
                toast.success('Horários atualizados', {
                    description:
                        'Horários de funcionamento atualizados com sucesso',
                });
                onOpenChange(false);
            } else {
                toast.error('Erro ao atualizar horários', {
                    description: data.message,
                });
            }
        } catch {
            toast.error('Erro ao atualizar horários', {
                description: 'Ocorreu um erro inesperado',
            });
        } finally {
            setSubmitting(false);
        }
    };

    const updateShift = (
        day: DayOfWeek,
        field: 'openingTime' | 'closingTime',
        value: string,
    ) => {
        setShifts((prev) => {
            const existingShift = prev.find((s) => s.dayOfWeek === day);

            if (existingShift) {
                return prev.map((s) =>
                    s.dayOfWeek === day ? { ...s, [field]: value } : s,
                );
            } else {
                return [
                    ...prev,
                    {
                        dayOfWeek: day,
                        openingTime: field === 'openingTime' ? value : '00:00',
                        closingTime: field === 'closingTime' ? value : '23:59',
                    },
                ];
            }
        });
    };

    const getShiftForDay = (day: DayOfWeek) => {
        return shifts.find((s) => s.dayOfWeek === day);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Horários de Funcionamento</DialogTitle>
                    <DialogDescription>
                        Configure os horários de abertura e fechamento da loja
                    </DialogDescription>
                </DialogHeader>

                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Dia da Semana</TableHead>
                                        <TableHead>Abertura</TableHead>
                                        <TableHead>Fechamento</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {daysOrder.map((day) => {
                                        const shift = getShiftForDay(day);
                                        return (
                                            <TableRow key={day}>
                                                <TableCell className="font-medium">
                                                    {daysOfWeekMap[day]}
                                                </TableCell>
                                                <TableCell>
                                                    <Input
                                                        type="time"
                                                        value={
                                                            shift?.openingTime ||
                                                            ''
                                                        }
                                                        onChange={(e) =>
                                                            updateShift(
                                                                day,
                                                                'openingTime',
                                                                e.target.value,
                                                            )
                                                        }
                                                        className="max-w-[150px]"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Input
                                                        type="time"
                                                        value={
                                                            shift?.closingTime ||
                                                            ''
                                                        }
                                                        onChange={(e) =>
                                                            updateShift(
                                                                day,
                                                                'closingTime',
                                                                e.target.value,
                                                            )
                                                        }
                                                        className="max-w-[150px]"
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                            >
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={submitting}>
                                {submitting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Salvando...
                                    </>
                                ) : (
                                    <>
                                        <Save className="mr-2 h-4 w-4" />
                                        Salvar
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
