import { Button } from '@/components/ui/button';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from '@/components/ui/command';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import * as React from 'react';

interface Category {
    id: number;
    name: string;
    color?: string;
}

interface CategoryComboboxProps {
    categories: Category[];
    value?: string;
    onChange: (value: string) => void;
    onCreateNew: () => void;
    placeholder?: string;
    emptyText?: string;
}

export function CategoryCombobox({
    categories,
    value,
    onChange,
    onCreateNew,
    placeholder = 'Selecione uma categoria',
    emptyText = 'Sem categoria',
}: CategoryComboboxProps) {
    const [open, setOpen] = React.useState(false);

    const selected = categories.find((c) => c.id.toString() === value);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="h-9 w-full justify-start gap-2"
                >
                    {selected ? (
                        <>
                            <div
                                className="h-3 w-3 rounded-full border"
                                style={{
                                    backgroundColor:
                                        selected.color || '#6b7280',
                                }}
                            />
                            {selected.name}
                        </>
                    ) : value === '' ? (
                        emptyText
                    ) : (
                        placeholder
                    )}
                    <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
                <Command>
                    <CommandInput
                        placeholder="Buscar categoria..."
                        className="h-9"
                    />
                    <CommandList>
                        <CommandEmpty>
                            Nenhuma categoria encontrada.
                        </CommandEmpty>
                        <CommandGroup>
                            <CommandItem
                                value="none"
                                onSelect={() => {
                                    onChange('');
                                    setOpen(false);
                                }}
                            >
                                {emptyText}
                                <Check
                                    className={cn(
                                        'ml-auto h-4 w-4',
                                        value === ''
                                            ? 'opacity-100'
                                            : 'opacity-0',
                                    )}
                                />
                            </CommandItem>
                            {categories.map((category) => (
                                <CommandItem
                                    key={category.id}
                                    value={category.name}
                                    onSelect={() => {
                                        onChange(category.id.toString());
                                        setOpen(false);
                                    }}
                                >
                                    <div
                                        className="mr-2 h-3 w-3 rounded-full border"
                                        style={{
                                            backgroundColor:
                                                category.color || '#6b7280',
                                        }}
                                    />
                                    {category.name}
                                    <Check
                                        className={cn(
                                            'ml-auto h-4 w-4',
                                            value === category.id.toString()
                                                ? 'opacity-100'
                                                : 'opacity-0',
                                        )}
                                    />
                                </CommandItem>
                            ))}
                        </CommandGroup>
                        <CommandSeparator />
                        <CommandGroup>
                            <CommandItem
                                onSelect={() => {
                                    setOpen(false);
                                    onCreateNew();
                                }}
                                className="justify-center text-sm font-medium text-primary"
                            >
                                <Plus className="mr-2 h-4 w-4" />
                                Nova categoria
                            </CommandItem>
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
