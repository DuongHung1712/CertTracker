"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { isActivePath, navForUser } from "@/components/app-shell/nav";
import type { Role } from "@/components/status/labels";

export function AppSidebar({ role, hasMember }: { role: Role; hasMember: boolean }) {
  const pathname = usePathname();
  const items = navForUser(role, hasMember);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <span className="flex h-8 items-center px-2 text-section-title text-sidebar-foreground group-data-[collapsible=icon]:hidden">
          CertTracker
        </span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {items.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  render={<Link href={item.href} />}
                  isActive={isActivePath(pathname, item.href)}
                  tooltip={item.label}
                >
                  <item.icon aria-hidden className="size-5" />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
