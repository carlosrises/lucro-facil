<?php

namespace App\Enums;

/**
 * Mapeamento completo de status e eventos do iFood
 * Baseado em: https://developer.ifood.com.br/pt-BR/docs/guides/modules/order/events
 */
class IfoodOrderStatus
{
    /**
     * Mapeia código abreviado (code) para código completo (fullCode)
     */
    public const CODE_TO_FULLCODE = [
        // ORDER_STATUS
        'PLC' => 'PLACED',
        'CFM' => 'CONFIRMED',
        'SPS' => 'SEPARATION_STARTED',
        'SPE' => 'SEPARATION_ENDED',
        'RTP' => 'READY_TO_PICKUP',
        'DSP' => 'DISPATCHED',
        'CON' => 'CONCLUDED',
        'CAN' => 'CANCELLED',

        // CANCELLATION_REQUEST
        'CAR' => 'CANCELLATION_REQUESTED',
        'CARF' => 'CANCELLATION_REQUEST_FAILED',
        'CCR' => 'CONSUMER_CANCELLATION_REQUESTED',
        'CCA' => 'CONSUMER_CANCELLATION_ACCEPTED',
        'CCD' => 'CONSUMER_CANCELLATION_DENIED',

        // HANDSHAKE_PLATFORM
        'HSD' => 'HANDSHAKE_DISPUTE',
        'HSS' => 'HANDSHAKE_SETTLEMENT',

        // DELIVERY
        'ADR' => 'ASSIGN_DRIVER',
        'GTO' => 'GOING_TO_ORIGIN',
        'AAO' => 'ARRIVED_AT_ORIGIN',
        'DDD' => 'DELIVERY_DRIVER_DEALLOCATED',
        'CLT' => 'COLLECTED',
        'AAD' => 'ARRIVED_AT_DESTINATION',
        'DRGO' => 'DELIVERY_RETURNING_TO_ORIGIN',
        'DRDO' => 'DELIVERY_RETURNED_TO_ORIGIN',
        'DCR' => 'DELIVERY_CANCELLATION_REQUESTED',
        'DDCR' => 'DELIVERY_DROP_CODE_REQUESTED',
        'DDCS' => 'DELIVERY_DROP_CODE_VALIDATION_SUCCESS',
        'DRCR' => 'DELIVERY_RETURN_CODE_REQUESTED',
        'DPCR' => 'DELIVERY_PICKUP_CODE_REQUESTED',
        'DPCS' => 'DELIVERY_PICKUP_CODE_VALIDATION_SUCCESS',

        // DELIVERY_ADDRESS
        'DAR' => 'DELIVERY_ADDRESS_CHANGE_REQUESTED',
        'DAU' => 'DELIVERY_ADDRESS_CHANGE_USER_CONFIRMED',
        'DAA' => 'DELIVERY_ADDRESS_CHANGE_ACCEPTED',
        'DAD' => 'DELIVERY_ADDRESS_CHANGE_DENIED',

        // DELIVERY_GROUP
        'DGA' => 'DELIVERY_GROUP_ASSIGNED',
        'DGD' => 'DELIVERY_GROUP_DISMISSED',
        'DGAC' => 'DELIVERY_GROUP_ASSOCIATED',
        'DGDC' => 'DELIVERY_GROUP_DISSOCIATED',
        'DGU' => 'DELIVERY_GROUP_UPDATED',

        // DELIVERY_ONDEMAND
        'RDR' => 'REQUEST_DRIVER',
        'RDS' => 'REQUEST_DRIVER_SUCCESS',
        'RDF' => 'REQUEST_DRIVER_FAILED',
        'DCRA' => 'DELIVERY_CANCELLATION_REQUEST_ACCEPTED',
        'DCRR' => 'DELIVERY_CANCELLATION_REQUEST_REJECTED',

        // DELIVERY_COMPLEMENT
        'RTS' => 'RETURN_TO_STORE',

        // OUTROS
        'OPA' => 'ORDER_PATCHED',
        'RPS' => 'RECOMMENDED_PREPARATION_START',
        'PRS' => 'PREPARATION_STARTED',
        'CPR' => 'CONSUMER_PREPARATION_TIME_REQUESTED',
        'CPT' => 'CHANGE_PREPARATION_TIME',
        'BOA' => 'BOX_ASSIGNED',
        'RFI' => 'READY_FOR_INVOICE',
    ];

    /**
     * Mapeia código completo (fullCode) para código abreviado (code)
     */
    public const FULLCODE_TO_CODE = [
        // ORDER_STATUS
        'PLACED' => 'PLC',
        'CONFIRMED' => 'CFM',
        'SEPARATION_STARTED' => 'SPS',
        'SEPARATION_ENDED' => 'SPE',
        'READY_TO_PICKUP' => 'RTP',
        'DISPATCHED' => 'DSP',
        'CONCLUDED' => 'CON',
        'CANCELLED' => 'CAN',

        // CANCELLATION_REQUEST
        'CANCELLATION_REQUESTED' => 'CAR',
        'CANCELLATION_REQUEST_FAILED' => 'CARF',
        'CONSUMER_CANCELLATION_REQUESTED' => 'CCR',
        'CONSUMER_CANCELLATION_ACCEPTED' => 'CCA',
        'CONSUMER_CANCELLATION_DENIED' => 'CCD',
    ];

    /**
     * Converte código abreviado para completo
     */
    public static function codeToFullCode(string $code): string
    {
        return self::CODE_TO_FULLCODE[$code] ?? $code;
    }

    /**
     * Converte código completo para abreviado
     */
    public static function fullCodeToCode(string $fullCode): string
    {
        return self::FULLCODE_TO_CODE[$fullCode] ?? $fullCode;
    }

    /**
     * Verifica se um status/evento aceita ações (confirmar, despachar, etc)
     */
    public static function canPerformActions(string $status): array
    {
        $normalized = self::codeToFullCode($status);

        // Status que permitem despacho (delivery)
        $canDispatchStatuses = [
            'CONFIRMED',
            'SEPARATION_STARTED',
            'SEPARATION_ENDED',
            'READY_TO_PICKUP',
            'DELIVERY_DROP_CODE_REQUESTED',
            'DELIVERY_PICKUP_CODE_REQUESTED',
        ];

        // Status que permitem marcar como pronto (takeout)
        $canReadyStatuses = [
            'CONFIRMED',
            'SEPARATION_STARTED',
            'SEPARATION_ENDED',
        ];

        return [
            'canConfirm' => $normalized === 'PLACED',
            'canDispatch' => in_array($normalized, $canDispatchStatuses),
            'canReady' => in_array($normalized, $canReadyStatuses),
            'canCancel' => in_array($normalized, ['PLACED', 'CONFIRMED']),
        ];
    }
}
