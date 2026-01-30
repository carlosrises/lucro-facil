<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Log;

class TakeatSyncController extends Controller
{
    /**
     * Sincronizar pedidos do dia atual
     */
    public function syncToday(Request $request)
    {
        try {
            $tenantId = $request->user()->tenant_id;

            // Log::info("Sincronização rápida Takeat iniciada (em background)", [
            //     'tenant_id' => $tenantId,
            //     'user_id' => $request->user()->id,
            // ]);

            // Usar timezone BRT explicitamente
            $todayBRT = now('America/Sao_Paulo')->format('Y-m-d');

            // Despachar job em background para não bloquear a requisição HTTP
            Artisan::queue('takeat:sync-orders', [
                '--tenant-id' => $tenantId,
                '--date' => $todayBRT,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Sincronização iniciada! Os pedidos serão processados em segundo plano.',
            ]);
        } catch (\Exception $e) {
            Log::error('Erro na sincronização rápida Takeat', [
                'tenant_id' => $request->user()->tenant_id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Erro ao iniciar sincronização: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * Sincronizar pedidos de uma data específica ou período
     */
    public function syncDate(Request $request)
    {
        $request->validate([
            'date' => 'required|date|date_format:Y-m-d',
        ]);

        try {
            $tenantId = $request->user()->tenant_id;
            $date = $request->input('date');

            // Log::info('Sincronização Takeat por data iniciada (em background)', [
            //     'tenant_id' => $tenantId,
            //     'user_id' => $request->user()->id,
            //     'date' => $date,
            // ]);

            // Despachar job em background para não bloquear a requisição HTTP
            \Artisan::queue('takeat:sync-orders', [
                '--tenant-id' => $tenantId,
                '--date' => $date,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Sincronização iniciada! Os pedidos serão processados em segundo plano.',
            ]);
        } catch (\Exception $e) {
            Log::error('Erro na sincronização Takeat por data', [
                'tenant_id' => $request->user()->tenant_id,
                'date' => $request->input('date'),
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Erro ao iniciar sincronização: '.$e->getMessage(),
            ], 500);
        }
    }
}
