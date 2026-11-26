import {
  Award,
  BookOpen,
  Building2,
  Compass,
  FileSpreadsheet,
  LayoutDashboard,
  ListChecks,
  Settings,
  ShieldCheck,
  Target,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/components/status/labels";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
  requiresMember?: boolean;
};

const ALL: Role[] = ["admin", "manager", "member"];

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ALL },
  { href: "/me", label: "My learning", icon: Award, roles: ALL, requiresMember: true },
  { href: "/skills", label: "My skills", icon: Compass, roles: ALL, requiresMember: true },
  { href: "/goals", label: "Quarterly goals", icon: Target, roles: ALL, requiresMember: true },
  { href: "/members", label: "Members", icon: Users, roles: ["admin", "manager"] },
  { href: "/records", label: "Team learning", icon: ListChecks, roles: ["admin", "manager"] },
  { href: "/data-quality", label: "Data quality", icon: ShieldCheck, roles: ["admin", "manager"] },
  { href: "/courses", label: "Catalogue", icon: BookOpen, roles: ALL },
  { href: "/org", label: "Organisation", icon: Building2, roles: ["admin"] },
  { href: "/import", label: "Import / Export", icon: FileSpreadsheet, roles: ["admin"] },
  { href: "/settings", label: "Settings", icon: Settings, roles: ["admin"] },
];

/** UX filter only — access is enforced by RLS. */
export function navForUser(role: Role, hasMember: boolean): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role) && (!item.requiresMember || hasMember));
}

export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

const EXTRA_ROUTE_LABELS: ReadonlyArray<{ href: string; label: string }> = [
  { href: "/profile", label: "Profile" },
];

export function labelForPath(pathname: string): string {
  return (
    NAV_ITEMS.find((item) => isActivePath(pathname, item.href))?.label ??
    EXTRA_ROUTE_LABELS.find((item) => isActivePath(pathname, item.href))?.label ??
    "CertTracker"
  );
}
