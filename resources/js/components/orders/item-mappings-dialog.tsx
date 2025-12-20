import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { router } from '@inertiajs/react';
import { Check, Link2, PackageX, X } from 'lucide-react';
import React from 'react';
import { toast } from 'sonner';

interface OrderItem {
    id: number;
    sku?: string;
    name: string;
    qty?: number;
    quantity?: number;
    unit_price?: number;
    unitPrice?: number;
    add_ons?: Array<{
        name: string;
        quantity: number;
        price: number;
    }>;
    internal_product?: {
        id: number;
        name: string;
        unit_cost: string;
    };
    mappings?: Array<{
        id: number;
        internal_product_id: number;
        quantity: number;
        mapping_type: 'main' | 'option' | 'addon';
        external_reference?: string | null;
        external_name?: string | null;
        internal_product?: {
            id: number;
            name: string;
            unit_cost: string;
        };
    }>;
}

interface InternalProduct {
    id: number;
    name: string;
    sku: string | null;
    unit_cost: string;
}

interface Mapping {
    internal_product_id: number | null;
    quantity: number;
    mapping_type: 'main' | 'option' | 'addon';
    option_type?:
        | 'pizza_flavor'
        | 'regular'
        | 'addon'
        | 'observation'
        | 'drink'
        | null;
    auto_fraction?: boolean;
    notes?: string;
    external_reference?: string;
    external_name?: string;
}

interface ItemMappingsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    item: OrderItem | null;
    internalProducts: InternalProduct[];
    provider: string;
}

export function ItemMappingsDialog({
    open,
    onOpenChange,
    item,
    internalProducts,
    provider,
}: ItemMappingsDialogProps) {
    // Estado para item principal
    const [mainProductId, setMainProductId] = React.useState<number | null>(
        null,
    );
    const [mainQuantity, setMainQuantity] = React.useState<number>(1);

    // Estado para complementos (cada complemento pode ter seu próprio produto)
    const [addonMappings, setAddonMappings] = React.useState<
        Record<
            number,
            {
                productId: number | null;
                quantity: number;
                optionType:
                    | 'pizza_flavor'
                    | 'regular'
                    | 'addon'
                    | 'observation'
                    | 'drink'
                    | null;
                autoFraction: boolean;
            }
        >
    >({});

    const [isSubmitting, setIsSubmitting] = React.useState(false);

    // Inicializar quando o item mudar
    React.useEffect(() => {
        if (item && open) {
            console.log('🔍 [ItemMappingsDialog] Item recebido:', item);
            console.log('🔍 [ItemMappingsDialog] Mappings:', item.mappings);

            if (item.mappings && item.mappings.length > 0) {
                // Carregar mappings existentes
                const mainMapping = item.mappings.find(
                    (m) => m.mapping_type === 'main',
                );
                console.log(
                    '🔍 [ItemMappingsDialog] Main mapping encontrado:',
                    mainMapping,
                );

                if (mainMapping) {
                    setMainProductId(mainMapping.internal_product_id);
                    setMainQuantity(mainMapping.quantity * 100); // Converter para porcentagem
                }

                // Carregar mappings de complementos
                const addonMaps: Record<
                    number,
                    {
                        productId: number | null;
                        quantity: number;
                        optionType:
                            | 'pizza_flavor'
                            | 'regular'
                            | 'addon'
                            | 'observation'
                            | 'drink'
                            | null;
                        autoFraction: boolean;
                    }
                > = {};
                item.mappings
                    .filter(
                        (m) =>
                            m.mapping_type === 'addon' && m.external_reference,
                    )
                    .forEach((m) => {
                        const addonIndex = parseInt(
                            m.external_reference || '0',
                        );
                        addonMaps[addonIndex] = {
                            productId: m.internal_product_id,
                            quantity: m.quantity, // Usar valor direto, não multiplicar por 100
                            optionType: (m as any).option_type || 'addon',
                            autoFraction: (m as any).auto_fraction || false,
                        };
                    });
                console.log(
                    '🔍 [ItemMappingsDialog] Addon mappings carregados:',
                    addonMaps,
                );
                setAddonMappings(addonMaps);
            } else {
                console.log(
                    '⚠️ [ItemMappingsDialog] Nenhum mapping encontrado, usando valores padrão',
                );
                // Resetar para valores padrão
                setMainProductId(item.internal_product?.id || null);
                setMainQuantity(100); // 100%
                setAddonMappings({});
            }
        }
    }, [item, open]);

    const handleSave = () => {
        if (!item) return;

        // Construir lista de mappings
        const mappings: Mapping[] = [];

        // Adicionar mapping principal se houver produto selecionado
        if (mainProductId) {
            mappings.push({
                internal_product_id: mainProductId,
                quantity: mainQuantity / 100, // Converter porcentagem para decimal
                mapping_type: 'main',
            });
        }

        // Adicionar mappings de complementos
        item.add_ons?.forEach((addon, index) => {
            const addonMapping = addonMappings[index];
            if (addonMapping?.productId) {
                mappings.push({
                    internal_product_id: addonMapping.productId,
                    quantity: addonMapping.quantity, // Usar valor direto
                    mapping_type: 'addon',
                    option_type: addonMapping.optionType || 'addon',
                    auto_fraction: addonMapping.autoFraction || false,
                    external_reference: index.toString(),
                    external_name: addon.name,
                });
            }
        });

        console.log('💾 [ItemMappingsDialog] Salvando mappings:', mappings);

        setIsSubmitting(true);

        router.post(
            `/order-items/${item.id}/mappings`,
            {
                mappings: mappings.map((m) => ({
                    internal_product_id: m.internal_product_id,
                    quantity: m.quantity,
                    mapping_type: m.mapping_type,
                    option_type: m.option_type || null,
                    auto_fraction: m.auto_fraction || false,
                    notes: m.notes || null,
                    external_reference: m.external_reference,
                    external_name: m.external_name,
                })),
            },
            {
                preserveScroll: true,
                preserveState: false,
                onSuccess: () => {
                    toast.success('Associações salvas com sucesso!');
                    router.reload({ only: ['orders'] });
                    setTimeout(() => onOpenChange(false), 100);
                },
                onError: (errors) => {
                    console.error(
                        '❌ [ItemMappingsDialog] Erro ao salvar:',
                        errors,
                    );
                    toast.error('Erro ao salvar associações');
                },
                onFinish: () => setIsSubmitting(false),
            },
        );
    };

    const handleRemoveAll = () => {
        if (!item) return;

        setIsSubmitting(true);

        router.delete(`/order-items/${item.id}/mappings`, {
            preserveScroll: true,
            preserveState: false,
            onSuccess: () => {
                toast.success('Associações removidas com sucesso!');
                router.reload({ only: ['orders'] });
                setTimeout(() => onOpenChange(false), 100);
            },
            onError: () => {
                toast.error('Erro ao remover associações');
            },
            onFinish: () => setIsSubmitting(false),
        });
    };

    if (!item) return null;

    const hasMappings = item.mappings && item.mappings.length > 0;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] max-w-3xl overflow-hidden">
                <DialogHeader>
                    <DialogTitle>Associar Produtos Internos</DialogTitle>
                    <DialogDescription>
                        Configure múltiplas associações, frações e complementos
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="max-h-[calc(90vh-180px)] pr-4">
                    <div className="space-y-6">
                        {/* Informações do Item */}
                        <div className="rounded-lg border bg-muted/50 p-4">
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold">
                                            {item.name}
                                        </span>
                                        {hasMappings ? (
                                            <Badge
                                                variant="outline"
                                                className="border-emerald-200 bg-emerald-50 text-emerald-700"
                                            >
                                                <Check className="mr-1 h-3 w-3" />
                                                Associado
                                            </Badge>
                                        ) : (
                                            <Badge
                                                variant="outline"
                                                className="border-amber-200 bg-amber-50 text-amber-700"
                                            >
                                                <PackageX className="mr-1 h-3 w-3" />
                                                Não associado
                                            </Badge>
                                        )}
                                    </div>
                                    <div className="mt-1 text-sm text-muted-foreground">
                                        SKU: {item.sku || 'N/A'} • Qtd:{' '}
                                        {item.qty || item.quantity || 0}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Associação do Item Principal */}
                        <div className="space-y-3">
                            <Label className="text-base font-semibold">
                                Item Principal
                            </Label>
                            <div className="space-y-3 rounded-lg border p-4">
                                <div className="space-y-2">
                                    <Label className="text-sm">
                                        Produto Interno
                                    </Label>
                                    <Combobox
                                        options={[
                                            { value: '', label: '(Nenhum)' },
                                            ...internalProducts.map(
                                                (product) => ({
                                                    value: product.id.toString(),
                                                    label: `${product.name}${product.sku ? ` • ${product.sku}` : ''} • ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(product.unit_cost))}`,
                                                }),
                                            ),
                                        ]}
                                        value={mainProductId?.toString() || ''}
                                        onChange={(value) =>
                                            setMainProductId(
                                                value ? parseInt(value) : null,
                                            )
                                        }
                                        placeholder="Selecione o produto"
                                        emptyMessage="Nenhum produto encontrado"
                                        searchPlaceholder="Buscar..."
                                    />
                                </div>

                                {mainProductId && (
                                    <div className="space-y-2">
                                        <Label className="text-sm">
                                            Porcentagem
                                        </Label>
                                        <Input
                                            type="number"
                                            min="1"
                                            max="100"
                                            step="25"
                                            value={mainQuantity}
                                            onChange={(e) =>
                                                setMainQuantity(
                                                    parseFloat(
                                                        e.target.value,
                                                    ) || 100,
                                                )
                                            }
                                            placeholder="Ex: 25 para 25%"
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            100% = produto inteiro | 50% =
                                            metade | 25% = 1/4
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Associação de Complementos */}
                        {item.add_ons && item.add_ons.length > 0 && (
                            <div className="space-y-3">
                                <Label className="text-base font-semibold">
                                    Complementos ({item.add_ons.length})
                                </Label>
                                <div className="space-y-3">
                                    {item.add_ons.map((addon, index) => {
                                        const addonMapping = addonMappings[
                                            index
                                        ] || {
                                            productId: null,
                                            quantity: 1,
                                            optionType: 'addon' as const,
                                            autoFraction: false,
                                        };
                                        return (
                                            <div
                                                key={index}
                                                className="space-y-3 rounded-lg border p-4"
                                            >
                                                <div className="mb-2 flex items-center gap-2">
                                                    <Badge variant="secondary">
                                                        {addon.quantity}x{' '}
                                                        {addon.name}
                                                    </Badge>
                                                    {addon.price > 0 && (
                                                        <span className="text-xs text-muted-foreground">
                                                            {new Intl.NumberFormat(
                                                                'pt-BR',
                                                                {
                                                                    style: 'currency',
                                                                    currency:
                                                                        'BRL',
                                                                },
                                                            ).format(
                                                                addon.price,
                                                            )}
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="space-y-2">
                                                    <Label className="text-sm">
                                                        Produto Interno
                                                    </Label>
                                                    <Combobox
                                                        options={[
                                                            {
                                                                value: '',
                                                                label: '(Nenhum)',
                                                            },
                                                            ...internalProducts.map(
                                                                (product) => ({
                                                                    value: product.id.toString(),
                                                                    label: `${product.name}${product.sku ? ` • ${product.sku}` : ''} • ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(product.unit_cost))}`,
                                                                }),
                                                            ),
                                                        ]}
                                                        value={
                                                            addonMapping.productId?.toString() ||
                                                            ''
                                                        }
                                                        onChange={(value) =>
                                                            setAddonMappings({
                                                                ...addonMappings,
                                                                [index]: {
                                                                    ...addonMapping,
                                                                    productId:
                                                                        value
                                                                            ? parseInt(
                                                                                  value,
                                                                              )
                                                                            : null,
                                                                },
                                                            })
                                                        }
                                                        placeholder="Selecione o produto (opcional)"
                                                        emptyMessage="Nenhum produto encontrado"
                                                        searchPlaceholder="Buscar..."
                                                    />
                                                </div>

                                                {addonMapping.productId && (
                                                    <>
                                                        <div className="space-y-2">
                                                            <Label className="text-sm">
                                                                Tipo de Opção
                                                            </Label>
                                                            <Combobox
                                                                options={[
                                                                    {
                                                                        value: 'pizza_flavor',
                                                                        label: '🍕 Sabor de Pizza',
                                                                    },
                                                                    {
                                                                        value: 'regular',
                                                                        label: '📦 Item Regular',
                                                                    },
                                                                    {
                                                                        value: 'addon',
                                                                        label: '➕ Complemento',
                                                                    },
                                                                    {
                                                                        value: 'drink',
                                                                        label: '🥤 Bebida',
                                                                    },
                                                                    {
                                                                        value: 'observation',
                                                                        label: '📝 Observação',
                                                                    },
                                                                ]}
                                                                value={
                                                                    addonMapping.optionType ||
                                                                    'addon'
                                                                }
                                                                onChange={(
                                                                    value,
                                                                ) =>
                                                                    setAddonMappings(
                                                                        {
                                                                            ...addonMappings,
                                                                            [index]:
                                                                                {
                                                                                    ...addonMapping,
                                                                                    optionType:
                                                                                        value as any,
                                                                                },
                                                                        },
                                                                    )
                                                                }
                                                                placeholder="Selecione o tipo"
                                                                emptyMessage="Nenhum tipo encontrado"
                                                                searchPlaceholder="Buscar..."
                                                            />
                                                            <p className="text-xs text-muted-foreground">
                                                                Defina o tipo
                                                                para cálculos
                                                                automáticos
                                                            </p>
                                                        </div>

                                                        {addonMapping.optionType ===
                                                            'pizza_flavor' && (
                                                            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                                                                <div className="flex items-start gap-2">
                                                                    <input
                                                                        type="checkbox"
                                                                        id={`auto-fraction-${index}`}
                                                                        checked={
                                                                            addonMapping.autoFraction
                                                                        }
                                                                        onChange={(
                                                                            e,
                                                                        ) =>
                                                                            setAddonMappings(
                                                                                {
                                                                                    ...addonMappings,
                                                                                    [index]:
                                                                                        {
                                                                                            ...addonMapping,
                                                                                            autoFraction:
                                                                                                e
                                                                                                    .target
                                                                                                    .checked,
                                                                                        },
                                                                                },
                                                                            )
                                                                        }
                                                                        className="mt-0.5 h-4 w-4 rounded border-gray-300"
                                                                    />
                                                                    <div className="flex-1">
                                                                        <Label
                                                                            htmlFor={`auto-fraction-${index}`}
                                                                            className="text-sm font-medium text-blue-900"
                                                                        >
                                                                            Fração
                                                                            Automática
                                                                        </Label>
                                                                        <p className="text-xs text-blue-700">
                                                                            Calcula
                                                                            automaticamente
                                                                            a
                                                                            fração
                                                                            baseado
                                                                            no
                                                                            número
                                                                            de
                                                                            sabores
                                                                            (ex:
                                                                            2
                                                                            sabores
                                                                            =
                                                                            0.5
                                                                            cada)
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}

                                                        <div className="space-y-2">
                                                            <Label className="text-sm">
                                                                Quantidade/Fração
                                                                {addonMapping.autoFraction &&
                                                                    ' (será calculada automaticamente)'}
                                                            </Label>
                                                            <Input
                                                                type="number"
                                                                min="0.01"
                                                                max="999"
                                                                step="0.25"
                                                                value={
                                                                    addonMapping.quantity
                                                                }
                                                                onChange={(e) =>
                                                                    setAddonMappings(
                                                                        {
                                                                            ...addonMappings,
                                                                            [index]:
                                                                                {
                                                                                    ...addonMapping,
                                                                                    quantity:
                                                                                        parseFloat(
                                                                                            e
                                                                                                .target
                                                                                                .value,
                                                                                        ) ||
                                                                                        1,
                                                                                },
                                                                        },
                                                                    )
                                                                }
                                                                placeholder="Ex: 0.25 para 1/4"
                                                                disabled={
                                                                    addonMapping.autoFraction
                                                                }
                                                            />
                                                            <p className="text-xs text-muted-foreground">
                                                                1.0 = 100% | 0.5
                                                                = 50% | 0.25 =
                                                                25%
                                                            </p>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </ScrollArea>

                {/* Footer */}
                <div className="flex items-center justify-between gap-3 border-t pt-4">
                    <div>
                        {hasMappings && (
                            <Button
                                variant="outline"
                                className="text-destructive hover:bg-destructive/10"
                                onClick={handleRemoveAll}
                                disabled={isSubmitting}
                            >
                                <X className="mr-2 h-4 w-4" />
                                Remover Todas
                            </Button>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={isSubmitting}
                        >
                            Cancelar
                        </Button>
                        <Button onClick={handleSave} disabled={isSubmitting}>
                            <Link2 className="mr-2 h-4 w-4" />
                            Salvar Associações
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
