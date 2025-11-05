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

        return Inertia::render('settings/integrations', [
            'storesWithError' => $storesWithError,
        ]);
    }
}
