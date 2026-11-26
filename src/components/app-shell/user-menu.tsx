"use client";

import { BookOpen, ChevronDown, LogOut, Monitor, Moon, Palette, Sun, User } from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useTransition } from "react";
import { isThemeStyle, THEME_STYLES, useThemeStyle } from "@/components/style-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RoleBadge } from "@/components/status/role-badge";
import type { Role } from "@/components/status/labels";
import { signOut } from "@/features/auth/actions";

export function UserMenu({ email, role }: { email: string; role: Role }) {
  const [pending, startTransition] = useTransition();
  const { theme, setTheme } = useTheme();
  const { style, setStyle } = useThemeStyle();

  return (
    <DropdownMenu>
      {/* No aria-label here: it would replace the visible email/role text as the
          accessible name (WCAG 2.5.3). The sr-only prefix below adds context
          instead, for when the email is hidden below the sm breakpoint. */}
      <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}>
        <span className="sr-only">Account: </span>
        <span className="hidden max-w-48 truncate sm:inline">{email}</span>
        <RoleBadge role={role} />
        <ChevronDown aria-hidden className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-caption text-muted-foreground">{email}</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Sun aria-hidden className="size-4 dark:hidden" />
            <Moon aria-hidden className="hidden size-4 dark:inline" />
            <span>Theme</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
              <DropdownMenuRadioItem value="light">
                <Sun aria-hidden className="size-4" />
                <span>Light</span>
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark">
                <Moon aria-hidden className="size-4" />
                <span>Dark</span>
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="system">
                <Monitor aria-hidden className="size-4" />
                <span>System</span>
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Palette aria-hidden className="size-4" />
            <span>Visual style</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup value={style} onValueChange={(val) => isThemeStyle(val) && setStyle(val)}>
              {THEME_STYLES.map(({ id, label, icon: Icon }) => (
                <DropdownMenuRadioItem key={id} value={id}>
                  <Icon aria-hidden className="size-4" />
                  <span>{label}</span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/profile" />}>
          <User aria-hidden className="size-4" />
          <span>Profile</span>
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/dashboard?guide=1" />}>
          <BookOpen aria-hidden className="size-4" />
          <span>User guide</span>
        </DropdownMenuItem>
        <DropdownMenuItem disabled={pending} onClick={() => startTransition(async () => signOut())}>
          <LogOut aria-hidden className="size-4" />
          <span>{pending ? "Signing out…" : "Sign out"}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
