export interface Plan {
    id: number;
    code: string;
    name: string;
    description: string | null;
    price: number;
    features: string[] | null;
    stripe_product_id: string | null;
    stripe_price_id: string | null;
    active: boolean;
    created_at: string;
    subscriptions_count?: number;
}
