<?php

namespace App\Providers;

use App\Events\IngredientCostChanged;
use App\Events\ProductCostChanged;
use App\Listeners\RecalculateDependentProductCosts;
use App\Models\Plan;
use App\Observers\PlanObserver;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Registrar observers
        Plan::observe(PlanObserver::class);

        // Registrar listeners para recalcular produtos dependentes quando insumos/produtos mudam
        Event::listen(IngredientCostChanged::class, RecalculateDependentProductCosts::class);
        Event::listen(ProductCostChanged::class, RecalculateDependentProductCosts::class);
    }
}
