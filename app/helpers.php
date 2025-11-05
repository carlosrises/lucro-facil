<?php

use Illuminate\Support\Facades\Auth;

if (!function_exists('tenant_id')) {
    /**
     * Retorna o tenant_id atual.
     */
    function tenant_id(): ?int
    {
        return Auth::user()?->tenant_id;
    }
}
