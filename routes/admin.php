<?php

use App\Http\Controllers\Admin\AdminClientsController;
use App\Http\Controllers\Admin\AdminDashboardController;
use Illuminate\Support\Facades\Route;

// Aceita usuários com role 'admin' ou qualquer role que comece com 'admin:' (ex: 'admin:system')
Route::prefix('admin')->middleware(['auth', 'role:admin|admin:system'])->name('admin.')->group(function () {
    Route::get('/', [AdminDashboardController::class, 'index'])->name('dashboard');

    Route::resource('clients', AdminClientsController::class)->except(['show', 'create', 'edit']);

    Route::get('/plans', function () {
        return inertia('admin/plans');
    })->name('plans');

    Route::get('/payments', function () {
        return inertia('admin/payments');
    })->name('payments');

    Route::get('/tickets', function () {
        return inertia('admin/tickets');
    })->name('tickets');
});
