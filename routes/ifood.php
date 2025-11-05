<?php

use App\Http\Controllers\IfoodIntegrationController;
use App\Http\Controllers\MerchantController;

use Illuminate\Support\Facades\Route;

Route::prefix('api/ifood')->middleware('auth')->group(function () {
    /**
     * Authentication
     */
    Route::prefix('authentication/v1.0')->group(function() {
        Route::prefix('oauth')->group(function() {
            Route::post('userCode', [IfoodIntegrationController::class, 'userCode']);
            Route::post('token', [IfoodIntegrationController::class, 'token']);
        });
    });

    Route::get('stores', [IfoodIntegrationController::class, 'stores']);
    Route::delete('stores/{id}', [IfoodIntegrationController::class, 'destroy'])->name('ifood.stores.destroy');

    Route::prefix('merchant')->group(function () {
        // Consulta status/atualização local
        Route::get('{store}', [MerchantController::class, 'show']);

        // Atualiza status da loja (abrir/fechar)
        Route::patch('{store}/status', [MerchantController::class, 'updateStatus']);
    });

    Route::prefix('sales')->group(function () {
        // Lista com filtros e paginação
        Route::get('/', [SalesController::class, 'index'])->name('ifood.sales.index');

        // Detalhe (inclui raw por padrão)
        Route::get('{sale}', [SalesController::class, 'show'])
            ->whereUuid('sale')
            ->name('ifood.sales.show');

        // Opcional: aciona uma sincronização assíncrona
        Route::post('sync', [SalesController::class, 'sync'])->name('ifood.sales.sync');
    });


    /**
     * Merchant
     */
    Route::prefix('merchant/v1.0')->group(function() {
        //
    });

    /**
     * Events
     */
    Route::prefix('events/v1.0')->group(function() {
        //
    });

    /**
     * Order
     */
    Route::prefix('order/v1.0')->group(function() {
        //
    });

    /**
     * Logistics
     */
    Route::prefix('logistics/v1.0')->group(function() {
        //
    });

    /**
     * Shipping
     */
    Route::prefix('shipping/v1.0')->group(function() {
        //
    });

    /**
     * Catalog
     */
    Route::prefix('catalog/v2.0')->group(function() {
        //
    });

    /**
     * Financial
     */
    Route::prefix('financial/v3.0')->group(function() {
        //
    });

    /**
     * Review
     */
    Route::prefix('review/v2.0')->group(function() {
        //
    });

    /**
     * Picking
     */
    Route::prefix('picking/v1.0')->group(function() {
        //
    });

    /**
     * Promotion
     */
    Route::prefix('promotion/v1.0')->group(function() {
        //
    });

    /**
     * Item
     */
    Route::prefix('item/v1.0')->group(function() {
        //
    });
});

