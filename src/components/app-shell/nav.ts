import {
  Award,
  BookOpen,
  Building2,
  FileSpreadsheet,
  LayoutDashboard,
  ListChecks,
  Settings,
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
  { href: "/me", label: "Chứng chỉ của tôi", icon: Award, roles: ALL, requiresMember: true },
  { href: "/members", label: "Thành viên", icon: Users, roles: ["admin", "manager"] },
  { href: "/records", label: "Chứng chỉ theo người", icon: ListChecks, roles: ["admin", "manager"] },
  { href: "/courses", label: "Khóa học", icon: BookOpen, roles: ALL },
  { href: "/org", label: "Tổ chức", icon: Building2, roles: ["admin"] },
  { href: "/import", label: "Import / Export", icon: FileSpreadsheet, roles: ["admin"] },
  { href: "/settings", label: "Cài đặt", icon: Settings, roles: ["admin"] },
];

/** UX filter only — access is enforced by RLS. */
export function navForUser(role: Role, hasMember: boolean): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role) && (!item.requiresMember || hasMember));
}

export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function labelForPath(pathname: string): string {
  return NAV_ITEMS.find((item) => isActivePath(pathname, item.href))?.label ?? "CertTracker";
}
