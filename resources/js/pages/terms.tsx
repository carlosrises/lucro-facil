import { Button } from '@/components/ui/button';
import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, BarChart3 } from 'lucide-react';

export default function Terms() {
    return (
        <>
            <Head title="Termos de Uso - Lucro Fácil" />

            <div className="min-h-screen bg-gray-50">
                {/* Header */}
                <header className="border-b border-gray-200 bg-white">
                    <nav className="container mx-auto flex items-center justify-between px-6 py-6 lg:px-8">
                        <Link href="/" className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-green-600 to-green-700">
                                <BarChart3 className="h-5 w-5 text-white" />
                            </div>
                            <span className="text-xl font-semibold text-gray-900">
                                Lucro Fácil
                            </span>
                        </Link>

                        <Link href="/">
                            <Button variant="ghost" size="sm">
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Voltar
                            </Button>
                        </Link>
                    </nav>
                </header>

                {/* Content */}
                <main className="container mx-auto max-w-4xl px-6 py-12 lg:px-8">
                    <div className="rounded-lg bg-white p-8 shadow-sm lg:p-12">
                        <h1 className="mb-8 text-4xl font-bold text-gray-900">
                            Termos de Uso
                        </h1>

                        <div className="prose prose-gray max-w-none">
                            <p className="text-sm text-gray-500">
                                Última atualização:{' '}
                                {new Date().toLocaleDateString('pt-BR')}
                            </p>

                            <section className="mt-8">
                                <h2 className="text-2xl font-bold text-gray-900">
                                    1. Aceitação dos Termos
                                </h2>
                                <p className="mt-4 text-gray-700">
                                    Ao acessar e usar o Lucro Fácil, você
                                    concorda em cumprir e estar vinculado a
                                    estes Termos de Uso. Se você não concordar
                                    com qualquer parte destes termos, não deverá
                                    usar nossa plataforma.
                                </p>
                            </section>

                            <section className="mt-8">
                                <h2 className="text-2xl font-bold text-gray-900">
                                    2. Descrição do Serviço
                                </h2>
                                <p className="mt-4 text-gray-700">
                                    O Lucro Fácil é uma plataforma SaaS que
                                    oferece gestão financeira completa para
                                    restaurantes e estabelecimentos de
                                    alimentação, incluindo:
                                </p>
                                <ul className="mt-4 list-disc space-y-2 pl-6 text-gray-700">
                                    <li>
                                        Cálculo de lucro em tempo real, pedido a
                                        pedido
                                    </li>
                                    <li>
                                        Integração com marketplaces (iFood,
                                        99Food, Takeat, etc.)
                                    </li>
                                    <li>
                                        Gestão de fichas técnicas e custos (CMV)
                                    </li>
                                    <li>Dashboards e relatórios gerenciais</li>
                                    <li>Controle de taxas e comissões</li>
                                </ul>
                            </section>

                            <section className="mt-8">
                                <h2 className="text-2xl font-bold text-gray-900">
                                    3. Cadastro e Conta
                                </h2>
                                <p className="mt-4 text-gray-700">
                                    Para usar nossa plataforma, você deve criar
                                    uma conta fornecendo informações precisas e
                                    completas. Você é responsável por:
                                </p>
                                <ul className="mt-4 list-disc space-y-2 pl-6 text-gray-700">
                                    <li>
                                        Manter a confidencialidade de suas
                                        credenciais de acesso
                                    </li>
                                    <li>
                                        Todas as atividades que ocorrem em sua
                                        conta
                                    </li>
                                    <li>
                                        Notificar-nos imediatamente sobre
                                        qualquer uso não autorizado
                                    </li>
                                    <li>
                                        Fornecer informações verdadeiras e
                                        atualizadas
                                    </li>
                                </ul>
                            </section>

                            <section className="mt-8">
                                <h2 className="text-2xl font-bold text-gray-900">
                                    4. Planos e Pagamentos
                                </h2>
                                <p className="mt-4 text-gray-700">
                                    O Lucro Fácil oferece diferentes planos de
                                    assinatura. Ao se inscrever:
                                </p>
                                <ul className="mt-4 list-disc space-y-2 pl-6 text-gray-700">
                                    <li>
                                        Você terá 7 dias de teste grátis sem
                                        necessidade de cartão de crédito
                                    </li>
                                    <li>
                                        Após o período de teste, será cobrado o
                                        valor do plano escolhido
                                    </li>
                                    <li>
                                        O pagamento é processado de forma segura
                                        através da Stripe
                                    </li>
                                    <li>
                                        Você pode cancelar a qualquer momento,
                                        sem multas
                                    </li>
                                    <li>
                                        Reembolsos seguem nossa política de
                                        cancelamento
                                    </li>
                                </ul>
                            </section>

                            <section className="mt-8">
                                <h2 className="text-2xl font-bold text-gray-900">
                                    5. Uso Aceitável
                                </h2>
                                <p className="mt-4 text-gray-700">
                                    Você concorda em NÃO:
                                </p>
                                <ul className="mt-4 list-disc space-y-2 pl-6 text-gray-700">
                                    <li>
                                        Usar a plataforma para fins ilegais ou
                                        não autorizados
                                    </li>
                                    <li>
                                        Tentar obter acesso não autorizado a
                                        sistemas ou dados
                                    </li>
                                    <li>
                                        Interferir no funcionamento da
                                        plataforma
                                    </li>
                                    <li>
                                        Compartilhar sua conta com terceiros
                                    </li>
                                    <li>
                                        Copiar, modificar ou distribuir conteúdo
                                        sem autorização
                                    </li>
                                </ul>
                            </section>

                            <section className="mt-8">
                                <h2 className="text-2xl font-bold text-gray-900">
                                    6. Propriedade Intelectual
                                </h2>
                                <p className="mt-4 text-gray-700">
                                    Todo o conteúdo, recursos e funcionalidades
                                    da plataforma são propriedade do Lucro Fácil
                                    e protegidos por leis de direitos autorais.
                                    Você mantém a propriedade dos dados que
                                    inserir na plataforma.
                                </p>
                            </section>

                            <section className="mt-8">
                                <h2 className="text-2xl font-bold text-gray-900">
                                    7. Segurança e Privacidade
                                </h2>
                                <p className="mt-4 text-gray-700">
                                    Levamos a segurança de seus dados a sério.
                                    Implementamos medidas técnicas e
                                    organizacionais para proteger suas
                                    informações. Consulte nossa{' '}
                                    <Link
                                        href="/privacy"
                                        className="font-semibold text-green-600 hover:text-green-700"
                                    >
                                        Política de Privacidade
                                    </Link>{' '}
                                    para mais detalhes.
                                </p>
                            </section>

                            <section className="mt-8">
                                <h2 className="text-2xl font-bold text-gray-900">
                                    8. Limitação de Responsabilidade
                                </h2>
                                <p className="mt-4 text-gray-700">
                                    O Lucro Fácil é fornecido "como está". Não
                                    nos responsabilizamos por:
                                </p>
                                <ul className="mt-4 list-disc space-y-2 pl-6 text-gray-700">
                                    <li>
                                        Perdas ou danos decorrentes do uso ou
                                        incapacidade de usar a plataforma
                                    </li>
                                    <li>
                                        Decisões tomadas com base nas
                                        informações fornecidas
                                    </li>
                                    <li>
                                        Interrupções temporárias do serviço para
                                        manutenção
                                    </li>
                                    <li>
                                        Erros ou imprecisões nos dados
                                        fornecidos por integrações de terceiros
                                    </li>
                                </ul>
                            </section>

                            <section className="mt-8">
                                <h2 className="text-2xl font-bold text-gray-900">
                                    9. Cancelamento e Rescisão
                                </h2>
                                <p className="mt-4 text-gray-700">
                                    Você pode cancelar sua assinatura a qualquer
                                    momento através das configurações da conta.
                                    Reservamo-nos o direito de suspender ou
                                    encerrar sua conta se você violar estes
                                    termos.
                                </p>
                            </section>

                            <section className="mt-8">
                                <h2 className="text-2xl font-bold text-gray-900">
                                    10. Modificações
                                </h2>
                                <p className="mt-4 text-gray-700">
                                    Podemos modificar estes Termos de Uso a
                                    qualquer momento. Notificaremos sobre
                                    mudanças significativas através da
                                    plataforma ou por e-mail. O uso continuado
                                    após as mudanças constitui aceitação dos
                                    novos termos.
                                </p>
                            </section>

                            <section className="mt-8">
                                <h2 className="text-2xl font-bold text-gray-900">
                                    11. Contato
                                </h2>
                                <p className="mt-4 text-gray-700">
                                    Para questões sobre estes Termos de Uso,
                                    entre em contato:
                                </p>
                                <ul className="mt-4 list-none space-y-2 text-gray-700">
                                    <li>
                                        <strong>E-mail:</strong>{' '}
                                        suporte@lucrofacil.com.br
                                    </li>
                                    <li>
                                        <strong>WhatsApp:</strong> (11)
                                        99999-9999
                                    </li>
                                </ul>
                            </section>
                        </div>
                    </div>
                </main>

                {/* Footer */}
                <footer className="border-t border-gray-200 bg-white py-8">
                    <div className="container mx-auto px-6 text-center text-sm text-gray-600 lg:px-8">
                        © {new Date().getFullYear()} Lucro Fácil. Todos os
                        direitos reservados.
                    </div>
                </footer>
            </div>
        </>
    );
}
