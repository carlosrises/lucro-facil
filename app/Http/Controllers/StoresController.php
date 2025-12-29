<?php

namespace App\Http\Controllers;

use App\Models\Store;
use App\Services\IfoodClient;
use Illuminate\Http\Request;
use Inertia\Inertia;

class StoresController extends Controller
{
    public function index(Request $request)
    {
        $query = Store::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->when($request->input('search'), fn ($q, $search) => $q->where('display_name', 'like', "%{$search}%")
            )
            ->when($request->input('status'), fn ($q, $status) => $q->where('status', $status)
            )
            ->orderBy('display_name');

        $perPage = (int) $request->input('per_page', 10);

        $stores = $query->paginate($perPage)->withQueryString();

        // Adicionar informações de token expirado
        $stores->getCollection()->transform(function ($store) {
            $store->token_expired = $store->hasExpiredToken();
            $store->token_expiring_soon = $store->hasTokenExpiringSoon();
            return $store;
        });

        $storesWithError = Store::where('tenant_id', $request->user()->tenant_id)
            ->where('provider', 'ifood')
            ->where('active', false)
            ->get();

        return Inertia::render('stores', [
            'stores' => $stores,
            'filters' => [
                'search' => $request->input('search'),
                'status' => $request->input('status'),
                'per_page' => $perPage,
            ],
            'storesWithError' => $storesWithError,
        ]);
    }

    public function updateStatus(Request $request, $storeId)
    {
        $request->validate([
            'status' => 'required|in:AVAILABLE,UNAVAILABLE',
        ]);

        try {
            $store = Store::where('id', $storeId)
                ->where('tenant_id', $request->user()->tenant_id)
                ->firstOrFail();

            if ($store->provider !== 'ifood') {
                return response()->json([
                    'success' => false,
                    'message' => 'Esta ação está disponível apenas para lojas iFood',
                ], 400);
            }

            $client = new IfoodClient($store->tenant_id, $store->id);
            $payload = ['status' => $request->status];

            // Usa POST ao invés de PATCH (que não existe no IfoodClient)
            $response = $client->post("merchant/v1.0/merchants/{$store->external_store_id}/status", $payload);

            if (! $response || isset($response['error'])) {
                return response()->json([
                    'success' => false,
                    'message' => 'Falha ao atualizar status no iFood',
                    'response' => $response,
                ], 400);
            }

            // Atualiza localmente também
            $store->update(['status' => $request->status]);

            return response()->json([
                'success' => true,
                'message' => "Status atualizado para {$request->status}",
                'store' => $store,
            ]);
        } catch (\Throwable $e) {
            logger()->error('Erro ao atualizar status da loja', [
                'store_id' => $storeId,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Erro ao atualizar status: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * GET /stores/{id}
     * Retorna detalhes completos da loja do iFood
     */
    public function show($id)
    {
        try {
            $store = Store::where('id', $id)
                ->where('tenant_id', auth()->user()->tenant_id)
                ->firstOrFail();

            // Verifica se a loja é do iFood
            if ($store->provider !== 'ifood') {
                return response()->json([
                    'success' => false,
                    'message' => 'Esta ação está disponível apenas para lojas iFood',
                ], 400);
            }

            $client = new IfoodClient($store->tenant_id, $store->id);
            $details = $client->getMerchantDetails($store->external_store_id);

            return response()->json([
                'success' => true,
                'data' => $details,
            ]);
        } catch (\Throwable $e) {
            logger()->error('Erro ao buscar detalhes da loja', [
                'store_id' => $id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Erro ao buscar detalhes da loja: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * GET /stores/{id}/status
     * Retorna status da loja do iFood
     */
    public function status($id)
    {
        try {
            $store = Store::where('id', $id)
                ->where('tenant_id', auth()->user()->tenant_id)
                ->firstOrFail();

            if ($store->provider !== 'ifood') {
                return response()->json([
                    'success' => false,
                    'message' => 'Esta ação está disponível apenas para lojas iFood',
                ], 400);
            }

            $client = new IfoodClient($store->tenant_id, $store->id);
            $status = $client->getMerchantStatus($store->external_store_id);

            return response()->json([
                'success' => true,
                'data' => $status,
            ]);
        } catch (\Throwable $e) {
            logger()->error('Erro ao buscar status da loja', [
                'store_id' => $id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Erro ao buscar status da loja: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * GET /stores/{id}/interruptions
     * Lista interrupções da loja
     */
    public function interruptions($id)
    {
        try {
            $store = Store::where('id', $id)
                ->where('tenant_id', auth()->user()->tenant_id)
                ->firstOrFail();

            if ($store->provider !== 'ifood') {
                return response()->json([
                    'success' => false,
                    'message' => 'Esta ação está disponível apenas para lojas iFood',
                ], 400);
            }

            $client = new IfoodClient($store->tenant_id, $store->id);
            $interruptions = $client->getInterruptions($store->external_store_id);

            return response()->json([
                'success' => true,
                'data' => $interruptions,
            ]);
        } catch (\Throwable $e) {
            logger()->error('Erro ao listar interrupções', [
                'store_id' => $id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Erro ao listar interrupções: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * POST /stores/{id}/interruptions
     * Cria uma nova interrupção
     */
    public function storeInterruption(Request $request, $id)
    {
        $request->validate([
            'description' => 'required|string|max:255',
            'start' => 'required|date',
            'end' => 'required|date|after:start',
        ]);

        try {
            $store = Store::where('id', $id)
                ->where('tenant_id', auth()->user()->tenant_id)
                ->firstOrFail();

            if ($store->provider !== 'ifood') {
                return response()->json([
                    'success' => false,
                    'message' => 'Esta ação está disponível apenas para lojas iFood',
                ], 400);
            }

            $client = new IfoodClient($store->tenant_id, $store->id);

            $data = [
                'description' => $request->description,
                'start' => $request->start,
                'end' => $request->end,
            ];

            $result = $client->createInterruption($store->external_store_id, $data);

            return response()->json([
                'success' => true,
                'message' => 'Interrupção criada com sucesso',
                'data' => $result,
            ]);
        } catch (\Throwable $e) {
            logger()->error('Erro ao criar interrupção', [
                'store_id' => $id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Erro ao criar interrupção: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * DELETE /stores/{id}/interruptions/{interruptionId}
     * Remove uma interrupção
     */
    public function destroyInterruption($id, $interruptionId)
    {
        try {
            $store = Store::where('id', $id)
                ->where('tenant_id', auth()->user()->tenant_id)
                ->firstOrFail();

            if ($store->provider !== 'ifood') {
                return response()->json([
                    'success' => false,
                    'message' => 'Esta ação está disponível apenas para lojas iFood',
                ], 400);
            }

            $client = new IfoodClient($store->tenant_id, $store->id);
            $client->deleteInterruption($store->external_store_id, $interruptionId);

            return response()->json([
                'success' => true,
                'message' => 'Interrupção removida com sucesso',
            ]);
        } catch (\Throwable $e) {
            logger()->error('Erro ao remover interrupção', [
                'store_id' => $id,
                'interruption_id' => $interruptionId,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Erro ao remover interrupção: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * GET /stores/{id}/opening-hours
     * Lista horários de funcionamento
     */
    public function openingHours($id)
    {
        try {
            $store = Store::where('id', $id)
                ->where('tenant_id', auth()->user()->tenant_id)
                ->firstOrFail();

            if ($store->provider !== 'ifood') {
                return response()->json([
                    'success' => false,
                    'message' => 'Esta ação está disponível apenas para lojas iFood',
                ], 400);
            }

            $client = new IfoodClient($store->tenant_id, $store->id);
            $openingHours = $client->getOpeningHours($store->external_store_id);

            return response()->json([
                'success' => true,
                'data' => $openingHours,
            ]);
        } catch (\Throwable $e) {
            logger()->error('Erro ao buscar horários de funcionamento', [
                'store_id' => $id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Erro ao buscar horários: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * PUT /stores/{id}/opening-hours
     * Atualiza horários de funcionamento
     */
    public function updateOpeningHours(Request $request, $id)
    {
        $request->validate([
            'shifts' => 'required|array',
            'shifts.*.dayOfWeek' => 'required|string|in:MONDAY,TUESDAY,WEDNESDAY,THURSDAY,FRIDAY,SATURDAY,SUNDAY',
            'shifts.*.start' => 'required|string',
            'shifts.*.duration' => 'required|integer|min:0',
        ]);

        try {
            $store = Store::where('id', $id)
                ->where('tenant_id', auth()->user()->tenant_id)
                ->firstOrFail();

            if ($store->provider !== 'ifood') {
                return response()->json([
                    'success' => false,
                    'message' => 'Esta ação está disponível apenas para lojas iFood',
                ], 400);
            }

            $client = new IfoodClient($store->tenant_id, $store->id);
            $result = $client->updateOpeningHours($store->external_store_id, $request->all());

            return response()->json([
                'success' => true,
                'message' => 'Horários atualizados com sucesso',
                'data' => $result,
            ]);
        } catch (\Throwable $e) {
            logger()->error('Erro ao atualizar horários de funcionamento', [
                'store_id' => $id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Erro ao atualizar horários: '.$e->getMessage(),
            ], 500);
        }
    }
}
