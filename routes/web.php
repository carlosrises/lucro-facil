<?php

use App\Http\Controllers\OrdersController;
use App\Http\Controllers\SalesController;
use App\Http\Controllers\StoresController;
use App\Http\Controllers\CostCommissionsController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    return Inertia::render('welcome');
})->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', function () {
        return Inertia::render('dashboard');
    })->name('dashboard');

    Route::get('orders', [OrdersController::class, 'index'])->name('orders.index');

    // Order actions
    Route::post('orders/{id}/confirm', [OrdersController::class, 'confirm'])->name('orders.confirm');
    Route::post('orders/{id}/dispatch', [OrdersController::class, 'dispatch'])->name('orders.dispatch');
    Route::post('orders/{id}/ready', [OrdersController::class, 'ready'])->name('orders.ready');
    Route::post('orders/{id}/cancel', [OrdersController::class, 'cancel'])->name('orders.cancel');
    Route::get('orders/{id}/cancellation-reasons', [OrdersController::class, 'cancellationReasons'])->name('orders.cancellationReasons');

    Route::get('sales', [SalesController::class, 'index'])->name('sales.index');

    // Stores routes
    Route::get('stores', [StoresController::class, 'index'])->name('stores.index');
    Route::get('stores/{id}', [StoresController::class, 'show'])->name('stores.show');
    Route::get('stores/{id}/status', [StoresController::class, 'status'])->name('stores.status');
    Route::post('stores/{id}/status', [StoresController::class, 'updateStatus'])->name('stores.updateStatus');

    // Interruptions
    Route::get('stores/{id}/interruptions', [StoresController::class, 'interruptions'])->name('stores.interruptions');
    Route::post('stores/{id}/interruptions', [StoresController::class, 'storeInterruption'])->name('stores.storeInterruption');
    Route::delete('stores/{id}/interruptions/{interruptionId}', [StoresController::class, 'destroyInterruption'])->name('stores.destroyInterruption');

    // Opening hours
    Route::get('stores/{id}/opening-hours', [StoresController::class, 'openingHours'])->name('stores.openingHours');
    Route::put('stores/{id}/opening-hours', [StoresController::class, 'updateOpeningHours'])->name('stores.updateOpeningHours');

    // Cost & Commissions
    Route::get('cost-commissions', [CostCommissionsController::class, 'index'])->name('cost-commissions.index');
    Route::post('cost-commissions', [CostCommissionsController::class, 'store'])->name('cost-commissions.store');
    Route::put('cost-commissions/{costCommission}', [CostCommissionsController::class, 'update'])->name('cost-commissions.update');
    Route::patch('cost-commissions/{costCommission}/toggle', [CostCommissionsController::class, 'toggle'])->name('cost-commissions.toggle');
    Route::delete('cost-commissions/{costCommission}', [CostCommissionsController::class, 'destroy'])->name('cost-commissions.destroy');
});

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
require __DIR__.'/ifood.php';
require __DIR__.'/admin.php';
