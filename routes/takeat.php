<?php

use App\Http\Controllers\TakeatIntegrationController;
use Illuminate\Support\Facades\Route;

Route::prefix('api/takeat')->middleware('auth')->group(function () {
    /**
     * Authentication
     */
    Route::post('login', [TakeatIntegrationController::class, 'login']);

    /**
     * Stores Management
     */
    Route::get('stores', [TakeatIntegrationController::class, 'stores']);
    Route::patch('stores/{id}/excluded-channels', [TakeatIntegrationController::class, 'updateExcludedChannels']);
    Route::delete('stores/{id}', [TakeatIntegrationController::class, 'destroy'])->name('takeat.stores.destroy');
});
