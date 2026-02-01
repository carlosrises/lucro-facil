<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\Plan;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules;
use Inertia\Inertia;
use Inertia\Response;

class RegisteredUserController extends Controller
{
    /**
     * Show the registration page.
     */
    public function create(Request $request): Response
    {
        return Inertia::render('auth/register');
    }

    /**
     * Handle an incoming registration request.
     *
     * @throws \Illuminate\Validation\ValidationException
     */
    public function store(Request $request): RedirectResponse
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|lowercase|email|max:255|unique:'.User::class,
            'phone' => [
                'nullable',
                'string',
                'max:20',
                'regex:/^\(?\d{2}\)?[\s-]?\d{4,5}-?\d{4}$/',
            ],
            'password' => ['required', 'confirmed', Rules\Password::defaults()],
        ]);

        // 1. Cria o Tenant SEM PLANO (plan_id = null)
        // O plano só será aplicado após confirmação de pagamento via webhook do Stripe
        $tenant = Tenant::create([
            'uuid' => Str::uuid(),
            'name' => $request->name."'s Workspace",
            'email' => $request->email,
            'phone' => $request->phone,
            'plan_id' => null,
        ]);

        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'tenant_id' => $tenant->id,
        ]);

        event(new Registered($user));

        Auth::login($user);

        return redirect()->intended(route('dashboard', absolute: false));
    }
}
