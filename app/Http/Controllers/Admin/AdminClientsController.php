<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Spatie\Permission\Models\Role;

class AdminClientsController extends Controller
{
    public function index(Request $request)
    {
        // Verificar se o usuário é admin
        if (! auth()->user()->hasRole('admin')) {
            abort(403, 'Acesso negado.');
        }

        $query = Tenant::with(['subscriptions.plan', 'users'])
            ->withCount(['stores']);

        // Filtros
        if ($request->filled('search')) {
            $search = $request->get('search');
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhereHas('users', function ($userQuery) use ($search) {
                        $userQuery->where('name', 'like', "%{$search}%")
                            ->orWhere('email', 'like', "%{$search}%");
                    });
            });
        }

        if ($request->filled('status')) {
            $status = $request->get('status');
            if ($status === 'active') {
                $query->whereHas('subscriptions', function ($q) {
                    $q->where('status', 'active');
                });
            } elseif ($status === 'inactive') {
                $query->whereDoesntHave('subscriptions', function ($q) {
                    $q->where('status', 'active');
                });
            }
        }

        if ($request->filled('plan_id')) {
            $query->whereHas('subscriptions', function ($q) use ($request) {
                $q->where('plan_id', $request->get('plan_id'))
                    ->where('status', 'active');
            });
        }

        // Ordenação
        $sortBy = $request->get('sort_by', 'created_at');
        $sortDirection = $request->get('sort_direction', 'desc');

        $allowedSorts = ['name', 'email', 'created_at', 'stores_count'];
        if (in_array($sortBy, $allowedSorts)) {
            $query->orderBy($sortBy, $sortDirection);
        }

        $clients = $query->paginate(15)->through(function ($tenant) {
            $activeSubscription = $tenant->subscriptions->where('status', 'active')->first();
            $primaryUser = $tenant->users->first();

            return [
                'id' => $tenant->id,
                'name' => $tenant->name,
                'email' => $tenant->email,
                'created_at' => $tenant->created_at->format('d/m/Y'),
                'created_at_human' => $tenant->created_at->diffForHumans(),
                'stores_count' => $tenant->stores_count,
                'subscription' => $activeSubscription ? [
                    'id' => $activeSubscription->id,
                    'plan_id' => $activeSubscription->plan_id,
                    'plan_name' => $activeSubscription->plan->name,
                    'status' => $activeSubscription->status,
                    'started_on' => $activeSubscription->started_on?->format('d/m/Y'),
                    'ends_on' => $activeSubscription->ends_on?->format('d/m/Y'),
                    'price' => $activeSubscription->plan->price_month,
                ] : null,
                'primary_user' => $primaryUser ? [
                    'id' => $primaryUser->id,
                    'name' => $primaryUser->name,
                    'email' => $primaryUser->email,
                ] : null,
                'status' => $activeSubscription ? 'active' : 'inactive',
            ];
        });

        // Filtros para o frontend
        $plans = Plan::select('id', 'name')->get();

        return Inertia::render('admin/clients', [
            'clients' => $clients,
            'filters' => [
                'search' => $request->get('search', ''),
                'status' => $request->get('status', ''),
                'plan_id' => $request->get('plan_id', ''),
                'sort_by' => $sortBy,
                'sort_direction' => $sortDirection,
            ],
            'plans' => $plans,
        ]);
    }

    public function store(Request $request)
    {
        // Verificar se o usuário é admin
        if (! auth()->user()->hasRole('admin')) {
            abort(403, 'Acesso negado.');
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:tenants,email',
            'plan_id' => 'nullable|exists:plans,id',
        ]);

        // Gerar UUID para o tenant
        $tenant = Tenant::create([
            'uuid' => Str::uuid()->toString(),
            'name' => $validated['name'],
            'email' => $validated['email'],
        ]);

        // Gerar senha aleatória para o usuário
        $randomPassword = Str::random(12);

        // Criar usuário principal para o tenant
        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($randomPassword),
            'tenant_id' => $tenant->id,
        ]);

        // Garantir que a role 'gerente' existe
        $gerenteRole = Role::firstOrCreate(['name' => 'gerente']);

        // Atribuir role de gerente ao usuário principal
        $user->assignRole($gerenteRole);

        // Criar assinatura se foi especificado um plano
        if (! empty($validated['plan_id'])) {
            Subscription::create([
                'tenant_id' => $tenant->id,
                'plan_id' => $validated['plan_id'],
                'status' => 'active',
                'started_on' => now(),
                'ends_on' => now()->addMonth(),
            ]);
        }

        // TODO: Enviar email com a senha para o usuário
        // Mail::to($user->email)->send(new WelcomeClientMail($user, $randomPassword));

        return redirect()->route('admin.clients.index')
            ->with('success', 'Cliente criado com sucesso!')
            ->with('generated_password', $randomPassword)
            ->with('client_email', $validated['email']);
    }

    public function update(Request $request, Tenant $tenant)
    {
        // Verificar se o usuário é admin
        if (! auth()->user()->hasRole('admin')) {
            abort(403, 'Acesso negado.');
        }

        // Buscar user_id para validação de email
        $userId = $request->input('user_id');

        // Construir regras de validação de email
        $emailRules = [
            'required',
            'email',
            Rule::unique('tenants', 'email')->ignore($tenant->id),
        ];

        // Adicionar validação de email único em users se user_id foi fornecido
        if ($userId) {
            $emailRules[] = Rule::unique('users', 'email')->ignore($userId);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => $emailRules,
            'plan_id' => 'nullable|exists:plans,id',
            'user_id' => 'nullable|exists:users,id',
        ]);

        // Atualizar tenant
        $tenant->update([
            'name' => $validated['name'],
            'email' => $validated['email'],
        ]);

        // Atualizar usuário principal se user_id foi fornecido
        if (! empty($validated['user_id'])) {
            $user = User::find($validated['user_id']);

            if ($user && $user->tenant_id === $tenant->id) {
                $user->update([
                    'name' => $validated['name'],
                    'email' => $validated['email'],
                ]);
            }
        }

        // Atualizar assinatura se plan_id foi fornecido
        if (isset($validated['plan_id']) && ! empty($validated['plan_id'])) {
            $activeSubscription = $tenant->subscriptions()->where('status', 'active')->first();

            if ($activeSubscription) {
                // Atualizar assinatura existente
                $activeSubscription->update([
                    'plan_id' => $validated['plan_id'],
                ]);
            } else {
                // Criar nova assinatura
                Subscription::create([
                    'tenant_id' => $tenant->id,
                    'plan_id' => $validated['plan_id'],
                    'status' => 'active',
                    'started_on' => now(),
                    'ends_on' => now()->addMonth(),
                ]);
            }
        }

        return redirect()->route('admin.clients.index')->with('success', 'Cliente atualizado com sucesso!');
    }

    public function destroy(Tenant $tenant)
    {
        // Verificar se o usuário é admin
        if (! auth()->user()->hasRole('admin')) {
            abort(403, 'Acesso negado.');
        }

        // Verificar se não há dados importantes vinculados
        if ($tenant->stores()->count() > 0) {
            return redirect()->route('admin.clients.index')
                ->with('error', 'Não é possível excluir cliente com lojas vinculadas.');
        }

        $tenant->delete();

        return redirect()->route('admin.clients.index')->with('success', 'Cliente excluído com sucesso!');
    }
}
