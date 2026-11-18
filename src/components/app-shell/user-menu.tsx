"use client";

import { ChevronDown, Layers, Monitor, Moon, Palette, ShieldCheck, Sun, User } from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useTransition } from "react";
import { useThemeStyleOptional, setStoredThemeStyle, type ThemeStyle } from "@/components/style-provider";
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
  const styleContext = useThemeStyleOptional();
  const style = styleContext ? styleContext.style : "classic";
  const setStyle = styleContext ? styleContext.setStyle : setStoredThemeStyle;

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
            <span>Visual Style</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup value={style} onValueChange={(val) => setStyle(val as ThemeStyle)}>
              <DropdownMenuRadioItem value="classic">
                <Layers aria-hidden className="size-4" />
                <span>Classic Swiss</span>
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="vault">
                <ShieldCheck aria-hidden className="size-4" />
                <span>Credential Vault</span>
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/profile" />}>
          <User aria-hidden className="size-4" />
          <span>Profile</span>
        </DropdownMenuItem>
        <DropdownMenuItem disabled={pending} onClick={() => startTransition(async () => signOut())}>
          {pending ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
