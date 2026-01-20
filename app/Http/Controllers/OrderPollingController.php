<?php

namespace App\Http\Controllers;

use App\Models\Order;
use Illuminate\Http\Request;

class OrderPollingController extends Controller
{
    /**
     * Verificar se há novos pedidos desde um timestamp
     */
    public function checkNewOrders(Request $request)
    {
        $lastCheck = $request->input('last_check'); // timestamp ISO8601
        $tenantId = $request->user()->tenant_id;

        if (!$lastCheck) {
            return response()->json(['has_new' => false, 'count' => 0]);
        }

        $newOrdersCount = Order::where('tenant_id', $tenantId)
            ->where('created_at', '>', $lastCheck)
            ->count();

        return response()->json([
            'has_new' => $newOrdersCount > 0,
            'count' => $newOrdersCount,
            'timestamp' => now()->toIso8601String(),
        ]);
    }
}
