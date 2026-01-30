<?php

namespace App\Providers;

use App\Events\IngredientCostChanged;
use App\Events\ProductCostChanged;
use App\Listeners\RecalculateDependentProductCosts;
use App\Models\Ingredient;
use App\Models\InternalProduct;
use App\Models\OrderItem;
use App\Models\PaymentMethodMapping;
use App\Models\Plan;
use App\Models\ProductCost;
use App\Models\TaxCategory;
use App\Observers\IngredientObserver;
use App\Observers\InternalProductObserver;
use App\Observers\OrderItemObserver;
use App\Observers\PaymentMethodMappingObserver;
use App\Observers\PlanObserver;
use App\Observers\ProductCostObserver;
use App\Observers\TaxCategoryObserver;
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
        // Registrar observers - recálculo automático de calculated_costs
        Plan::observe(PlanObserver::class);
        OrderItem::observe(OrderItemObserver::class);
        Ingredient::observe(IngredientObserver::class);
        InternalProduct::observe(InternalProductObserver::class);
        PaymentMethodMapping::observe(PaymentMethodMappingObserver::class);
        TaxCategory::observe(TaxCategoryObserver::class);
        ProductCost::observe(ProductCostObserver::class);

        // Registrar listeners para recalcular produtos dependentes quando insumos/produtos mudam
        Event::listen(IngredientCostChanged::class, RecalculateDependentProductCosts::class);
        Event::listen(ProductCostChanged::class, RecalculateDependentProductCosts::class);
    }
}
