"use client";

import { usePathname } from "next/navigation";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { labelForPath } from "@/components/app-shell/nav";
import { UserMenu } from "@/components/app-shell/user-menu";
import type { Role } from "@/components/status/labels";

export function Topbar({ email, role }: { email: string; role: Role }) {
  const pathname = usePathname();
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-card px-4">
      <SidebarTrigger aria-label="Mở hoặc thu gọn menu" />
      <Separator orientation="vertical" className="h-5" />
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>{labelForPath(pathname)}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <div className="ml-auto">
        <UserMenu email={email} role={role} />
      </div>
    </header>
  );
}
