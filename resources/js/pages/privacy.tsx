import { Button } from '@/components/ui/button';
import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, BarChart3 } from 'lucide-react';

export default function Privacy() {
    return (
        <>
            <Head title="Política de Privacidade - Lucro Fácil" />

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
                            Política de Privacidade
                        </h1>

                        <div className="prose prose-gray max-w-none">
                            <p className="text-sm text-gray-500">
                                Última atualização:{' '}
                                {new Date().toLocaleDateString('pt-BR')}
                            </p>

                            <section className="mt-8">
                                <h2 className="text-2xl font-bold text-gray-900">
                                    1. Introdução
                                </h2>
                                <p className="mt-4 text-gray-700">
                                    Esta Política de Privacidade descreve como o
                                    Lucro Fácil coleta, usa, armazena e protege
                                    suas informações pessoais. Estamos
                                    comprometidos em proteger sua privacidade e
                                    cumprir a Lei Geral de Proteção de Dados
                                    (LGPD).
                                </p>
                            </section>

                            <section className="mt-8">
                                <h2 className="text-2xl font-bold text-gray-900">
                                    2. Informações Coletadas
                                </h2>
                                <p className="mt-4 text-gray-700">
                                    Coletamos diferentes tipos de informações
                                    para fornecer e melhorar nosso serviço:
                                </p>

                                <h3 className="mt-6 text-xl font-bold text-gray-900">
                                    2.1. Informações Fornecidas por Você
                                </h3>
                                <ul className="mt-4 list-disc space-y-2 pl-6 text-gray-700">
                                    <li>Nome e sobrenome</li>
                                    <li>E-mail</li>
                                    <li>Telefone</li>
                                    <li>CNPJ e dados da empresa</li>
                                    <li>Endereço</li>
                                    <li>
                                        Informações de pagamento (processadas
                                        pela Stripe)
                                    </li>
                                </ul>

                                <h3 className="mt-6 text-xl font-bold text-gray-900">
                                    2.2. Informações de Uso
                                </h3>
                                <ul className="mt-4 list-disc space-y-2 pl-6 text-gray-700">
                                    <li>
                                        Dados de navegação (páginas visitadas,
                                        tempo de acesso)
                                    </li>
                                    <li>
                                        Endereço IP e localização aproximada
                                    </li>
                                    <li>Tipo de dispositivo e navegador</li>
                                    <li>Logs de sistema e erros</li>
                                </ul>

                                <h3 className="mt-6 text-xl font-bold text-gray-900">
                                    2.3. Dados de Negócio
                                </h3>
                                <ul className="mt-4 list-disc space-y-2 pl-6 text-gray-700">
                                    <li>Pedidos e vendas</li>
                                    <li>Fichas técnicas e ingredientes</li>
                                    <li>Produtos e cardápio</li>
                                    <li>Informações financeiras e custos</li>
                                    <li>
                                        Dados de integrações (iFood, 99Food,
                                        Takeat, etc.)
                                    </li>
                                </ul>
                            </section>

                            <section className="mt-8">
                                <h2 className="text-2xl font-bold text-gray-900">
                                    3. Como Usamos Suas Informações
                                </h2>
                                <p className="mt-4 text-gray-700">
                                    Utilizamos suas informações para:
                                </p>
                                <ul className="mt-4 list-disc space-y-2 pl-6 text-gray-700">
                                    <li>Fornecer e manter nossos serviços</li>
                                    <li>
                                        Processar pagamentos e gerenciar
                                        assinaturas
                                    </li>
                                    <li>
                                        Calcular lucros, custos e métricas
                                        financeiras
                                    </li>
                                    <li>
                                        Sincronizar dados com marketplaces
                                        integrados
                                    </li>
                                    <li>
                                        Enviar notificações importantes sobre
                                        sua conta
                                    </li>
                                    <li>
                                        Melhorar nossa plataforma e desenvolver
                                        novos recursos
                                    </li>
                                    <li>Fornecer suporte técnico</li>
                                    <li>
                                        Prevenir fraudes e garantir segurança
                                    </li>
                                    <li>Cumprir obrigações legais</li>
                                </ul>
                            </section>

                            <section className="mt-8">
                                <h2 className="text-2xl font-bold text-gray-900">
                                    4. Compartilhamento de Informações
                                </h2>
                                <p className="mt-4 text-gray-700">
                                    Não vendemos suas informações pessoais.
                                    Podemos compartilhar dados apenas com:
                                </p>

                                <h3 className="mt-6 text-xl font-bold text-gray-900">
                                    4.1. Prestadores de Serviços
                                </h3>
                                <ul className="mt-4 list-disc space-y-2 pl-6 text-gray-700">
                                    <li>
                                        <strong>Stripe:</strong> Processamento
                                        de pagamentos
                                    </li>
                                    <li>
                                        <strong>AWS:</strong> Hospedagem e
                                        armazenamento
                                    </li>
                                    <li>
                                        <strong>Marketplaces:</strong> iFood,
                                        99Food, Takeat para sincronização de
                                        pedidos
                                    </li>
                                </ul>

                                <h3 className="mt-6 text-xl font-bold text-gray-900">
                                    4.2. Requisitos Legais
                                </h3>
                                <p className="mt-4 text-gray-700">
                                    Podemos divulgar informações quando exigido
                                    por lei ou para proteger nossos direitos
                                    legais.
                                </p>
                            </section>

                            <section className="mt-8">
                                <h2 className="text-2xl font-bold text-gray-900">
                                    5. Armazenamento e Segurança
                                </h2>
                                <p className="mt-4 text-gray-700">
                                    Implementamos medidas de segurança técnicas
                                    e organizacionais para proteger seus dados:
                                </p>
                                <ul className="mt-4 list-disc space-y-2 pl-6 text-gray-700">
                                    <li>
                                        Criptografia SSL/TLS para transmissão de
                                        dados
                                    </li>
                                    <li>
                                        Criptografia de dados sensíveis em
                                        repouso
                                    </li>
                                    <li>Controles de acesso rigorosos</li>
                                    <li>Monitoramento contínuo de segurança</li>
                                    <li>Backups regulares</li>
                                    <li>
                                        Infraestrutura em servidores seguros
                                        (AWS)
                                    </li>
                                </ul>
                                <p className="mt-4 text-gray-700">
                                    Seus dados são armazenados em servidores
                                    localizados no Brasil e protegidos de acordo
                                    com as melhores práticas de segurança da
                                    informação.
                                </p>
                            </section>

                            <section className="mt-8">
                                <h2 className="text-2xl font-bold text-gray-900">
                                    6. Seus Direitos (LGPD)
                                </h2>
                                <p className="mt-4 text-gray-700">
                                    De acordo com a LGPD, você tem direito a:
                                </p>
                                <ul className="mt-4 list-disc space-y-2 pl-6 text-gray-700">
                                    <li>
                                        <strong>Confirmação:</strong> Saber se
                                        processamos seus dados pessoais
                                    </li>
                                    <li>
                                        <strong>Acesso:</strong> Solicitar uma
                                        cópia dos seus dados
                                    </li>
                                    <li>
                                        <strong>Correção:</strong> Atualizar
                                        dados incompletos ou incorretos
                                    </li>
                                    <li>
                                        <strong>Anonimização/Bloqueio:</strong>{' '}
                                        Solicitar anonimização ou bloqueio de
                                        dados desnecessários
                                    </li>
                                    <li>
                                        <strong>Eliminação:</strong> Solicitar
                                        exclusão de dados (exceto quando houver
                                        obrigação legal de manter)
                                    </li>
                                    <li>
                                        <strong>Portabilidade:</strong> Receber
                                        seus dados em formato estruturado
                                    </li>
                                    <li>
                                        <strong>
                                            Revogação do Consentimento:
                                        </strong>{' '}
                                        Cancelar autorização de uso dos dados
                                    </li>
                                    <li>
                                        <strong>Oposição:</strong> Opor-se a
                                        determinados tratamentos de dados
                                    </li>
                                </ul>
                                <p className="mt-4 text-gray-700">
                                    Para exercer qualquer desses direitos, entre
                                    em contato através de
                                    suporte@lucrofacil.com.br
                                </p>
                            </section>

                            <section className="mt-8">
                                <h2 className="text-2xl font-bold text-gray-900">
                                    7. Cookies e Tecnologias Similares
                                </h2>
                                <p className="mt-4 text-gray-700">
                                    Utilizamos cookies e tecnologias similares
                                    para:
                                </p>
                                <ul className="mt-4 list-disc space-y-2 pl-6 text-gray-700">
                                    <li>Manter você logado na plataforma</li>
                                    <li>Lembrar suas preferências</li>
                                    <li>Analisar o uso da plataforma</li>
                                    <li>Melhorar a experiência do usuário</li>
                                </ul>
                                <p className="mt-4 text-gray-700">
                                    Você pode configurar seu navegador para
                                    recusar cookies, mas isso pode afetar
                                    algumas funcionalidades.
                                </p>
                            </section>

                            <section className="mt-8">
                                <h2 className="text-2xl font-bold text-gray-900">
                                    8. Retenção de Dados
                                </h2>
                                <p className="mt-4 text-gray-700">
                                    Mantemos seus dados pessoais apenas pelo
                                    tempo necessário para:
                                </p>
                                <ul className="mt-4 list-disc space-y-2 pl-6 text-gray-700">
                                    <li>Fornecer nossos serviços</li>
                                    <li>
                                        Cumprir obrigações legais e contratuais
                                    </li>
                                    <li>Resolver disputas</li>
                                    <li>Prevenir fraudes</li>
                                </ul>
                                <p className="mt-4 text-gray-700">
                                    Após o cancelamento da conta, seus dados
                                    serão mantidos por 5 anos conforme
                                    legislação fiscal brasileira e então
                                    excluídos permanentemente.
                                </p>
                            </section>

                            <section className="mt-8">
                                <h2 className="text-2xl font-bold text-gray-900">
                                    9. Privacidade de Crianças
                                </h2>
                                <p className="mt-4 text-gray-700">
                                    Nossos serviços não são direcionados a
                                    menores de 18 anos. Não coletamos
                                    intencionalmente informações de crianças. Se
                                    identificarmos que coletamos dados de
                                    menores sem consentimento, excluiremos essas
                                    informações imediatamente.
                                </p>
                            </section>

                            <section className="mt-8">
                                <h2 className="text-2xl font-bold text-gray-900">
                                    10. Alterações nesta Política
                                </h2>
                                <p className="mt-4 text-gray-700">
                                    Podemos atualizar esta Política de
                                    Privacidade periodicamente. Notificaremos
                                    sobre mudanças significativas através da
                                    plataforma ou por e-mail. A data de "Última
                                    atualização" no topo desta página indica
                                    quando foi feita a última revisão.
                                </p>
                            </section>

                            <section className="mt-8">
                                <h2 className="text-2xl font-bold text-gray-900">
                                    11. Encarregado de Dados (DPO)
                                </h2>
                                <p className="mt-4 text-gray-700">
                                    Para questões relacionadas à proteção de
                                    dados e exercício de direitos da LGPD, entre
                                    em contato com nosso Encarregado de Proteção
                                    de Dados:
                                </p>
                                <ul className="mt-4 list-none space-y-2 text-gray-700">
                                    <li>
                                        <strong>E-mail:</strong>{' '}
                                        dpo@lucrofacil.com.br
                                    </li>
                                    <li>
                                        <strong>E-mail alternativo:</strong>{' '}
                                        suporte@lucrofacil.com.br
                                    </li>
                                    <li>
                                        <strong>WhatsApp:</strong> (11)
                                        99999-9999
                                    </li>
                                </ul>
                            </section>

                            <section className="mt-8">
                                <h2 className="text-2xl font-bold text-gray-900">
                                    12. Legislação Aplicável
                                </h2>
                                <p className="mt-4 text-gray-700">
                                    Esta Política de Privacidade é regida pela
                                    legislação brasileira, especialmente pela
                                    Lei Geral de Proteção de Dados (Lei nº
                                    13.709/2018) e pelo Marco Civil da Internet
                                    (Lei nº 12.965/2014).
                                </p>
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
