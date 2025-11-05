<?php

use App\Http\Controllers\Admin\AdminDashboardController;
use App\Http\Controllers\Admin\AdminClientsController;
use Illuminate\Support\Facades\Route;

Route::prefix('admin')->middleware(['auth', 'role:admin'])->name('admin.')->group(function () {
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
