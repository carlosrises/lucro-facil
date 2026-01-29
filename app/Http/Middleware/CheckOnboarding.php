<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class CheckOnboarding
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next)
    {
        $user = Auth::user();

        // Se não está autenticado ou não tem tenant, prosseguir
        if (!$user || !$user->tenant) {
            return $next($request);
        }

        $tenant = $user->tenant;

        // Se não completou/pulou onboarding e não está na rota de onboarding
        if (!$tenant->onboarding_completed_at && !$tenant->onboarding_skipped) {
            if (!$request->routeIs('onboarding*')) {
                return redirect()->route('onboarding');
            }
        }

        return $next($request);
    }
}
