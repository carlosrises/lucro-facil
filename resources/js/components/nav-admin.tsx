import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';

import { type NavItem } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { Lock } from 'lucide-react';

export function NavAdmin({ items = [] }: { items: NavItem[] }) {
    const page = usePage();

    return (
        <SidebarGroup className="px-2 py-0">
            <SidebarGroupLabel>Administração</SidebarGroupLabel>
            <SidebarMenu>
                {items.map((item) => (
                    <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                            asChild={!item.locked}
                            isActive={
                                !item.locked &&
                                page.url ===
                                    (typeof item.href === 'string'
                                        ? item.href
                                        : item.href.url)
                            }
                            disabled={item.locked}
                            className={
                                item.locked
                                    ? 'cursor-not-allowed opacity-50'
                                    : ''
                            }
                        >
                            {item.locked ? (
                                <div className="flex items-center gap-2">
                                    {item.icon && (
                                        <item.icon className="h-4 w-4" />
                                    )}
                                    <span>{item.title}</span>
                                    <Lock className="ml-auto h-3 w-3" />
                                </div>
                            ) : (
                                <Link href={item.href}>
                                    {item.icon && (
                                        <item.icon className="h-4 w-4" />
                                    )}
                                    <span>{item.title}</span>
                                </Link>
                            )}
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                ))}
            </SidebarMenu>
        </SidebarGroup>
    );
}
