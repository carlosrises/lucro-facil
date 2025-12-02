import { Button } from '@/components/ui/button';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, CalendarIcon, X } from 'lucide-react';
import * as React from 'react';

interface MonthYearPickerProps {
    value?: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
}

const months = [
    'Jan.',
    'Fev.',
    'Mar.',
    'Abr.',
    'Mai.',
    'Jun.',
    'Jul.',
    'Ago.',
    'Set.',
    'Out.',
    'Nov.',
    'Dez.',
];

export function MonthYearPicker({
    value,
    onChange,
    placeholder = 'Selecione o mês',
    className,
}: MonthYearPickerProps) {
    const [open, setOpen] = React.useState(false);
    const [selectedYear, setSelectedYear] = React.useState<number>(
        value ? parseInt(value.split('-')[0]) : new Date().getFullYear(),
    );
    const [selectedMonth, setSelectedMonth] = React.useState<number | null>(
        value ? parseInt(value.split('-')[1]) - 1 : null,
    );

    const handleMonthSelect = (monthIndex: number) => {
        setSelectedMonth(monthIndex);
        const month = String(monthIndex + 1).padStart(2, '0');
        onChange(`${selectedYear}-${month}`);
        setOpen(false);
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedMonth(null);
        onChange('');
    };

    const getDisplayText = () => {
        if (selectedMonth === null) return placeholder;
        return `${months[selectedMonth]} ${selectedYear}`;
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    className={cn(
                        'h-9 justify-start text-left font-normal',
                        selectedMonth === null && 'text-muted-foreground',
                        className,
                    )}
                >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {getDisplayText()}
                    {selectedMonth !== null && (
                        <X
                            className="ml-auto h-4 w-4 opacity-50 hover:opacity-100"
                            onClick={handleClear}
                        />
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-4" align="start">
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setSelectedYear(selectedYear - 1)}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <div className="font-semibold">{selectedYear}</div>
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setSelectedYear(selectedYear + 1)}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        {months.map((month, index) => (
                            <Button
                                key={month}
                                variant={
                                    selectedMonth === index
                                        ? 'default'
                                        : 'outline'
                                }
                                className="h-9"
                                onClick={() => handleMonthSelect(index)}
                            >
                                {month}
                            </Button>
                        ))}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
