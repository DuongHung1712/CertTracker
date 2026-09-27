"use client";

import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RoleBadge } from "@/components/status/role-badge";
import type { Role } from "@/components/status/labels";
import { signOut } from "@/features/auth/actions";

export function UserMenu({ email, role }: { email: string; role: Role }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="sm" aria-label="Tài khoản" />}>
        <span className="hidden max-w-48 truncate sm:inline">{email}</span>
        <RoleBadge role={role} />
        <ChevronDown aria-hidden className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <div className="px-2 py-1.5 text-caption text-muted-foreground">{email}</div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void signOut()}>Đăng xuất</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
