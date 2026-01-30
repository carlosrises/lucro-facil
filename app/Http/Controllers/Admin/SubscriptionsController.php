<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Subscription;
use Illuminate\Http\Request;
use Inertia\Inertia;

class SubscriptionsController extends Controller
{
    public function index(Request $request)
    {
        $query = Subscription::with(['plan', 'tenant.users']);

        // Filtro por status
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        // Filtro por plano
        if ($request->filled('plan_id')) {
            $query->where('plan_id', $request->plan_id);
        }

        // Filtro por intervalo (mensal/anual)
        if ($request->filled('price_interval')) {
            $query->where('price_interval', $request->price_interval);
        }

        // Busca por nome do tenant/usuário
        if ($request->filled('search')) {
            $search = $request->search;
            $query->whereHas('tenant', function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhereHas('users', function ($q2) use ($search) {
                        $q2->where('name', 'like', "%{$search}%")
                            ->orWhere('email', 'like', "%{$search}%");
                    });
            });
        }

        $subscriptions = $query->orderBy('created_at', 'desc')
            ->paginate(15)
            ->withQueryString();

        // Obter lista de planos para filtros
        $plans = \App\Models\Plan::select('id', 'name')
            ->where('active', true)
            ->orderBy('name')
            ->get();

        return Inertia::render('admin/subscriptions', [
            'subscriptions' => $subscriptions,
            'plans' => $plans,
            'filters' => [
                'search' => $request->search,
                'status' => $request->status,
                'plan_id' => $request->plan_id,
                'price_interval' => $request->price_interval,
            ],
        ]);
    }
}
