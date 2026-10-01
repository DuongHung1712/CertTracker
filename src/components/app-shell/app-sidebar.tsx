"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { isActivePath, navForUser } from "@/components/app-shell/nav";
import { Logo } from "@/components/app-shell/logo";
import type { Role } from "@/components/status/labels";

export function AppSidebar({ role, hasMember }: { role: Role; hasMember: boolean }) {
  const pathname = usePathname();
  const items = navForUser(role, hasMember);
  const { isMobile, setOpenMobile } = useSidebar();

  // Close the mobile drawer once the route actually changes. A click
  // handler on each Link is not reliable here: SidebarMenuButton composes
  // it through Base UI's Tooltip render pipeline, which can swallow Next's
  // own navigation click before router.push runs. Reacting to `pathname`
  // instead only ever fires after navigation has committed.
  useEffect(() => {
    if (isMobile) setOpenMobile(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the route change should trigger this
  }, [pathname]);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex h-9 items-center gap-2.5 px-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <Logo size={22} />
          <span className="text-section-title font-semibold text-sidebar-foreground group-data-[collapsible=icon]:hidden">
            Cert<span className="text-primary">Tracker</span>
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <nav aria-label="Điều hướng chính">
            <SidebarMenu>
              {items.map((item) => {
                const active = isActivePath(pathname, item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={<Link href={item.href} aria-current={active ? "page" : undefined} />}
                      isActive={active}
                      tooltip={item.label}
                    >
                      <item.icon aria-hidden className="size-5" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </nav>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
