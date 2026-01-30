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

        // Estatísticas gerais
        $totalClients = Tenant::count();
        $activeSubscriptions = Subscription::whereIn('status', ['active', 'trialing'])->count();
        $trialingSubscriptions = Subscription::where('status', 'trialing')->count();

        // Receita mensal (soma dos planos com interval 'month')
        $monthlyRevenue = Subscription::whereIn('status', ['active', 'trialing'])
            ->where('price_interval', 'month')
            ->join('plans', 'subscriptions.plan_id', '=', 'plans.id')
            ->sum('plans.price_month');

        // Receita anual convertida para mensal (soma dos planos com interval 'year' / 12)
        $annualRevenue = Subscription::whereIn('status', ['active', 'trialing'])
            ->where('price_interval', 'year')
            ->join('plan_prices', function($join) {
                $join->on('subscriptions.plan_id', '=', 'plan_prices.plan_id')
                     ->where('plan_prices.interval', '=', 'year');
            })
            ->sum('plan_prices.amount');

        $monthlyRevenueFromAnnual = $annualRevenue / 12;
        $totalMonthlyRevenue = $monthlyRevenue + $monthlyRevenueFromAnnual;

        $stats = [
            'total_clients' => $totalClients,
            'active_subscriptions' => $activeSubscriptions,
            'trialing_subscriptions' => $trialingSubscriptions,
            'monthly_revenue' => $totalMonthlyRevenue,
            'annual_revenue' => $totalMonthlyRevenue * 12,
            'open_tickets' => Ticket::where('status', 'open')->count(),
            'total_stores' => Store::count(),
            'new_clients_this_month' => Tenant::whereMonth('created_at', now()->month)->count(),

            // Mudanças do mês anterior
            'clients_change' => $this->calculatePercentageChange(
                Tenant::whereMonth('created_at', now()->month)->count(),
                Tenant::whereMonth('created_at', now()->subMonth()->month)->whereYear('created_at', now()->subMonth()->year)->count()
            ),
            'subscriptions_change' => $this->calculatePercentageChange(
                Subscription::whereIn('status', ['active', 'trialing'])->whereMonth('created_at', now()->month)->count(),
                Subscription::whereIn('status', ['active', 'trialing'])->whereMonth('created_at', now()->subMonth()->month)->whereYear('created_at', now()->subMonth()->year)->count()
            ),
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
            $query->whereIn('status', ['active', 'trialing']);
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

    private function calculatePercentageChange($current, $previous)
    {
        if ($previous == 0) {
            return $current > 0 ? 100 : 0;
        }

        return (($current - $previous) / $previous) * 100;
    }
}
