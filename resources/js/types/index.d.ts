import { InertiaLinkProps } from '@inertiajs/react';
import Echo from 'laravel-echo';
import { LucideIcon } from 'lucide-react';

// Extend Window interface to include Echo
declare global {
    interface Window {
        Echo: Echo;
        Pusher: any;
    }
}

export interface Auth {
    user: User;
}

export interface BreadcrumbItem {
    title: string;
    href: string;
}

export interface NavGroup {
    title: string;
    icon?: LucideIcon | null;
    items: NavItem[];
}

export interface NavItem {
    title: string;
    href: NonNullable<InertiaLinkProps['href']>;
    icon?: LucideIcon | null;
    isActive?: boolean;
    locked?: boolean;
}

export interface SharedData {
    name: string;
    quote: { message: string; author: string };
    auth: Auth;
    sidebarOpen: boolean;
    [key: string]: unknown;
}

export interface User {
    id: number;
    name: string;
    email: string;
    avatar?: string;
    email_verified_at: string | null;
    two_factor_enabled?: boolean;
    created_at: string;
    updated_at: string;
    roles?: string[];
    permissions?: string[];
    [key: string]: unknown; // This allows for additional properties...
}

export interface Tenant {
    id: number;
    name: string;
    email: string;
    phone?: string;
    plan_id?: number;
    onboarding_completed_at?: string;
    created_at: string;
    updated_at: string;
}

export interface Ticket {
    id: number;
    tenant_id: number;
    user_id?: number;
    subject: string;
    priority: 'low' | 'medium' | 'high';
    status: 'open' | 'in_progress' | 'closed';
    created_at: string;
    updated_at: string;
    tenant?: Tenant;
    user?: User;
    messages?: TicketMessage[];
    latest_message?: TicketMessage;
}

export interface TicketMessage {
    id: number;
    ticket_id: number;
    user_id?: number;
    message: string;
    created_at: string;
    updated_at: string;
    user?: User;
}
