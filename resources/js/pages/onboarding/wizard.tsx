import { Button } from '@/components/ui/button';
import {
    Field,
    FieldContent,
    FieldDescription,
    FieldLabel,
    FieldTitle,
} from '@/components/ui/field';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Head, router, usePage } from '@inertiajs/react';
import axios from 'axios';
import { Check, Loader2, Sparkles } from 'lucide-react';
import { useState } from 'react';

interface Preset {
    id: string;
    name: string;
    categories_count: number;
    ingredients_count: number;
    products_count: number;
}

interface PresetDetails {
    name: string;
    categories: any[];
    ingredients: any[];
    products: any[];
}

interface PlanPrice {
    id: number;
    key: string;
    label: string;
    amount: number | null;
    interval: string;
    period_label: string;
    is_annual: boolean;
}

interface Plan {
    id: number;
    name: string;
    price_month: number;
    prices?: PlanPrice[];
    features: string[];
    is_contact_plan?: boolean;
}

interface OnboardingProps {
    currentStep: number;
    presets?: Preset[];
    presetDetails?: PresetDetails;
    plans?: Plan[];
    currentPlan?: Plan;
}

export default function OnboardingWizard() {
    const { currentStep, presets, presetDetails, plans, currentPlan } =
        usePage<OnboardingProps>().props;

    const [selectedBusinessType, setSelectedBusinessType] = useState('');
    const [loading, setLoading] = useState(false);
    const [loadingPlanId, setLoadingPlanId] = useState<number | null>(null);
    const [isAnnual, setIsAnnual] = useState(false);

    const handleBusinessTypeSubmit = () => {
        if (!selectedBusinessType) return;

        setLoading(true);
        router.post(
            '/onboarding/business-type',
            {
                business_type: selectedBusinessType,
            },
            {
                onSuccess: () => {
                    setLoading(false);
                },
                onError: (errors) => {
                    setLoading(false);
                    console.error('Erro ao enviar tipo de negócio:', errors);
                },
            },
        );
    };

    const handleSkip = () => {
        setLoading(true);
        router.post('/onboarding/skip', undefined, {
            onFinish: () => setLoading(false),
        });
    };

    const handleComplete = () => {
        setLoading(true);
        router.post('/onboarding/complete', undefined, {
            onFinish: () => setLoading(false),
        });
    };

    const handleSelectPlan = async (planId: number) => {
        setLoadingPlanId(planId);
        try {
            const response = await axios.post('/settings/billing/checkout', {
                plan_id: planId,
                price_interval: isAnnual ? 'year' : 'month',
            });
            window.location.href = response.data.checkout_url;
        } catch (error) {
            console.error('Erro ao criar checkout:', error);
            setLoadingPlanId(null);
        }
    };

    const getPlanPrice = (plan: Plan) => {
        if (plan.is_contact_plan) return null;

        const targetInterval = isAnnual ? 'year' : 'month';
        const price = plan.prices?.find((p) => p.interval === targetInterval);

        if (price && price.amount !== null) {
            return {
                amount: price.amount,
                periodLabel:
                    price.period_label || (isAnnual ? 'por ano' : 'por mês'),
            };
        }

        return {
            amount: plan.price_month,
            periodLabel: 'por mês',
        };
    };

    return (
        <>
            <Head title="Bem-vindo!" />
            <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-gray-50 to-white p-4 dark:from-gray-900 dark:to-gray-800">
                <div className="w-full max-w-2xl">
                    {/* Header */}
                    <div className="mb-8 text-center">
                        <Sparkles className="mx-auto mb-4 h-12 w-12 text-purple-600" />
                        <h1 className="mb-2 text-3xl font-bold">
                            Bem-vindo ao Lucro Fácil!
                        </h1>
                        <p className="text-muted-foreground">
                            Vamos configurar tudo rapidinho para você começar
                        </p>
                    </div>

                    {/* Progress Steps */}
                    <div className="mb-8 flex justify-center gap-2">
                        {[1, 2, 3].map((step) => (
                            <div
                                key={step}
                                className={`h-2 w-20 rounded-full ${
                                    step <= currentStep
                                        ? 'bg-purple-600'
                                        : 'bg-gray-200'
                                }`}
                            />
                        ))}
                    </div>

                    {/* Step 1: Tipo de Negócio */}
                    {currentStep === 1 && presets && (
                        <div className="rounded-lg border bg-white p-8 dark:bg-gray-800">
                            <h2 className="mb-6 text-2xl font-bold">
                                Qual o seu tipo de negócio?
                            </h2>
                            <p className="mb-6 text-muted-foreground">
                                Vamos criar produtos e ingredientes prontos para
                                você!
                            </p>

                            <RadioGroup
                                value={selectedBusinessType}
                                onValueChange={setSelectedBusinessType}
                            >
                                {presets.map((preset) => (
                                    <FieldLabel
                                        key={preset.id}
                                        htmlFor={preset.id}
                                    >
                                        <Field orientation="horizontal">
                                            <FieldContent>
                                                <FieldTitle>
                                                    {preset.name}
                                                </FieldTitle>
                                                <FieldDescription>
                                                    {preset.products_count}{' '}
                                                    produtos •{' '}
                                                    {preset.ingredients_count}{' '}
                                                    ingredientes
                                                </FieldDescription>
                                            </FieldContent>
                                            <RadioGroupItem
                                                value={preset.id}
                                                id={preset.id}
                                            />
                                        </Field>
                                    </FieldLabel>
                                ))}
                            </RadioGroup>

                            <div className="mt-8 flex justify-between">
                                <Button
                                    variant="ghost"
                                    onClick={handleSkip}
                                    disabled={loading}
                                >
                                    Pular
                                </Button>
                                <Button
                                    onClick={handleBusinessTypeSubmit}
                                    disabled={!selectedBusinessType || loading}
                                >
                                    Continuar →
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Confirmação */}
                    {currentStep === 2 && presetDetails && (
                        <div className="rounded-lg border bg-white p-8 dark:bg-gray-800">
                            <h2 className="mb-6 text-2xl font-bold">
                                Tudo pronto! ✨
                            </h2>
                            <p className="mb-6 text-muted-foreground">
                                Criamos para você:
                            </p>

                            <div className="mb-6 space-y-3">
                                <div className="flex items-center gap-3">
                                    <Check className="h-5 w-5 text-green-500" />
                                    <span>
                                        {presetDetails.products.length} produtos
                                        populares
                                    </span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Check className="h-5 w-5 text-green-500" />
                                    <span>
                                        {presetDetails.ingredients.length}{' '}
                                        ingredientes
                                    </span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Check className="h-5 w-5 text-green-500" />
                                    <span>
                                        {presetDetails.categories.length}{' '}
                                        categorias
                                    </span>
                                </div>
                            </div>

                            <p className="mb-6 text-sm text-muted-foreground">
                                Você pode editar ou adicionar mais itens depois!
                            </p>

                            <div className="flex justify-end">
                                <Button
                                    onClick={() =>
                                        router.get('/onboarding?step=3')
                                    }
                                >
                                    Continuar →
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Escolha do Plano */}
                    {currentStep === 3 && plans && (
                        <div className="rounded-lg border bg-white p-8 dark:bg-gray-800">
                            <h2 className="mb-4 text-2xl font-bold">
                                Escolha seu plano
                            </h2>
                            <p className="mb-6 text-muted-foreground">
                                Você está no plano FREE. Que tal experimentar 7
                                dias grátis?
                            </p>

                            <div className="mb-6 flex items-center justify-center gap-3">
                                <Label
                                    htmlFor="onboarding-billing-toggle"
                                    className={`text-sm font-medium transition-colors ${
                                        !isAnnual
                                            ? 'text-gray-900 dark:text-white'
                                            : 'text-gray-500 dark:text-gray-400'
                                    }`}
                                >
                                    Mensal
                                </Label>
                                <Switch
                                    id="onboarding-billing-toggle"
                                    checked={isAnnual}
                                    onCheckedChange={setIsAnnual}
                                />
                                <Label
                                    htmlFor="onboarding-billing-toggle"
                                    className={`text-sm font-medium transition-colors ${
                                        isAnnual
                                            ? 'text-gray-900 dark:text-white'
                                            : 'text-gray-500 dark:text-gray-400'
                                    }`}
                                >
                                    Anual
                                    <span className="ml-1.5 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-900 dark:text-green-300">
                                        Economize
                                    </span>
                                </Label>
                            </div>

                            <div className="mb-6 space-y-4">
                                {plans.map((plan) => {
                                    const priceInfo = getPlanPrice(plan);
                                    return (
                                        <div
                                            key={plan.id}
                                            className="rounded-lg border p-4 hover:border-purple-600"
                                        >
                                            <div className="mb-2 flex items-center justify-between">
                                                <div>
                                                    <h3 className="font-bold">
                                                        {plan.name}
                                                    </h3>
                                                    {priceInfo &&
                                                        priceInfo.amount !==
                                                            null && (
                                                            <p className="text-sm text-muted-foreground">
                                                                R${' '}
                                                                {priceInfo.amount.toFixed(
                                                                    2,
                                                                )}{' '}
                                                                {
                                                                    priceInfo.periodLabel
                                                                }
                                                            </p>
                                                        )}
                                                </div>
                                                <Button
                                                    onClick={() =>
                                                        handleSelectPlan(
                                                            plan.id,
                                                        )
                                                    }
                                                    disabled={
                                                        loadingPlanId !== null
                                                    }
                                                >
                                                    {loadingPlanId ===
                                                    plan.id ? (
                                                        <>
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                            Carregando...
                                                        </>
                                                    ) : (
                                                        'Experimentar Grátis'
                                                    )}
                                                </Button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="flex justify-between">
                                <Button
                                    variant="ghost"
                                    onClick={handleComplete}
                                    disabled={loading}
                                >
                                    Continuar sem plano
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
