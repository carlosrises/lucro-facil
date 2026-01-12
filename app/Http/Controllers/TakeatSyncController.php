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

            Log::info("Sincronização rápida Takeat iniciada", [
                'tenant_id' => $tenantId,
                'user_id' => $request->user()->id,
            ]);

            // Executar comando de sincronização para o dia atual
            Artisan::call('takeat:sync-orders', [
                '--tenant-id' => $tenantId,
                '--date' => now()->format('Y-m-d'),
            ]);

            $output = Artisan::output();

            Log::info("Sincronização rápida Takeat concluída", [
                'tenant_id' => $tenantId,
                'output' => $output,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Pedidos sincronizados com sucesso!',
                'output' => $output,
            ]);
        } catch (\Exception $e) {
            Log::error("Erro na sincronização rápida Takeat", [
                'tenant_id' => $request->user()->tenant_id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Erro ao sincronizar pedidos: '.$e->getMessage(),
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

            Log::info("Sincronização Takeat por data iniciada", [
                'tenant_id' => $tenantId,
                'user_id' => $request->user()->id,
                'date' => $date,
            ]);

            // Executar comando de sincronização para a data específica
            Artisan::call('takeat:sync-orders', [
                '--tenant-id' => $tenantId,
                '--date' => $date,
            ]);

            $output = Artisan::output();

            Log::info("Sincronização Takeat por data concluída", [
                'tenant_id' => $tenantId,
                'date' => $date,
                'output' => $output,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Pedidos sincronizados com sucesso!',
                'output' => $output,
            ]);
        } catch (\Exception $e) {
            Log::error("Erro na sincronização Takeat por data", [
                'tenant_id' => $request->user()->tenant_id,
                'date' => $request->input('date'),
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Erro ao sincronizar pedidos: '.$e->getMessage(),
            ], 500);
        }
    }
}
