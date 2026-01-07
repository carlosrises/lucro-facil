<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Plan;
use App\Models\Store;
use App\Models\Subscription;
use App\Models\Tenant;
use App\Models\Ticket;
use Inertia\Inertia;

class AdminDashboardController extends Controller
{
    public function index()
    {
        // Verificar se o usuário é admin
        if (! auth()->user()->hasRole('admin')) {
            abort(403, 'Acesso negado.');
        }

        $stats = [
            'total_clients' => Tenant::count(),
            'active_subscriptions' => Subscription::where('status', 'active')->count(),
            'monthly_revenue' => Subscription::where('status', 'active')
                ->join('plans', 'subscriptions.plan_id', '=', 'plans.id')
                ->sum('plans.price_month'),
            'open_tickets' => Ticket::where('status', 'open')->count(),
            'total_stores' => Store::count(),
            'new_clients_this_month' => Tenant::whereMonth('created_at', now()->month)->count(),
        ];

        // Atividade recente (últimos 10 itens)
        $recent_activity = collect([
            // Novos clientes
            ...Tenant::latest()->take(3)->get()->map(fn ($tenant) => [
                'type' => 'new_client',
                'message' => "Novo cliente cadastrado: {$tenant->name}",
                'time' => $tenant->created_at->diffForHumans(),
                'color' => 'blue',
            ]),

            // Novos tickets
            ...Ticket::latest()->take(3)->get()->map(fn ($ticket) => [
                'type' => 'new_ticket',
                'message' => "Chamado criado: #{$ticket->id} - {$ticket->subject}",
                'time' => $ticket->created_at->diffForHumans(),
                'color' => 'yellow',
            ]),
        ])->sortByDesc('time')->take(10)->values();

        // Distribuição por planos
        $plan_distribution = Plan::withCount(['subscriptions' => function ($query) {
            $query->where('status', 'active');
        }])->get()->map(fn ($plan) => [
            'name' => $plan->name,
            'count' => $plan->subscriptions_count,
        ]);

        return Inertia::render('admin/dashboard', [
            'stats' => $stats,
            'recent_activity' => $recent_activity,
            'plan_distribution' => $plan_distribution,
        ]);
    }
}
