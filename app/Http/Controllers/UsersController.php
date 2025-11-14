<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Spatie\Permission\Models\Role;

class UsersController extends Controller
{
    public function index(Request $request)
    {
        $query = User::with('roles')
            ->where('tenant_id', $request->user()->tenant_id);

        // Incluir usuários deletados se solicitado
        if ($request->filled('show_deleted') && $request->get('show_deleted') === '1') {
            $query->withTrashed();
        }

        // Filtro de busca
        if ($request->filled('search')) {
            $search = $request->get('search');
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            });
        }

        // Filtro de role
        if ($request->filled('role')) {
            $query->whereHas('roles', function ($q) use ($request) {
                $q->where('name', $request->get('role'));
            });
        }

        // Filtro de status (ativo/inativo)
        if ($request->filled('status')) {
            if ($request->get('status') === 'deleted') {
                $query->onlyTrashed();
            } elseif ($request->get('status') === 'active') {
                $query->whereNull('deleted_at');
            }
        }

        $users = $query->paginate(15)->through(function ($user) {
            return [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'created_at' => $user->created_at->format('d/m/Y'),
                'created_at_human' => $user->created_at->diffForHumans(),
                'deleted_at' => $user->deleted_at?->format('d/m/Y'),
                'deleted_at_human' => $user->deleted_at?->diffForHumans(),
                'is_deleted' => $user->trashed(),
                'roles' => $user->roles->pluck('name'),
                'primary_role' => $user->roles->first()?->name ?? 'Sem função',
            ];
        });

        // Buscar roles disponíveis (apenas do tenant)
        $roles = Role::whereIn('name', ['gerente', 'vendedor', 'cozinha'])
            ->select('id', 'name')
            ->get();

        return Inertia::render('users', [
            'users' => $users,
            'filters' => [
                'search' => $request->get('search', ''),
                'role' => $request->get('role', ''),
                'status' => $request->get('status', ''),
                'show_deleted' => $request->get('show_deleted', ''),
            ],
            'roles' => $roles,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => ['required', 'confirmed', Password::defaults()],
            'role' => 'required|string|exists:roles,name',
        ]);

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'tenant_id' => $request->user()->tenant_id,
        ]);

        // Atribuir role
        $user->assignRole($validated['role']);

        return redirect()->route('users.index')->with('success', 'Usuário criado com sucesso!');
    }

    public function update(Request $request, User $user)
    {
        // Verificar se o usuário pertence ao mesmo tenant
        if ($user->tenant_id !== $request->user()->tenant_id) {
            abort(403, 'Acesso negado.');
        }

        // Debug: verificar se o user está sendo injetado corretamente
        \Log::info('Update User', [
            'user_id' => $user->id,
            'user_email' => $user->email,
            'request_email' => $request->input('email'),
        ]);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email,'.$user->id,
            'password' => ['nullable', 'confirmed', Password::defaults()],
            'role' => 'required|string|exists:roles,name',
        ]);

        $user->update([
            'name' => $validated['name'],
            'email' => $validated['email'],
        ]);

        // Atualizar senha se fornecida
        if (! empty($validated['password'])) {
            $user->update([
                'password' => Hash::make($validated['password']),
            ]);
        }

        // Atualizar role
        $user->syncRoles([$validated['role']]);

        return redirect()->route('users.index')->with('success', 'Usuário atualizado com sucesso!');
    }

    public function destroy(Request $request, User $user)
    {
        // Verificar se o usuário pertence ao mesmo tenant
        if ($user->tenant_id !== $request->user()->tenant_id) {
            abort(403, 'Acesso negado.');
        }

        // Impedir que o usuário delete a si mesmo
        if ($user->id === $request->user()->id) {
            return redirect()->route('users.index')
                ->with('error', 'Você não pode excluir sua própria conta.');
        }

        // Soft delete
        $user->delete();

        return redirect()->route('users.index')->with('success', 'Usuário excluído com sucesso!');
    }

    public function restore(Request $request, $id)
    {
        $user = User::withTrashed()
            ->where('id', $id)
            ->where('tenant_id', $request->user()->tenant_id)
            ->firstOrFail();

        $user->restore();

        return redirect()->route('users.index')->with('success', 'Usuário restaurado com sucesso!');
    }
}
