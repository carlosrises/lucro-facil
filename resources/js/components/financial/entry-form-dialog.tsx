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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { router } from '@inertiajs/react';
import { Info } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface FinanceCategory {
    id: number;
    name: string;
    type: 'expense' | 'income';
    parent_id: number | null;
}

interface FinanceEntry {
    id: number;
    occurred_on: string;
    amount: string;
    reference: string | null;
    supplier: string | null;
    description: string | null;
    notes: string | null;
    due_date: string | null;
    recurrence_type:
        | 'single'
        | 'weekly'
        | 'biweekly'
        | 'monthly'
        | 'bimonthly'
        | 'quarterly'
        | 'semiannual'
        | 'annual';
    recurrence_end_date: string | null;
    consider_business_days: boolean;
    payment_method: string | null;
    financial_account: string | null;
    competence_date: string | null;
    status: 'pending' | 'paid';
    paid_at: string | null;
    category: FinanceCategory;
}

interface EntryFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    entry: FinanceEntry | null;
    entryType: 'expense' | 'income';
    categories: FinanceCategory[];
}

export function EntryFormDialog({
    open,
    onOpenChange,
    entry,
    entryType,
    categories,
}: EntryFormDialogProps) {
    const [formData, setFormData] = useState({
        finance_category_id: '',
        occurred_on: '',
        amount: '',
        reference: '',
        supplier: '',
        description: '',
        notes: '',
        due_date: '',
        recurrence_type: 'single',
        recurrence_end_date: '',
        consider_business_days: false,
        payment_method: '',
        financial_account: '',
        competence_date: '',
        status: 'pending',
    });

    const [giveReceipt, setGiveReceipt] = useState(false);
    const [showRecurrenceDialog, setShowRecurrenceDialog] = useState(false);
    const [pendingSubmit, setPendingSubmit] = useState<'single' | 'all' | null>(
        null,
    );

    useEffect(() => {
        if (entry) {
            // Função auxiliar para formatar datas para o input type="date"
            const formatDate = (date: string | null) => {
                if (!date) return '';
                // Lidar com diferentes formatos de data do Laravel
                // Pode vir como "2026-01-10", "2026-01-10T00:00:00.000000Z", ou objeto Date
                const dateStr =
                    typeof date === 'string' ? date : date.toString();
                // Pegar apenas YYYY-MM-DD
                const match = dateStr.match(/(\d{4}-\d{2}-\d{2})/);
                return match ? match[1] : '';
            };

            setFormData({
                finance_category_id: entry.category.id.toString(),
                occurred_on: formatDate(entry.occurred_on),
                amount: entry.amount,
                reference: entry.reference || '',
                supplier: entry.supplier || '',
                description: entry.description || '',
                notes: entry.notes || '',
                due_date: formatDate(entry.due_date),
                recurrence_type: entry.recurrence_type,
                recurrence_end_date: formatDate(entry.recurrence_end_date),
                consider_business_days: entry.consider_business_days || false,
                payment_method: entry.payment_method || '',
                financial_account: entry.financial_account || '',
                competence_date:
                    formatDate(entry.competence_date) ||
                    formatDate(entry.occurred_on),
                status: entry.status,
            });
            setGiveReceipt(entry.status === 'paid');
        } else {
            const today = new Date().toISOString().split('T')[0];
            setFormData({
                finance_category_id: '',
                occurred_on: today,
                amount: '',
                reference: '',
                supplier: '',
                description: '',
                notes: '',
                due_date: '',
                recurrence_type: 'single',
                recurrence_end_date: '',
                consider_business_days: false,
                payment_method: '',
                financial_account: '',
                competence_date: today,
                status: 'pending',
            });
            setGiveReceipt(false);
        }
    }, [entry, open]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Validação básica do frontend
        if (!formData.description || formData.description.trim() === '') {
            toast.error('Por favor, informe uma descrição');
            return;
        }

        if (!formData.finance_category_id) {
            toast.error('Por favor, selecione uma categoria');
            return;
        }

        if (!formData.amount || parseFloat(formData.amount) <= 0) {
            toast.error('Por favor, informe um valor válido');
            return;
        }

        // Se está editando uma parcela de recorrência, perguntar o escopo da atualização
        if (entry && entry.parent_entry_id) {
            setShowRecurrenceDialog(true);
            return;
        }

        // Caso contrário, submeter normalmente
        submitForm('single');
    };

    const submitForm = (updateScope: 'single' | 'all') => {
        const url = entry
            ? `/financial/entries/${entry.id}`
            : '/financial/entries';

        const method = entry ? 'put' : 'post';

        const dataToSend = {
            ...formData,
            status: giveReceipt ? 'paid' : 'pending',
            update_scope: updateScope, // Adicionar flag para o backend
        };

        router[method](url, dataToSend, {
            preserveScroll: true,
            onSuccess: () => {
                toast.success(
                    entry
                        ? 'Movimentação atualizada com sucesso!'
                        : 'Movimentação criada com sucesso!',
                );
                onOpenChange(false);
            },
            onError: (errors) => {
                console.error('Erro ao salvar movimentação:', errors);

                // Se houver erros de validação específicos, mostrar o primeiro
                const firstError = Object.values(errors)[0];
                const errorMessage = Array.isArray(firstError)
                    ? firstError[0]
                    : firstError || 'Erro ao salvar movimentação';

                toast.error(errorMessage);
            },
        });
    };

    // Filtrar categorias baseado no tipo
    const filteredCategories = entry
        ? categories.filter((c) => c.type === entry.category.type)
        : categories.filter((c) => c.type === entryType);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[900px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>
                            {entry
                                ? 'Editar'
                                : entryType === 'expense'
                                  ? 'Conta a pagar'
                                  : 'Conta a receber'}
                        </DialogTitle>
                        <DialogDescription>
                            Preencha os dados da movimentação financeira.
                            <br />
                            <span className="text-xs text-muted-foreground">
                                Campos marcados com{' '}
                                <span className="text-destructive">*</span> são
                                obrigatórios
                            </span>
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="description">
                                Descrição{' '}
                                <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="description"
                                placeholder="Ex: Conta de Luz, Salários, Aluguel..."
                                value={formData.description}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        description: e.target.value,
                                    })
                                }
                                required
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="supplier">Fornecedor</Label>
                                <Input
                                    id="supplier"
                                    placeholder="Nome do fornecedor"
                                    value={formData.supplier}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            supplier: e.target.value,
                                        })
                                    }
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="amount">
                                    Valor (R$){' '}
                                    <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="amount"
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    placeholder="0,00"
                                    value={formData.amount}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            amount: e.target.value,
                                        })
                                    }
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="occurred_on">
                                    Emissão{' '}
                                    <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="occurred_on"
                                    type="date"
                                    value={formData.occurred_on}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            occurred_on: e.target.value,
                                        })
                                    }
                                    required
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="competence_date">
                                    Competência{' '}
                                    <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="competence_date"
                                    type="date"
                                    value={formData.competence_date}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            competence_date: e.target.value,
                                        })
                                    }
                                    required
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="due_date">
                                    Vencimento{' '}
                                    <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="due_date"
                                    type="date"
                                    value={formData.due_date}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            due_date: e.target.value,
                                        })
                                    }
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="notes">Histórico</Label>
                            <Textarea
                                id="notes"
                                placeholder="Descrição da movimentação"
                                value={formData.notes}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        notes: e.target.value,
                                    })
                                }
                                rows={3}
                            />
                        </div>

                        <Tabs defaultValue="pagamento" className="w-full">
                            <TabsList className="grid w-full grid-cols-3">
                                <TabsTrigger value="pagamento">
                                    Pagamento
                                </TabsTrigger>
                                <TabsTrigger value="ocorrencia">
                                    Recorrência
                                </TabsTrigger>
                                <TabsTrigger value="anexos">Anexos</TabsTrigger>
                            </TabsList>
                            <TabsContent
                                value="pagamento"
                                className="space-y-4"
                            >
                                <div className="grid gap-2">
                                    <Label htmlFor="finance_category_id">
                                        Categoria{' '}
                                        <span className="text-destructive">
                                            *
                                        </span>
                                    </Label>
                                    <Select
                                        value={formData.finance_category_id}
                                        onValueChange={(value) =>
                                            setFormData({
                                                ...formData,
                                                finance_category_id: value,
                                            })
                                        }
                                        required
                                    >
                                        <SelectTrigger
                                            id="finance_category_id"
                                            className="w-full"
                                        >
                                            <SelectValue placeholder="Selecione uma categoria" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {filteredCategories.map(
                                                (category) => (
                                                    <SelectItem
                                                        key={category.id}
                                                        value={category.id.toString()}
                                                    >
                                                        {category.name}
                                                    </SelectItem>
                                                ),
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="reference">
                                        N° documento
                                    </Label>
                                    <Input
                                        id="reference"
                                        placeholder="Número do documento"
                                        value={formData.reference}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                reference: e.target.value,
                                            })
                                        }
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="payment_method">
                                            Forma de Pagamento
                                        </Label>
                                        <Select
                                            value={formData.payment_method}
                                            onValueChange={(value) =>
                                                setFormData({
                                                    ...formData,
                                                    payment_method: value,
                                                })
                                            }
                                        >
                                            <SelectTrigger
                                                id="payment_method"
                                                className="w-full"
                                            >
                                                <SelectValue placeholder="Selecione" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="dinheiro">
                                                    Dinheiro
                                                </SelectItem>
                                                <SelectItem value="pix">
                                                    PIX
                                                </SelectItem>
                                                <SelectItem value="transferencia">
                                                    Transferência
                                                </SelectItem>
                                                <SelectItem value="boleto">
                                                    Boleto
                                                </SelectItem>
                                                <SelectItem value="cartao_credito">
                                                    Cartão de Crédito
                                                </SelectItem>
                                                <SelectItem value="cartao_debito">
                                                    Cartão de Débito
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="financial_account">
                                            Conta Financeira
                                        </Label>
                                        <Select
                                            value={formData.financial_account}
                                            onValueChange={(value) =>
                                                setFormData({
                                                    ...formData,
                                                    financial_account: value,
                                                })
                                            }
                                        >
                                            <SelectTrigger
                                                id="financial_account"
                                                className="w-full"
                                            >
                                                <SelectValue placeholder="Selecione" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="caixa">
                                                    Caixa
                                                </SelectItem>
                                                <SelectItem value="banco">
                                                    Banco
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </TabsContent>
                            <TabsContent
                                value="ocorrencia"
                                className="space-y-4"
                            >
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="recurrence_type">
                                            Recorrência
                                        </Label>
                                        <Select
                                            value={formData.recurrence_type}
                                            onValueChange={(value) =>
                                                setFormData({
                                                    ...formData,
                                                    recurrence_type: value,
                                                })
                                            }
                                        >
                                            <SelectTrigger
                                                id="recurrence_type"
                                                className="w-full"
                                            >
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="single">
                                                    Única
                                                </SelectItem>
                                                <SelectItem value="weekly">
                                                    Semanal
                                                </SelectItem>
                                                <SelectItem value="biweekly">
                                                    Quinzenal
                                                </SelectItem>
                                                <SelectItem value="monthly">
                                                    Mensal
                                                </SelectItem>
                                                <SelectItem value="bimonthly">
                                                    Bimestral
                                                </SelectItem>
                                                <SelectItem value="quarterly">
                                                    Trimestral
                                                </SelectItem>
                                                <SelectItem value="semiannual">
                                                    Semestral
                                                </SelectItem>
                                                <SelectItem value="annual">
                                                    Anual
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {formData.recurrence_type !== 'single' && (
                                        <div className="grid gap-2">
                                            <Label
                                                htmlFor="recurrence_end_date"
                                                className="flex items-center gap-2"
                                            >
                                                Data Limite
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Info className="h-4 w-4 cursor-help text-muted-foreground" />
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p className="max-w-xs">
                                                                A data limite
                                                                deve ser igual
                                                                ou posterior à
                                                                data de emissão.
                                                                As parcelas
                                                                serão geradas a
                                                                partir da data
                                                                de emissão até a
                                                                data limite.
                                                            </p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            </Label>
                                            <Input
                                                id="recurrence_end_date"
                                                type="date"
                                                placeholder="00/00/0000"
                                                value={
                                                    formData.recurrence_end_date
                                                }
                                                onChange={(e) =>
                                                    setFormData({
                                                        ...formData,
                                                        recurrence_end_date:
                                                            e.target.value,
                                                    })
                                                }
                                            />
                                        </div>
                                    )}
                                </div>

                                {formData.recurrence_type === 'weekly' && (
                                    <div className="grid gap-2">
                                        <Label htmlFor="day_of_week">
                                            Dia da semana *
                                        </Label>
                                        <Select>
                                            <SelectTrigger
                                                id="day_of_week"
                                                className="w-full"
                                            >
                                                <SelectValue placeholder="Domingo" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="0">
                                                    Domingo
                                                </SelectItem>
                                                <SelectItem value="1">
                                                    Segunda-feira
                                                </SelectItem>
                                                <SelectItem value="2">
                                                    Terça-feira
                                                </SelectItem>
                                                <SelectItem value="3">
                                                    Quarta-feira
                                                </SelectItem>
                                                <SelectItem value="4">
                                                    Quinta-feira
                                                </SelectItem>
                                                <SelectItem value="5">
                                                    Sexta-feira
                                                </SelectItem>
                                                <SelectItem value="6">
                                                    Sábado
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                {formData.recurrence_type !== 'single' && (
                                    <div className="flex items-center justify-between space-x-2">
                                        <Label
                                            htmlFor="consider_business_days"
                                            className="flex cursor-pointer items-center gap-2 font-normal"
                                        >
                                            Considerar dias úteis
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Info className="h-4 w-4 cursor-help text-muted-foreground" />
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p className="max-w-xs">
                                                            Quando ativada, esta
                                                            opção ajustará
                                                            automaticamente as
                                                            datas de vencimento
                                                            para o próximo dia
                                                            útil caso caiam em
                                                            finais de semana.
                                                            <br />
                                                            <br />
                                                            <strong>
                                                                Exemplo:
                                                            </strong>{' '}
                                                            Se uma parcela cair
                                                            em sábado ou
                                                            domingo, será movida
                                                            para segunda-feira.
                                                        </p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        </Label>
                                        <Switch
                                            id="consider_business_days"
                                            checked={
                                                formData.consider_business_days
                                            }
                                            onCheckedChange={(checked) =>
                                                setFormData({
                                                    ...formData,
                                                    consider_business_days:
                                                        checked,
                                                })
                                            }
                                        />
                                    </div>
                                )}
                            </TabsContent>
                            <TabsContent value="anexos" className="space-y-4">
                                <div className="flex h-32 items-center justify-center rounded-md border border-dashed">
                                    <p className="text-sm text-muted-foreground">
                                        Funcionalidade em desenvolvimento
                                    </p>
                                </div>
                            </TabsContent>
                        </Tabs>

                        <div className="rounded-md border bg-muted/5">
                            <div className="grid grid-cols-4 gap-6 px-6 py-4 text-sm">
                                <div>
                                    <div className="font-semibold text-muted-foreground">
                                        Ocorrência
                                    </div>
                                    <div className="mt-1">
                                        {formData.occurred_on
                                            ? (() => {
                                                  const [y, m, d] =
                                                      formData.occurred_on.split(
                                                          '-',
                                                      );
                                                  return new Date(
                                                      parseInt(y),
                                                      parseInt(m) - 1,
                                                      parseInt(d),
                                                  ).toLocaleDateString('pt-BR');
                                              })()
                                            : '—'}
                                    </div>
                                </div>
                                <div>
                                    <div className="font-semibold text-muted-foreground">
                                        Competência
                                    </div>
                                    <div className="mt-1">
                                        {formData.competence_date
                                            ? (() => {
                                                  const [y, m, d] =
                                                      formData.competence_date.split(
                                                          '-',
                                                      );
                                                  return new Date(
                                                      parseInt(y),
                                                      parseInt(m) - 1,
                                                      parseInt(d),
                                                  ).toLocaleDateString('pt-BR');
                                              })()
                                            : '—'}
                                    </div>
                                </div>
                                <div>
                                    <div className="font-semibold text-muted-foreground">
                                        Vencimento
                                    </div>
                                    <div className="mt-1">
                                        {formData.due_date
                                            ? (() => {
                                                  const [y, m, d] =
                                                      formData.due_date.split(
                                                          '-',
                                                      );
                                                  return new Date(
                                                      parseInt(y),
                                                      parseInt(m) - 1,
                                                      parseInt(d),
                                                  ).toLocaleDateString('pt-BR');
                                              })()
                                            : '—'}
                                    </div>
                                </div>
                                <div>
                                    <div className="font-semibold text-muted-foreground">
                                        Valor
                                    </div>
                                    <div
                                        className={`mt-1 font-medium ${entryType === 'expense' ? 'text-red-600' : 'text-green-600'}`}
                                    >
                                        {formData.amount
                                            ? new Intl.NumberFormat('pt-BR', {
                                                  style: 'currency',
                                                  currency: 'BRL',
                                              }).format(
                                                  parseFloat(formData.amount),
                                              )
                                            : 'R$ 0,00'}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between rounded-md border bg-muted/50 p-4">
                            <Label
                                htmlFor="give_receipt"
                                className="font-medium"
                            >
                                Dar baixa (marcar como{' '}
                                {entryType === 'expense' ? 'pago' : 'recebido'})
                            </Label>
                            <Switch
                                id="give_receipt"
                                checked={giveReceipt}
                                onCheckedChange={setGiveReceipt}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancelar
                        </Button>
                        <Button type="submit">Salvar</Button>
                    </DialogFooter>
                </form>
            </DialogContent>

            {/* Dialog de confirmação para edição de parcela recorrente */}
            <AlertDialog
                open={showRecurrenceDialog}
                onOpenChange={setShowRecurrenceDialog}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Atualizar movimentação recorrente
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta é uma parcela de uma movimentação recorrente.
                            Como deseja atualizar?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setShowRecurrenceDialog(false);
                                submitForm('single');
                            }}
                        >
                            Apenas esta parcela
                        </Button>
                        <AlertDialogAction
                            onClick={() => {
                                setShowRecurrenceDialog(false);
                                submitForm('all');
                            }}
                        >
                            Todas as parcelas
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Dialog>
    );
}
