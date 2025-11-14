import { Badge } from '@/components/ui/badge';
import {
    AlertCircle,
    Ban,
    Check,
    CheckCircle2,
    CircleCheck as CircleCheckIcon,
    ClockIcon,
    FileText,
    HandMetal,
    Home,
    MapPin,
    PackageCheck,
    Package as PackageIcon,
    PackageOpen,
    PackageX,
    Phone,
    RefreshCw,
    RotateCcw,
    ShieldAlert,
    ShieldCheck,
    ThumbsDown,
    ThumbsUp,
    Truck as TruckIcon,
    Users,
    Utensils as UtensilsIcon,
    XCircle as XCircleIcon,
} from 'lucide-react';

export type OrderStatus =
    // ORDER_STATUS
    | 'PLACED'
    | 'PLC'
    | 'CONFIRMED'
    | 'CFM'
    | 'SEPARATION_STARTED'
    | 'SPS'
    | 'SEPARATION_ENDED'
    | 'SPE'
    | 'READY_TO_PICKUP'
    | 'RTP'
    | 'DISPATCHED'
    | 'DSP'
    | 'CONCLUDED'
    | 'CON'
    | 'CANCELLED'
    | 'CAN'
    // CANCELLATION_REQUEST
    | 'CANCELLATION_REQUESTED'
    | 'CAR'
    | 'CANCELLATION_REQUEST_FAILED'
    | 'CARF'
    | 'CONSUMER_CANCELLATION_REQUESTED'
    | 'CCR'
    | 'CONSUMER_CANCELLATION_ACCEPTED'
    | 'CCA'
    | 'CONSUMER_CANCELLATION_DENIED'
    | 'CCD'
    // HANDSHAKE_PLATFORM
    | 'HANDSHAKE_DISPUTE'
    | 'HSD'
    | 'HANDSHAKE_SETTLEMENT'
    | 'HSS'
    // DELIVERY
    | 'ASSIGN_DRIVER'
    | 'ADR'
    | 'GOING_TO_ORIGIN'
    | 'GTO'
    | 'ARRIVED_AT_ORIGIN'
    | 'AAO'
    | 'DELIVERY_DRIVER_DEALLOCATED'
    | 'DDD'
    | 'COLLECTED'
    | 'CLT'
    | 'ARRIVED_AT_DESTINATION'
    | 'AAD'
    | 'DELIVERY_RETURNING_TO_ORIGIN'
    | 'DRGO'
    | 'DELIVERY_RETURNED_TO_ORIGIN'
    | 'DRDO'
    | 'DELIVERY_CANCELLATION_REQUESTED'
    | 'DCR'
    | 'DELIVERY_DROP_CODE_REQUESTED'
    | 'DDCR'
    | 'DELIVERY_DROP_CODE_VALIDATION_SUCCESS'
    | 'DDCS'
    | 'DELIVERY_RETURN_CODE_REQUESTED'
    | 'DRCR'
    | 'DELIVERY_PICKUP_CODE_REQUESTED'
    | 'DPCR'
    | 'DELIVERY_PICKUP_CODE_VALIDATION_SUCCESS'
    | 'DPCS'
    // DELIVERY_ADDRESS
    | 'DELIVERY_ADDRESS_CHANGE_REQUESTED'
    | 'DAR'
    | 'DELIVERY_ADDRESS_CHANGE_USER_CONFIRMED'
    | 'DAU'
    | 'DELIVERY_ADDRESS_CHANGE_ACCEPTED'
    | 'DAA'
    | 'DELIVERY_ADDRESS_CHANGE_DENIED'
    | 'DAD'
    // DELIVERY_GROUP
    | 'DELIVERY_GROUP_ASSIGNED'
    | 'DGA'
    | 'DELIVERY_GROUP_DISMISSED'
    | 'DGD'
    | 'DELIVERY_GROUP_ASSOCIATED'
    | 'DGAC'
    | 'DELIVERY_GROUP_DISSOCIATED'
    | 'DGDC'
    | 'DELIVERY_GROUP_UPDATED'
    | 'DGU'
    // DELIVERY_ONDEMAND
    | 'REQUEST_DRIVER'
    | 'RDR'
    | 'REQUEST_DRIVER_SUCCESS'
    | 'RDS'
    | 'REQUEST_DRIVER_FAILED'
    | 'RDF'
    | 'DELIVERY_CANCELLATION_REQUEST_ACCEPTED'
    | 'DCRA'
    | 'DELIVERY_CANCELLATION_REQUEST_REJECTED'
    | 'DCRR'
    // DELIVERY_COMPLEMENT
    | 'RETURN_TO_STORE'
    | 'RTS'
    // OUTROS
    | 'ORDER_PATCHED'
    | 'OPA'
    | 'RECOMMENDED_PREPARATION_START'
    | 'RPS'
    | 'PREPARATION_STARTED'
    | 'PRS'
    | 'CONSUMER_PREPARATION_TIME_REQUESTED'
    | 'CPR'
    | 'CHANGE_PREPARATION_TIME'
    | 'CPT'
    | 'BOX_ASSIGNED'
    | 'BOA'
    | 'READY_FOR_INVOICE'
    | 'RFI';

interface Props {
    status: OrderStatus;
}

const statusConfig: Record<
    string,
    { label: string; color: string; icon: React.ElementType }
> = {
    // ORDER_STATUS
    PLACED: {
        label: 'Pedido Recebido',
        color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
        icon: ClockIcon,
    },
    PLC: {
        label: 'Pedido Recebido',
        color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
        icon: ClockIcon,
    },
    CONFIRMED: {
        label: 'Confirmado',
        color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
        icon: CircleCheckIcon,
    },
    CFM: {
        label: 'Confirmado',
        color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
        icon: CircleCheckIcon,
    },
    SEPARATION_STARTED: {
        label: 'Separação Iniciada',
        color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
        icon: PackageOpen,
    },
    SEPARATION_START: {
        label: 'Separação Iniciada',
        color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
        icon: PackageOpen,
    },
    SPS: {
        label: 'Separação Iniciada',
        color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
        icon: PackageOpen,
    },
    SEPARATION_ENDED: {
        label: 'Separação Finalizada',
        color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
        icon: PackageCheck,
    },
    SEPARATION_END: {
        label: 'Separação Finalizada',
        color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
        icon: PackageCheck,
    },
    SPE: {
        label: 'Separação Finalizada',
        color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
        icon: PackageCheck,
    },
    READY_TO_PICKUP: {
        label: 'Pronto para Retirada',
        color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
        icon: UtensilsIcon,
    },
    RTP: {
        label: 'Pronto para Retirada',
        color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
        icon: UtensilsIcon,
    },
    DISPATCHED: {
        label: 'Em Rota de Entrega',
        color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300',
        icon: TruckIcon,
    },
    DSP: {
        label: 'Em Rota de Entrega',
        color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300',
        icon: TruckIcon,
    },
    CONCLUDED: {
        label: 'Concluído',
        color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300',
        icon: CheckCircle2,
    },
    CON: {
        label: 'Concluído',
        color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300',
        icon: CheckCircle2,
    },
    CANCELLED: {
        label: 'Cancelado',
        color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
        icon: XCircleIcon,
    },
    CAN: {
        label: 'Cancelado',
        color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
        icon: XCircleIcon,
    },

    // CANCELLATION_REQUEST
    CANCELLATION_REQUESTED: {
        label: 'Cancelamento Solicitado',
        color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
        icon: AlertCircle,
    },
    CAR: {
        label: 'Cancelamento Solicitado',
        color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
        icon: AlertCircle,
    },
    CANCELLATION_REQUEST_FAILED: {
        label: 'Falha ao Solicitar Cancelamento',
        color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
        icon: XCircleIcon,
    },
    CARF: {
        label: 'Falha ao Solicitar Cancelamento',
        color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
        icon: XCircleIcon,
    },
    CONSUMER_CANCELLATION_REQUESTED: {
        label: 'Cliente Solicitou Cancelamento',
        color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
        icon: Users,
    },
    CCR: {
        label: 'Cliente Solicitou Cancelamento',
        color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
        icon: Users,
    },
    CONSUMER_CANCELLATION_ACCEPTED: {
        label: 'Cancelamento do Cliente Aceito',
        color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
        icon: ThumbsUp,
    },
    CCA: {
        label: 'Cancelamento do Cliente Aceito',
        color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
        icon: ThumbsUp,
    },
    CONSUMER_CANCELLATION_DENIED: {
        label: 'Cancelamento do Cliente Negado',
        color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
        icon: ThumbsDown,
    },
    CCD: {
        label: 'Cancelamento do Cliente Negado',
        color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
        icon: ThumbsDown,
    },

    // HANDSHAKE_PLATFORM
    HANDSHAKE_DISPUTE: {
        label: 'Disputa Aberta',
        color: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
        icon: ShieldAlert,
    },
    HSD: {
        label: 'Disputa Aberta',
        color: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
        icon: ShieldAlert,
    },
    HANDSHAKE_SETTLEMENT: {
        label: 'Acordo Realizado',
        color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
        icon: HandMetal,
    },
    HSS: {
        label: 'Acordo Realizado',
        color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
        icon: HandMetal,
    },

    // DELIVERY
    ASSIGN_DRIVER: {
        label: 'Entregador Designado',
        color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
        icon: Users,
    },
    ADR: {
        label: 'Entregador Designado',
        color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
        icon: Users,
    },
    GOING_TO_ORIGIN: {
        label: 'Indo para Coleta',
        color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
        icon: MapPin,
    },
    GTO: {
        label: 'Indo para Coleta',
        color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
        icon: MapPin,
    },
    ARRIVED_AT_ORIGIN: {
        label: 'Chegou no Local de Coleta',
        color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
        icon: Home,
    },
    AAO: {
        label: 'Chegou no Local de Coleta',
        color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
        icon: Home,
    },
    DELIVERY_DRIVER_DEALLOCATED: {
        label: 'Entregador Removido',
        color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
        icon: PackageX,
    },
    DDD: {
        label: 'Entregador Removido',
        color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
        icon: PackageX,
    },
    COLLECTED: {
        label: 'Pedido Coletado',
        color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300',
        icon: PackageCheck,
    },
    CLT: {
        label: 'Pedido Coletado',
        color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300',
        icon: PackageCheck,
    },
    ARRIVED_AT_DESTINATION: {
        label: 'Chegou no Destino',
        color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
        icon: MapPin,
    },
    AAD: {
        label: 'Chegou no Destino',
        color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
        icon: MapPin,
    },
    DELIVERY_RETURNING_TO_ORIGIN: {
        label: 'Retornando para Origem',
        color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
        icon: RotateCcw,
    },
    DRGO: {
        label: 'Retornando para Origem',
        color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
        icon: RotateCcw,
    },
    DELIVERY_RETURNED_TO_ORIGIN: {
        label: 'Retornou para Origem',
        color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
        icon: Home,
    },
    DRDO: {
        label: 'Retornou para Origem',
        color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
        icon: Home,
    },
    DELIVERY_CANCELLATION_REQUESTED: {
        label: 'Cancelamento de Entrega Solicitado',
        color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
        icon: Ban,
    },
    DCR: {
        label: 'Cancelamento de Entrega Solicitado',
        color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
        icon: Ban,
    },
    DELIVERY_DROP_CODE_REQUESTED: {
        label: 'Código de Entrega Solicitado',
        color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
        icon: Phone,
    },
    DDCR: {
        label: 'Código de Entrega Solicitado',
        color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
        icon: Phone,
    },
    DELIVERY_DROP_CODE_VALIDATION_SUCCESS: {
        label: 'Código de Entrega Validado',
        color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
        icon: Check,
    },
    DDCS: {
        label: 'Código de Entrega Validado',
        color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
        icon: Check,
    },
    DELIVERY_RETURN_CODE_REQUESTED: {
        label: 'Código de Retorno Solicitado',
        color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
        icon: Phone,
    },
    DRCR: {
        label: 'Código de Retorno Solicitado',
        color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
        icon: Phone,
    },
    DELIVERY_PICKUP_CODE_REQUESTED: {
        label: 'Código de Retirada Solicitado',
        color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
        icon: Phone,
    },
    DPCR: {
        label: 'Código de Retirada Solicitado',
        color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
        icon: Phone,
    },
    DELIVERY_PICKUP_CODE_VALIDATION_SUCCESS: {
        label: 'Código de Retirada Validado',
        color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
        icon: Check,
    },
    DPCS: {
        label: 'Código de Retirada Validado',
        color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
        icon: Check,
    },

    // DELIVERY_ADDRESS
    DELIVERY_ADDRESS_CHANGE_REQUESTED: {
        label: 'Alteração de Endereço Solicitada',
        color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
        icon: MapPin,
    },
    DAR: {
        label: 'Alteração de Endereço Solicitada',
        color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
        icon: MapPin,
    },
    DELIVERY_ADDRESS_CHANGE_USER_CONFIRMED: {
        label: 'Cliente Confirmou Novo Endereço',
        color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
        icon: Users,
    },
    DAU: {
        label: 'Cliente Confirmou Novo Endereço',
        color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
        icon: Users,
    },
    DELIVERY_ADDRESS_CHANGE_ACCEPTED: {
        label: 'Alteração de Endereço Aceita',
        color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
        icon: CheckCircle2,
    },
    DAA: {
        label: 'Alteração de Endereço Aceita',
        color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
        icon: CheckCircle2,
    },
    DELIVERY_ADDRESS_CHANGE_DENIED: {
        label: 'Alteração de Endereço Negada',
        color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
        icon: XCircleIcon,
    },
    DAD: {
        label: 'Alteração de Endereço Negada',
        color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
        icon: XCircleIcon,
    },

    // DELIVERY_GROUP
    DELIVERY_GROUP_ASSIGNED: {
        label: 'Grupo de Entrega Atribuído',
        color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
        icon: Users,
    },
    DGA: {
        label: 'Grupo de Entrega Atribuído',
        color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
        icon: Users,
    },
    DELIVERY_GROUP_DISMISSED: {
        label: 'Grupo de Entrega Removido',
        color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
        icon: Users,
    },
    DGD: {
        label: 'Grupo de Entrega Removido',
        color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
        icon: Users,
    },
    DELIVERY_GROUP_ASSOCIATED: {
        label: 'Associado ao Grupo de Entrega',
        color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
        icon: Users,
    },
    DGAC: {
        label: 'Associado ao Grupo de Entrega',
        color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
        icon: Users,
    },
    DELIVERY_GROUP_DISSOCIATED: {
        label: 'Desassociado do Grupo de Entrega',
        color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
        icon: Users,
    },
    DGDC: {
        label: 'Desassociado do Grupo de Entrega',
        color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
        icon: Users,
    },
    DELIVERY_GROUP_UPDATED: {
        label: 'Grupo de Entrega Atualizado',
        color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
        icon: RefreshCw,
    },
    DGU: {
        label: 'Grupo de Entrega Atualizado',
        color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
        icon: RefreshCw,
    },

    // DELIVERY_ONDEMAND
    REQUEST_DRIVER: {
        label: 'Solicitando Entregador',
        color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
        icon: Users,
    },
    RDR: {
        label: 'Solicitando Entregador',
        color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
        icon: Users,
    },
    REQUEST_DRIVER_SUCCESS: {
        label: 'Entregador Encontrado',
        color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
        icon: CheckCircle2,
    },
    RDS: {
        label: 'Entregador Encontrado',
        color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
        icon: CheckCircle2,
    },
    REQUEST_DRIVER_FAILED: {
        label: 'Falha ao Buscar Entregador',
        color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
        icon: XCircleIcon,
    },
    RDF: {
        label: 'Falha ao Buscar Entregador',
        color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
        icon: XCircleIcon,
    },
    DELIVERY_CANCELLATION_REQUEST_ACCEPTED: {
        label: 'Cancelamento de Entrega Aceito',
        color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
        icon: CheckCircle2,
    },
    DCRA: {
        label: 'Cancelamento de Entrega Aceito',
        color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
        icon: CheckCircle2,
    },
    DELIVERY_CANCELLATION_REQUEST_REJECTED: {
        label: 'Cancelamento de Entrega Negado',
        color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
        icon: ShieldCheck,
    },
    DCRR: {
        label: 'Cancelamento de Entrega Negado',
        color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
        icon: ShieldCheck,
    },

    // DELIVERY_COMPLEMENT
    RETURN_TO_STORE: {
        label: 'Retornar para Loja',
        color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
        icon: Home,
    },
    RTS: {
        label: 'Retornar para Loja',
        color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
        icon: Home,
    },

    // OUTROS
    ORDER_PATCHED: {
        label: 'Pedido Atualizado',
        color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
        icon: RefreshCw,
    },
    OPA: {
        label: 'Pedido Atualizado',
        color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
        icon: RefreshCw,
    },
    RECOMMENDED_PREPARATION_START: {
        label: 'Início de Preparo Recomendado',
        color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
        icon: ClockIcon,
    },
    RPS: {
        label: 'Início de Preparo Recomendado',
        color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
        icon: ClockIcon,
    },
    PREPARATION_STARTED: {
        label: 'Preparo Iniciado',
        color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
        icon: UtensilsIcon,
    },
    PRS: {
        label: 'Preparo Iniciado',
        color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
        icon: UtensilsIcon,
    },
    CONSUMER_PREPARATION_TIME_REQUESTED: {
        label: 'Cliente Solicitou Tempo de Preparo',
        color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
        icon: Users,
    },
    CPR: {
        label: 'Cliente Solicitou Tempo de Preparo',
        color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
        icon: Users,
    },
    CHANGE_PREPARATION_TIME: {
        label: 'Tempo de Preparo Alterado',
        color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
        icon: ClockIcon,
    },
    CPT: {
        label: 'Tempo de Preparo Alterado',
        color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
        icon: ClockIcon,
    },
    BOX_ASSIGNED: {
        label: 'Caixa Atribuída',
        color: 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-300',
        icon: PackageIcon,
    },
    BOA: {
        label: 'Caixa Atribuída',
        color: 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-300',
        icon: PackageIcon,
    },
    READY_FOR_INVOICE: {
        label: 'Pronto para Faturamento',
        color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300',
        icon: FileText,
    },
    RFI: {
        label: 'Pronto para Faturamento',
        color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300',
        icon: FileText,
    },
};

export function OrderStatusBadge({ status }: Props) {
    const {
        label,
        color,
        icon: Icon,
    } = statusConfig[status] ?? {
        label: status,
        color: 'bg-gray-500 text-white',
        icon: CircleCheckIcon,
    };

    return (
        <Badge variant="secondary" className={`${color} text-xs`}>
            <Icon className="h-2.5 w-2.5" />
            {label}
        </Badge>
    );
}
