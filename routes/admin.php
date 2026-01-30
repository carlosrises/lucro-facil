<?php

use App\Http\Controllers\Admin\AdminClientsController;
use App\Http\Controllers\Admin\AdminDashboardController;
use App\Http\Controllers\Admin\PlansController;
use App\Http\Controllers\Admin\SubscriptionsController;
use Illuminate\Support\Facades\Route;

// Aceita usuários com role 'admin' ou qualquer role que comece com 'admin:' (ex: 'admin:system')
Route::prefix('admin')->middleware(['auth', 'role:admin|admin:system'])->name('admin.')->group(function () {
    Route::get('/', [AdminDashboardController::class, 'index'])->name('dashboard');

    // Binding explícito para clients -> Tenant model
    Route::resource('clients', AdminClientsController::class)
        ->except(['show', 'create', 'edit'])
        ->parameters(['clients' => 'tenant']);

    Route::resource('plans', PlansController::class)->except(['show', 'create', 'edit']);
    Route::post('plans/sync-from-stripe', [PlansController::class, 'syncFromStripe'])->name('plans.syncFromStripe');
    Route::post('plans/sync-to-stripe', [PlansController::class, 'syncToStripe'])->name('plans.syncToStripe');
    Route::post('plans/update-order', [PlansController::class, 'updateOrder'])->name('plans.updateOrder');
    Route::post('plans/{plan}/toggle-featured', [PlansController::class, 'toggleFeatured'])->name('plans.toggleFeatured');
    Route::post('plans/{plan}/toggle-active', [PlansController::class, 'toggleActive'])->name('plans.toggleActive');

    Route::get('/subscriptions', [SubscriptionsController::class, 'index'])->name('subscriptions.index');

    Route::get('/payments', function () {
        return inertia('admin/payments');
    })->name('payments');

    Route::get('/tickets', function () {
        return inertia('admin/tickets');
    })->name('tickets');
});
