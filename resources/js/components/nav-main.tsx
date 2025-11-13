import { ChevronRight, Lock } from 'lucide-react';

import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
} from '@/components/ui/sidebar';

import { type NavGroup, NavItem } from '@/types';
import { Link, usePage } from '@inertiajs/react';

type NavEntry = NavGroup | NavItem;

// type guard → deixa o TS saber diferenciar
function isNavGroup(entry: NavEntry): entry is NavGroup {
    return (entry as NavGroup).items !== undefined;
}

export function NavMain({ items = [] }: { items: NavEntry[] }) {
    const page = usePage();

    return (
        <SidebarGroup className="px-2 py-0">
            <SidebarGroupLabel>Plataforma</SidebarGroupLabel>
            <SidebarMenu>
                {items.map((item) =>
                    isNavGroup(item) ? (
                        // 🌟 NavGroup
                        <Collapsible
                            key={item.title}
                            asChild
                            // abre se algum subItem for a rota atual
                            defaultOpen={item.items.some((subItem) =>
                                page.url.startsWith(
                                    typeof subItem.href === 'string'
                                        ? subItem.href
                                        : subItem.href.url,
                                ),
                            )}
                            className="group/collapsible"
                        >
                            <SidebarMenuItem>
                                <CollapsibleTrigger asChild>
                                    <SidebarMenuButton tooltip={item.title}>
                                        {item.icon && (
                                            <item.icon className="h-5 w-5" />
                                        )}
                                        <span>{item.title}</span>
                                        <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                                    </SidebarMenuButton>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                    <SidebarMenuSub>
                                        {item.items.map((subItem) => {
                                            const SubIcon = subItem.icon;
                                            const isActive =
                                                page.url.startsWith(
                                                    typeof subItem.href ===
                                                        'string'
                                                        ? subItem.href
                                                        : subItem.href.url,
                                                );
                                            const isLocked = subItem.locked;

                                            return (
                                                <SidebarMenuSubItem
                                                    key={subItem.title}
                                                >
                                                    <SidebarMenuSubButton
                                                        asChild={!isLocked}
                                                        isActive={isActive}
                                                        className={
                                                            isLocked
                                                                ? 'cursor-not-allowed opacity-50'
                                                                : ''
                                                        }
                                                    >
                                                        {isLocked ? (
                                                            <div className="flex items-center gap-2">
                                                                {SubIcon && (
                                                                    <SubIcon className="h-4 w-4" />
                                                                )}
                                                                <span>
                                                                    {
                                                                        subItem.title
                                                                    }
                                                                </span>
                                                                <Lock className="ml-auto h-3 w-3" />
                                                            </div>
                                                        ) : (
                                                            <Link
                                                                href={
                                                                    typeof subItem.href ===
                                                                    'string'
                                                                        ? subItem.href
                                                                        : subItem
                                                                              .href
                                                                              .url
                                                                }
                                                                prefetch
                                                            >
                                                                {SubIcon && (
                                                                    <SubIcon className="h-4 w-4" />
                                                                )}
                                                                <span>
                                                                    {
                                                                        subItem.title
                                                                    }
                                                                </span>
                                                            </Link>
                                                        )}
                                                    </SidebarMenuSubButton>
                                                </SidebarMenuSubItem>
                                            );
                                        })}
                                    </SidebarMenuSub>
                                </CollapsibleContent>
                            </SidebarMenuItem>
                        </Collapsible>
                    ) : (
                        // 🌟 NavItem
                        <SidebarMenuItem key={item.title}>
                            <SidebarMenuButton
                                asChild={!item.locked}
                                isActive={page.url.startsWith(
                                    typeof item.href === 'string'
                                        ? item.href
                                        : item.href.url,
                                )}
                                tooltip={{ children: item.title }}
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
                                    <Link href={item.href} prefetch>
                                        {item.icon && (
                                            <item.icon className="h-4 w-4" />
                                        )}
                                        <span>{item.title}</span>
                                    </Link>
                                )}
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    ),
                )}
            </SidebarMenu>
        </SidebarGroup>
    );
}
