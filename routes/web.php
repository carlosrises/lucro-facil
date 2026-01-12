<?php

use App\Http\Controllers\AbcCurveController;
use App\Http\Controllers\CategoriesController;
use App\Http\Controllers\CostCommissionsController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\FinanceCategoriesController;
use App\Http\Controllers\FinanceEntriesController;
use App\Http\Controllers\FinancialSummaryController;
use App\Http\Controllers\IngredientsController;
use App\Http\Controllers\ItemTriageController;
use App\Http\Controllers\OrderItemMappingsController;
use App\Http\Controllers\OrdersController;
use App\Http\Controllers\ProductMappingController;
use App\Http\Controllers\ProductsController;
use App\Http\Controllers\RecalculationStatusController;
use App\Http\Controllers\SalesController;
use App\Http\Controllers\StoresController;
use App\Http\Controllers\TakeatSyncController;
use App\Http\Controllers\TaxCategoriesController;
use App\Http\Controllers\UsersController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    return Inertia::render('welcome');
})->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', [DashboardController::class, 'index'])->name('dashboard');

    // Verificar status de recálculos ativos
    Route::get('recalculation-status', [RecalculationStatusController::class, 'check'])->name('recalculation.status');

    Route::get('orders', [OrdersController::class, 'index'])->name('orders.index');

    Route::get('abc-curve', [AbcCurveController::class, 'index'])->name('abc-curve.index');

    // Order actions
    Route::post('orders/{id}/confirm', [OrdersController::class, 'confirm'])->name('orders.confirm');
    Route::post('orders/{id}/dispatch', [OrdersController::class, 'dispatch'])->name('orders.dispatch');
    Route::post('orders/{id}/ready', [OrdersController::class, 'ready'])->name('orders.ready');
    Route::post('orders/{id}/cancel', [OrdersController::class, 'cancel'])->name('orders.cancel');
    Route::post('orders/{id}/recalculate-costs', [OrdersController::class, 'recalculateCosts'])->name('orders.recalculateCosts');
    Route::post('orders/{id}/link-payment-fee', [OrdersController::class, 'linkPaymentFee'])->name('orders.linkPaymentFee');
    Route::get('orders/{id}/cancellation-reasons', [OrdersController::class, 'cancellationReasons'])->name('orders.cancellationReasons');
    Route::get('orders/{id}/available-payment-fees', [OrdersController::class, 'availablePaymentFees'])->name('orders.availablePaymentFees');

    // Handshake Platform - Dispute actions (customer-initiated cancellation)
    Route::post('orders/{id}/dispute/{disputeId}/accept', [OrdersController::class, 'acceptDispute'])->name('orders.acceptDispute');
    Route::post('orders/{id}/dispute/{disputeId}/reject', [OrdersController::class, 'rejectDispute'])->name('orders.rejectDispute');

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
    Route::get('cost-commissions/recalculate-progress', [CostCommissionsController::class, 'getRecalculateProgress'])->name('cost-commissions.recalculate-progress');

    // Categories Management Page
    Route::get('categories', [CategoriesController::class, 'manage'])->name('categories.manage');

    // Categories API
    Route::get('api/categories', [CategoriesController::class, 'index'])->name('categories.index');
    Route::post('api/categories', [CategoriesController::class, 'store'])->name('categories.store');
    Route::put('api/categories/{category}', [CategoriesController::class, 'update'])->name('categories.update');
    Route::delete('api/categories/{category}', [CategoriesController::class, 'destroy'])->name('categories.destroy');

    // Ingredients
    Route::get('ingredients', [IngredientsController::class, 'index'])->name('ingredients.index');
    Route::post('ingredients', [IngredientsController::class, 'store'])->name('ingredients.store');
    Route::put('ingredients/{ingredient}', [IngredientsController::class, 'update'])->name('ingredients.update');
    Route::patch('ingredients/{ingredient}/toggle', [IngredientsController::class, 'toggle'])->name('ingredients.toggle');
    Route::delete('ingredients/{ingredient}', [IngredientsController::class, 'destroy'])->name('ingredients.destroy');

    // Products
    Route::get('products', [ProductsController::class, 'index'])->name('products.index');
    Route::post('products', [ProductsController::class, 'store'])->name('products.store');
    Route::get('products/{product}/data', [ProductsController::class, 'getData'])->name('products.getData');
    Route::get('products/{product}', [ProductsController::class, 'show'])->name('products.show');
    Route::put('products/{product}', [ProductsController::class, 'update'])->name('products.update');
    Route::patch('products/{product}/toggle', [ProductsController::class, 'toggle'])->name('products.toggle');
    Route::delete('products/{product}', [ProductsController::class, 'destroy'])->name('products.destroy');

    // Product recipes (technical sheet)
    Route::post('products/{product}/ingredients', [ProductsController::class, 'addIngredient'])->name('products.addIngredient');
    Route::delete('products/{product}/ingredients/{ingredient}', [ProductsController::class, 'removeIngredient'])->name('products.removeIngredient');

    // Users Management
    Route::get('users', [UsersController::class, 'index'])->name('users.index');
    Route::post('users', [UsersController::class, 'store'])->name('users.store');
    Route::match(['put', 'patch'], 'users/{user}', [UsersController::class, 'update'])->name('users.update');
    Route::delete('users/{user}', [UsersController::class, 'destroy'])->name('users.destroy');
    Route::post('users/{id}/restore', [UsersController::class, 'restore'])->name('users.restore');

    // Product Mappings
    Route::get('product-mappings', [ProductMappingController::class, 'index'])->name('product-mappings.index');
    Route::post('product-mappings', [ProductMappingController::class, 'store'])->name('product-mappings.store');
    Route::delete('product-mappings/{productMapping}', [ProductMappingController::class, 'destroy'])->name('product-mappings.destroy');
    Route::delete('product-mappings/sku/{sku}', [ProductMappingController::class, 'destroyBySku'])->name('product-mappings.destroyBySku');

    // Item Triage (Triagem de Itens)
    Route::get('item-triage', [ItemTriageController::class, 'index'])->name('item-triage.index');
    Route::get('api/item-triage/{sku}', [ItemTriageController::class, 'getItemDetails'])->where('sku', '.*')->name('item-triage.details');
    Route::post('item-triage/classify', [ItemTriageController::class, 'classify'])->name('item-triage.classify');

    // Order Item Mappings (múltiplas associações por item)
    Route::post('order-items/{orderItem}/mappings', [OrderItemMappingsController::class, 'store'])->name('order-item-mappings.store');
    Route::delete('order-items/{orderItem}/mappings', [OrderItemMappingsController::class, 'destroy'])->name('order-item-mappings.destroy');

    // Tax Categories
    Route::get('tax-categories', [TaxCategoriesController::class, 'index'])->name('tax-categories.index');
    Route::post('tax-categories', [TaxCategoriesController::class, 'store'])->name('tax-categories.store');
    Route::put('tax-categories/{taxCategory}', [TaxCategoriesController::class, 'update'])->name('tax-categories.update');
    Route::delete('tax-categories/{taxCategory}', [TaxCategoriesController::class, 'destroy'])->name('tax-categories.destroy');

    // Financial
    Route::get('financial/summary', [FinancialSummaryController::class, 'index'])->name('financial.summary');
    Route::get('financial/categories', [FinanceCategoriesController::class, 'index'])->name('financial.categories');
    Route::post('financial/categories', [FinanceCategoriesController::class, 'store'])->name('financial.categories.store');
    Route::put('financial/categories/{category}', [FinanceCategoriesController::class, 'update'])->name('financial.categories.update');
    Route::delete('financial/categories/{category}', [FinanceCategoriesController::class, 'destroy'])->name('financial.categories.destroy');
    Route::get('financial/entries', [FinanceEntriesController::class, 'index'])->name('financial.entries');
    Route::post('financial/entries', [FinanceEntriesController::class, 'store'])->name('financial.entries.store');
    Route::put('financial/entries/{entry}', [FinanceEntriesController::class, 'update'])->name('financial.entries.update');
    Route::delete('financial/entries/{entry}', [FinanceEntriesController::class, 'destroy'])->name('financial.entries.destroy');

    // Takeat Sync
    Route::post('takeat/sync/today', [TakeatSyncController::class, 'syncToday'])->name('takeat.sync.today');
    Route::post('takeat/sync/date', [TakeatSyncController::class, 'syncDate'])->name('takeat.sync.date');
});

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
require __DIR__.'/ifood.php';
require __DIR__.'/admin.php';
