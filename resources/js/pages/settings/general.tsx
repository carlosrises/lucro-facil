import { Head, useForm } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import HeadingSmall from '@/components/heading-small';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { type BreadcrumbItem } from '@/types';

import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';

import { edit as general } from '@/routes/general';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Configurações',
        href: general().url,
    },
    {
        title: 'Geral',
        href: general().url,
    },
];

interface GeneralProps {
    settings: {
        margin_excellent: number;
        margin_good_min: number;
        margin_good_max: number;
        margin_poor: number;
    };
}

export default function General({ settings }: GeneralProps) {
    const { data, setData, put, processing, errors } = useForm({
        margin_excellent: Number(settings.margin_excellent),
        margin_good_min: Number(settings.margin_good_min),
        margin_good_max: Number(settings.margin_good_max),
        margin_poor: Number(settings.margin_poor),
    });

    // Estado local para controle dos sliders
    const [marginExcellent, setMarginExcellent] = useState<number>(
        Number(data.margin_excellent),
    );
    const [marginGoodRange, setMarginGoodRange] = useState<[number, number]>([
        Number(data.margin_good_min),
        Number(data.margin_good_max),
    ]);
    const [marginPoor, setMarginPoor] = useState<number>(
        Number(data.margin_poor),
    );

    // Atualizar form data quando os sliders mudarem
    useEffect(() => {
        setData({
            margin_excellent: Number(marginExcellent),
            margin_good_min: Number(marginGoodRange[0]),
            margin_good_max: Number(marginGoodRange[1]),
            margin_poor: Number(marginPoor),
        });
    }, [marginExcellent, marginGoodRange, marginPoor, setData]);

    // Ajustar margem boa automaticamente quando margem excelente ou ruim mudarem
    useEffect(() => {
        // A margem boa fica sempre entre ruim + 1 e excelente - 1
        const newMin = marginPoor + 1;
        const newMax = marginExcellent - 1;

        // Garantir que há espaço suficiente entre os limites
        if (newMin < newMax) {
            setMarginGoodRange([newMin, newMax]);
        }
    }, [marginExcellent, marginPoor]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        put('/settings/general', {
            preserveScroll: true,
            onSuccess: () => {
                toast.success('Configurações salvas com sucesso!');
            },
            onError: () => {
                toast.error('Erro ao salvar configurações');
            },
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Configurações Gerais" />

            <SettingsLayout>
                <div className="space-y-6">
                    <HeadingSmall
                        title="Configurações Gerais"
                        description="Configure as margens de lucro e outras preferências do sistema."
                    />

                    <form onSubmit={handleSubmit}>
                        <Card>
                            <CardHeader>
                                <CardTitle>
                                    Configuração de Margens de Lucro
                                </CardTitle>
                                <CardDescription>
                                    Defina os intervalos de margem para
                                    classificação visual dos produtos
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-8">
                                {/* Margem Ruim */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <Label
                                            htmlFor="margin-poor"
                                            className="text-base font-medium"
                                        >
                                            Margem Ruim (Vermelha)
                                        </Label>
                                        <span className="text-sm font-semibold text-red-600">
                                            ≤ {Math.round(marginPoor)}%
                                        </span>
                                    </div>
                                    <Slider
                                        id="margin-poor"
                                        min={0}
                                        max={100}
                                        step={1}
                                        value={[marginPoor]}
                                        onValueChange={(value) =>
                                            setMarginPoor(value[0])
                                        }
                                    />
                                    {errors.margin_poor && (
                                        <p className="text-sm text-red-500">
                                            {errors.margin_poor}
                                        </p>
                                    )}
                                </div>

                                {/* Margem Excelente */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <Label
                                            htmlFor="margin-excellent"
                                            className="text-base font-medium"
                                        >
                                            Margem Excelente (Verde)
                                        </Label>
                                        <span className="text-sm font-semibold text-green-600">
                                            ≥ {Math.round(marginExcellent)}%
                                        </span>
                                    </div>
                                    <Slider
                                        id="margin-excellent"
                                        min={0}
                                        max={100}
                                        step={1}
                                        value={[marginExcellent]}
                                        onValueChange={(value) =>
                                            setMarginExcellent(value[0])
                                        }
                                    />
                                    {errors.margin_excellent && (
                                        <p className="text-sm text-red-500">
                                            {errors.margin_excellent}
                                        </p>
                                    )}
                                </div>

                                {/* Margem Boa (Calculada Automaticamente) */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-base font-medium">
                                            Margem Boa (Laranja) - Calculada
                                            Automaticamente
                                        </Label>
                                        <span className="text-sm font-semibold text-orange-600">
                                            {Math.round(marginGoodRange[0])}% -{' '}
                                            {Math.round(marginGoodRange[1])}%
                                        </span>
                                    </div>
                                    <div className="rounded-lg border bg-muted/50 p-3">
                                        <p className="text-xs text-muted-foreground">
                                            A margem boa é calculada
                                            automaticamente como o intervalo
                                            entre a margem ruim e a margem
                                            excelente.
                                        </p>
                                    </div>
                                </div>

                                {/* Resumo Visual */}
                                <div className="rounded-lg border bg-muted/50 p-4">
                                    <h4 className="mb-3 text-sm font-medium">
                                        Resumo da Classificação:
                                    </h4>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex items-center gap-2">
                                            <div className="h-3 w-3 rounded-full bg-red-600"></div>
                                            <span>
                                                Margem Ruim: 0% até{' '}
                                                {Math.round(marginPoor)}%
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="h-3 w-3 rounded-full bg-orange-600"></div>
                                            <span>
                                                Margem Boa:{' '}
                                                {Math.round(marginGoodRange[0])}
                                                % até{' '}
                                                {Math.round(marginGoodRange[1])}
                                                %
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="h-3 w-3 rounded-full bg-green-600"></div>
                                            <span>
                                                Margem Excelente:{' '}
                                                {Math.round(marginExcellent)}%
                                                ou mais
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-end">
                                    <Button type="submit" disabled={processing}>
                                        {processing
                                            ? 'Salvando...'
                                            : 'Salvar Configurações'}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </form>
                </div>
            </SettingsLayout>
        </AppLayout>
    );
}
