<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Services\IfoodClient;
use Illuminate\Http\Request;

class OrderActionController extends Controller
{
    public function handleAction(Request $request, $orderId)
    {
        $request->validate([
            'action' => 'required|string|in:accept,confirm,deny,cancel,readyToPickup,dispatch',
        ]);

        $order = Order::where('tenant_id', auth()->user()->tenant_id)
            ->where('order_uuid', $orderId)
            ->firstOrFail();

        $client = new IfoodClient($order->tenant_id, $order->store_id);

        $endpoint = "order/v1.0/orders/{$orderId}/{$request->action}";

        $client->post($endpoint);

        $order->update(['status' => strtoupper($request->action)]);

        return response()->json([
            'success' => true,
            'message' => "Ação {$request->action} executada com sucesso para pedido {$orderId}",
        ]);
    }
}
