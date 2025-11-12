import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Check, Palette } from 'lucide-react';

interface ColorPickerProps {
    value: string;
    onChange: (color: string) => void;
}

const PRESET_COLORS = [
    { name: 'Vermelho', value: '#ef4444' },
    { name: 'Laranja', value: '#f97316' },
    { name: 'Amarelo', value: '#eab308' },
    { name: 'Verde', value: '#22c55e' },
    { name: 'Azul', value: '#3b82f6' },
    { name: 'Roxo', value: '#a855f7' },
    { name: 'Rosa', value: '#ec4899' },
    { name: 'Cinza', value: '#6b7280' },
    { name: 'Ciano', value: '#06b6d4' },
    { name: 'Indigo', value: '#6366f1' },
    { name: 'Lime', value: '#84cc16' },
    { name: 'Âmbar', value: '#f59e0b' },
];

export function ColorPicker({ value, onChange }: ColorPickerProps) {
    return (
        <div className="flex gap-2">
            <Popover>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        className="w-full justify-start gap-2"
                        type="button"
                    >
                        <div
                            className="h-4 w-4 rounded border"
                            style={{ backgroundColor: value }}
                        />
                        <span className="flex-1 text-left">
                            {PRESET_COLORS.find((c) => c.value === value)
                                ?.name || 'Cor personalizada'}
                        </span>
                        <Palette className="h-4 w-4 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64" align="start">
                    <div className="space-y-3">
                        <div>
                            <Label className="text-xs text-muted-foreground">
                                Cores predefinidas
                            </Label>
                            <div className="mt-2 grid grid-cols-6 gap-2">
                                {PRESET_COLORS.map((color) => (
                                    <button
                                        key={color.value}
                                        type="button"
                                        onClick={() => onChange(color.value)}
                                        className={cn(
                                            'group relative h-8 w-8 rounded border-2 transition-all hover:scale-110',
                                            value === color.value
                                                ? 'border-foreground ring-2 ring-foreground/20'
                                                : 'border-transparent hover:border-foreground/50',
                                        )}
                                        style={{ backgroundColor: color.value }}
                                        title={color.name}
                                    >
                                        {value === color.value && (
                                            <Check className="absolute inset-0 m-auto h-4 w-4 text-white drop-shadow" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <Label
                                htmlFor="custom-color"
                                className="text-xs text-muted-foreground"
                            >
                                Cor personalizada
                            </Label>
                            <div className="mt-2 flex gap-2">
                                <Input
                                    id="custom-color"
                                    type="color"
                                    value={value}
                                    onChange={(e) => onChange(e.target.value)}
                                    className="h-9 w-16 cursor-pointer p-1"
                                />
                                <Input
                                    type="text"
                                    value={value}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                                            onChange(val);
                                        }
                                    }}
                                    placeholder="#000000"
                                    className="h-9 flex-1 font-mono text-sm uppercase"
                                    maxLength={7}
                                />
                            </div>
                        </div>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    );
}
