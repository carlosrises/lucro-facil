import { endOfMonth, format, startOfMonth, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarIcon } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';

import { DateRange } from 'react-day-picker';

interface DateRangePickerProps {
    value?: DateRange;
    onChange?: (range: DateRange | undefined) => void;
}

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
    const [range, setRange] = React.useState<DateRange | undefined>(value);

    const handleChange = (selected: DateRange | undefined) => {
        setRange(selected);
        // Só dispara onChange quando tiver ambas as datas selecionadas (from e to)
        if (selected?.from && selected?.to) {
            onChange?.(selected);
        }
    };

    const presets = [
        {
            label: 'Hoje',
            range: {
                from: new Date(),
                to: new Date(),
            },
        },
        {
            label: 'Ontem',
            range: {
                from: subDays(new Date(), 1),
                to: subDays(new Date(), 1),
            },
        },
        {
            label: 'Últimos 7 dias',
            range: {
                from: subDays(new Date(), 6),
                to: new Date(),
            },
        },
        {
            label: 'Últimos 15 dias',
            range: {
                from: subDays(new Date(), 14),
                to: new Date(),
            },
        },
        {
            label: 'Últimos 30 dias',
            range: {
                from: subDays(new Date(), 29),
                to: new Date(),
            },
        },
        {
            label: 'Este mês',
            range: {
                from: startOfMonth(new Date()),
                to: endOfMonth(new Date()),
            },
        },
        {
            label: 'Mês passado',
            range: {
                from: startOfMonth(subDays(new Date(), new Date().getDate())),
                to: endOfMonth(subDays(new Date(), new Date().getDate())),
            },
        },
    ];

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    id="date"
                    variant={'outline'}
                    className={`h-9 w-[240px] justify-start text-left font-normal ${
                        !range && 'text-muted-foreground'
                    }`}
                >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {range?.from ? (
                        range.to ? (
                            <>
                                {format(range.from, 'dd/MM/yyyy', {
                                    locale: ptBR,
                                })}{' '}
                                -{' '}
                                {format(range.to, 'dd/MM/yyyy', {
                                    locale: ptBR,
                                })}
                            </>
                        ) : (
                            format(range.from, 'dd/MM/yyyy', { locale: ptBR })
                        )
                    ) : (
                        <span>Selecionar período</span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <div className="flex gap-2 p-3">
                    {/* 📌 Presets */}
                    <div className="flex flex-col justify-center gap-2">
                        {presets.map((preset) => (
                            <Button
                                key={preset.label}
                                variant="outline"
                                size="sm"
                                onClick={() => handleChange(preset.range)}
                            >
                                {preset.label}
                            </Button>
                        ))}
                    </div>

                    {/* 📅 Calendário */}
                    <Calendar
                        mode="range"
                        selected={range}
                        onSelect={handleChange}
                        locale={ptBR}
                        numberOfMonths={2}
                        defaultMonth={range?.from || new Date()}
                    />
                </div>
            </PopoverContent>
        </Popover>
    );
}
