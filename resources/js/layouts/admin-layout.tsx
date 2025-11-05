import { cn } from '@/lib/utils';
import { User } from '@/types';
import { usePage } from '@inertiajs/react';
import { PropsWithChildren, ReactNode } from 'react';
// import { Breadcrumbs } from '@/components/breadcrumbs';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Link } from '@inertiajs/react';
import {
    BarChart3,
    CreditCard,
    FileText,
    LogOut,
    Menu,
    Package,
    Settings,
    Users,
} from 'lucide-react';
import { useState } from 'react';

export type BreadcrumbItem = {
    title: string;
    href?: string;
};

interface AdminLayoutProps extends PropsWithChildren {
    breadcrumbs?: BreadcrumbItem[];
    header?: ReactNode;
    className?: string;
}

const navigation = [
    {
        name: 'Dashboard',
        href: '/admin',
        icon: BarChart3,
    },
    {
        name: 'Clientes',
        href: '/admin/clients',
        icon: Users,
    },
    {
        name: 'Planos',
        href: '/admin/plans',
        icon: Package,
    },
    {
        name: 'Pagamentos',
        href: '/admin/payments',
        icon: CreditCard,
    },
    {
        name: 'Chamados',
        href: '/admin/tickets',
        icon: FileText,
    },
];

export default function AdminLayout({
    children,
    breadcrumbs = [],
    header,
    className,
}: AdminLayoutProps) {
    const { auth } = usePage<{ auth: { user: User } }>().props;
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const currentPath = window.location.pathname;

    return (
        <div className="flex h-screen bg-gray-50">
            {/* Mobile sidebar */}
            <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
                <SheetTrigger asChild className="lg:hidden">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="fixed top-4 left-4 z-50"
                    >
                        <Menu className="h-6 w-6" />
                    </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-64 p-0">
                    <AdminSidebar currentPath={currentPath} />
                </SheetContent>
            </Sheet>

            {/* Desktop sidebar */}
            <div className="hidden lg:flex lg:flex-shrink-0">
                <div className="flex w-64 flex-col">
                    <AdminSidebar currentPath={currentPath} />
                </div>
            </div>

            {/* Main content */}
            <div className="flex flex-1 flex-col overflow-hidden">
                {/* Top bar */}
                <div className="border-b bg-white px-4 py-4 shadow-sm lg:px-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <h1 className="text-xl font-semibold text-gray-900 lg:hidden">
                                Admin Panel
                            </h1>
                            {breadcrumbs.length > 0 && (
                                <div className="hidden lg:block">
                                    <nav
                                        className="flex"
                                        aria-label="Breadcrumb"
                                    >
                                        <ol className="flex items-center space-x-2">
                                            {breadcrumbs.map((crumb, index) => (
                                                <li
                                                    key={index}
                                                    className="flex items-center"
                                                >
                                                    {index > 0 && (
                                                        <span className="mx-2 text-gray-400">
                                                            /
                                                        </span>
                                                    )}
                                                    {crumb.href ? (
                                                        <Link
                                                            href={crumb.href}
                                                            className="text-sm text-gray-600 hover:text-gray-900"
                                                        >
                                                            {crumb.title}
                                                        </Link>
                                                    ) : (
                                                        <span className="text-sm font-medium text-gray-900">
                                                            {crumb.title}
                                                        </span>
                                                    )}
                                                </li>
                                            ))}
                                        </ol>
                                    </nav>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="text-sm text-gray-600">
                                {auth.user.name}
                            </span>
                            <Link
                                href="/logout"
                                method="post"
                                as="button"
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <LogOut className="h-5 w-5" />
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Page header */}
                {header && (
                    <div className="border-b bg-white px-4 py-4 shadow-sm lg:px-6">
                        {header}
                    </div>
                )}

                {/* Page content */}
                <main className={cn('flex-1 overflow-y-auto', className)}>
                    {children}
                </main>
            </div>
        </div>
    );
}

function AdminSidebar({ currentPath }: { currentPath: string }) {
    return (
        <div className="flex h-full flex-col border-r bg-white">
            {/* Logo */}
            <div className="flex h-16 items-center justify-center border-b">
                <h1 className="text-xl font-bold text-gray-900">Admin Panel</h1>
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-2 px-4 py-6">
                {navigation.map((item) => {
                    const isActive =
                        currentPath === item.href ||
                        (item.href !== '/admin' &&
                            currentPath.startsWith(item.href));

                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={cn(
                                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                                isActive
                                    ? 'bg-blue-50 text-blue-700'
                                    : 'text-gray-700 hover:bg-gray-50',
                            )}
                        >
                            <item.icon className="h-5 w-5" />
                            {item.name}
                        </Link>
                    );
                })}
            </nav>

            {/* Bottom section */}
            <div className="border-t p-4">
                <Link
                    href="/settings"
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                    <Settings className="h-5 w-5" />
                    Configurações
                </Link>
            </div>
        </div>
    );
}
