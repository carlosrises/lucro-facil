<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\Store;
use Illuminate\Http\Request;
use Inertia\Inertia;

class IntegrationsController extends Controller
{
    public function index(Request $request)
    {
        $storesWithError = Store::where('provider', 'ifood')
            ->where('active', false)
            ->get();

        // Buscar lojas com tokens expirados ou próximos de expirar
        $allStores = Store::where('tenant_id', $request->user()->tenant_id)
            ->with('oauthToken')
            ->get();

        $storesWithExpiredToken = $allStores->filter(function ($store) {
            return $store->hasExpiredToken();
        })->map(function ($store) {
            return [
                'id' => $store->id,
                'display_name' => $store->display_name,
                'provider' => $store->provider,
            ];
        })->values();

        $storesWithTokenExpiringSoon = $allStores->filter(function ($store) {
            return $store->hasTokenExpiringSoon() && ! $store->hasExpiredToken();
        })->map(function ($store) {
            return [
                'id' => $store->id,
                'display_name' => $store->display_name,
                'provider' => $store->provider,
                'expires_at' => $store->oauthToken?->expires_at,
            ];
        })->values();

        return Inertia::render('settings/integrations', [
            'storesWithError' => $storesWithError,
            'storesWithExpiredToken' => $storesWithExpiredToken,
            'storesWithTokenExpiringSoon' => $storesWithTokenExpiringSoon,
        ]);
    }
}
