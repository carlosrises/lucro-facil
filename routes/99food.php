<?php

use App\Http\Controllers\NineNineFoodIntegrationController;
use Illuminate\Support\Facades\Route;

Route::prefix('api/99food')->middleware('auth')->group(function () {
    /**
     * Authentication
     */
    Route::prefix('oauth')->group(function () {
        Route::post('userCode', [NineNineFoodIntegrationController::class, 'userCode']);
        Route::post('token', [NineNineFoodIntegrationController::class, 'token']);
    });

    /**
     * Stores Management
     */
    Route::get('stores', [NineNineFoodIntegrationController::class, 'stores']);
    Route::delete('stores/{id}', [NineNineFoodIntegrationController::class, 'destroy'])->name('99food.stores.destroy');

    /**
     * TODO: Implementar rotas adicionais conforme API do 99Food
     * Exemplos:
     * - Orders (listar, confirmar, cancelar)
     * - Store status
     * - Menu/Catalog
     * - Webhooks
     */
});
